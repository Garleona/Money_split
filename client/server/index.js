const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, initDb } = require('./db');
const { logDbChange } = require('./dbLogger');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: true, // Allow all origins for now to debug
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

initDb();

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Register/Login endpoint
app.post('/api/register', (req, res) => {
  const { email, password, nickname, mode } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // mode: 'login' or 'register' (optional, inferred if missing)
  
  // Check if user exists
  db.get('SELECT * FROM users_v3 WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      // User exists
      if (mode === 'register') {
        return res.status(400).json({ error: 'User already exists. Please login.' });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, row.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      
      // Log them in
      res.cookie('userId', row.id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
      return res.json({ message: 'Logged in successfully', user: { id: row.id, email: row.email, nickname: row.nickname } });
    } else {
      // User does not exist
      if (mode === 'login') {
        return res.status(400).json({ error: 'User not found. Please register.' });
      }

      // Create new user
      if (!nickname) {
         return res.status(400).json({ error: 'Nickname is required for registration' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      db.run('INSERT INTO users_v3 (email, password, nickname) VALUES (?, ?, ?)', [email, hashedPassword, nickname], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const newUser = { id: this.lastID, email, nickname };
        res.cookie('userId', newUser.id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        logDbChange('USER_REGISTERED', { userId: newUser.id, email });
        return res.json({ message: 'Registered successfully', user: newUser });
      });
    }
  });
});

// Check auth endpoint
app.get('/api/me', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  db.get('SELECT id, email, nickname, created_at FROM users_v3 WHERE id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) {
      res.clearCookie('userId');
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({ user: row });
  });
});

// Create Group Endpoint
app.post('/api/groups', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const inviteCode = crypto.randomBytes(4).toString('hex'); // Random 8 char code

  db.run('INSERT INTO groups (name, created_by, invite_code) VALUES (?, ?, ?)', [name, userId, inviteCode], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    const groupId = this.lastID;
    
    // Add creator as member
    db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to add member' });
      
      logDbChange('GROUP_CREATED', { groupId, name, createdBy: Number(userId) });
      res.json({ 
        message: 'Group created', 
        group: { id: groupId, name, invite_code: inviteCode, created_by: userId } 
      });
    });
  });
});

// Join Group Endpoint
app.post('/api/groups/join', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { inviteCode } = req.body;
  
  db.get('SELECT * FROM groups WHERE invite_code = ?', [inviteCode], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [group.id, userId], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Already a member of this group' });
        }
        return res.status(500).json({ error: err.message });
      }
      logDbChange('GROUP_MEMBER_ADDED', { groupId: group.id, userId: Number(userId), via: 'join_endpoint' });
      res.json({ message: 'Joined group successfully', group });
    });
  });
});

// Get User Groups
app.get('/api/groups', (req, res) => {
    const userId = req.cookies.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    db.all(`
        SELECT g.* FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
    `, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ groups: rows });
    });
});

// Get Group Members
app.get('/api/groups/:id/members', (req, res) => {
  const userId = Number(req.cookies.userId);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const groupId = Number(req.params.id);

  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isCreator = Number(group.created_by) === userId;

    const ensureMembership = (callback) => {
      if (isCreator) return callback();
      db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, membership) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
        callback();
      });
    };

    ensureMembership(() => {
      db.all(`
        SELECT u.id, u.email, u.nickname, gm.joined_at 
        FROM users_v3 u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = ?
      `, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Ensure the creator shows up even if legacy data didn't insert them into group_members
        const hasCreator = rows.some(row => Number(row.id) === Number(group.created_by));
        if (hasCreator) {
          return res.json({ members: rows });
        }

        db.get('SELECT id, email, nickname FROM users_v3 WHERE id = ?', [group.created_by], (err, creator) => {
          if (err) return res.status(500).json({ error: err.message });
          if (creator) {
            rows.unshift({
              id: creator.id,
              email: creator.email,
              nickname: creator.nickname || 'Owner',
              joined_at: group.created_at || null,
            });
          }
          res.json({ members: rows });
        });
      });
    });
  });
});

// Get Transactions
app.get('/api/groups/:id/transactions', (req, res) => {
  const userId = Number(req.cookies.userId);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const groupId = Number(req.params.id);

  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Creator can always view, others must be members
    if (Number(group.created_by) !== userId) {
      db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, membership) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
        fetchTransactions();
      });
    } else {
      fetchTransactions();
    }

    function fetchTransactions() {
      db.all(`
        SELECT 
          t.id AS transaction_id,
          t.description,
          t.amount,
          t.created_at,
          u.nickname AS payer_nickname,
          u.email AS payer_email,
          u.id AS payer_id,
          ts.user_id AS share_user_id,
          ts.share AS share_amount,
          su.nickname AS share_user_nickname,
          su.email AS share_user_email
        FROM transactions t
        JOIN users_v3 u ON u.id = t.user_id
        LEFT JOIN transaction_shares ts ON ts.transaction_id = t.id
        LEFT JOIN users_v3 su ON su.id = ts.user_id
        WHERE t.group_id = ?
        ORDER BY t.created_at DESC, ts.user_id ASC
      `, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const map = new Map();
        rows.forEach((row) => {
          if (!map.has(row.transaction_id)) {
            map.set(row.transaction_id, {
              id: row.transaction_id,
              description: row.description,
              amount: row.amount,
              created_at: row.created_at,
              user_nickname: row.payer_nickname,
              user_email: row.payer_email,
              user_id: row.payer_id,
              shares: [],
            });
          }
          if (row.share_user_id) {
            map.get(row.transaction_id).shares.push({
              user_id: row.share_user_id,
              amount: row.share_amount,
              user_nickname: row.share_user_nickname,
              user_email: row.share_user_email,
            });
          }
        });

        res.json({ transactions: Array.from(map.values()) });
      });
    }
  });
});

// Add Transaction
app.post('/api/groups/:id/transactions', (req, res) => {
  const userId = Number(req.cookies.userId);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const groupId = Number(req.params.id);
  const { description, amount, payForUserIds } = req.body;

  if (!description || description.trim().length === 0) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const normalizeBeneficiaries = (groupMembersIds, callback) => {
    let beneficiaries = Array.isArray(payForUserIds)
      ? payForUserIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
      : [];

    if (beneficiaries.length > 0) {
      beneficiaries = beneficiaries.filter((id) => groupMembersIds.includes(id));
    }

    if (beneficiaries.length === 0) {
      beneficiaries = groupMembersIds.slice();
    }

    if (beneficiaries.length === 0) {
      return res.status(400).json({ error: 'No beneficiaries found for this transaction' });
    }

    callback(beneficiaries);
  };

  const insertTransaction = (beneficiaries) => {
    db.serialize(() => {
      db.run(
        'INSERT INTO transactions (group_id, user_id, description, amount) VALUES (?, ?, ?, ?)',
        [groupId, userId, description.trim(), numericAmount],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          const transactionId = this.lastID;
          const shareAmount = numericAmount / beneficiaries.length;

          const insertShare = (index) => {
            if (index >= beneficiaries.length) {
              db.get(`
                SELECT t.id, t.description, t.amount, t.created_at,
                       u.nickname AS user_nickname, u.email AS user_email, u.id AS user_id
                FROM transactions t
                JOIN users_v3 u ON u.id = t.user_id
                WHERE t.id = ?
              `, [transactionId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                db.all(`
                  SELECT ts.user_id, ts.share, u.nickname AS user_nickname, u.email AS user_email
                  FROM transaction_shares ts
                  JOIN users_v3 u ON u.id = ts.user_id
                  WHERE ts.transaction_id = ?
                `, [transactionId], (err, shares) => {
                  if (err) return res.status(500).json({ error: err.message });
                  const transactionPayload = { ...row, shares };
                  logDbChange('TRANSACTION_ADDED', {
                    transactionId,
                    groupId,
                    createdBy: userId,
                    amount: numericAmount,
                  });
                  res.json({ transaction: transactionPayload });
                });
              });
              return;
            }

            const beneficiaryId = beneficiaries[index];
            db.run(
              'INSERT INTO transaction_shares (transaction_id, user_id, share) VALUES (?, ?, ?)',
              [transactionId, beneficiaryId, shareAmount],
              (err) => {
                if (err) return res.status(500).json({ error: err.message });
                insertShare(index + 1);
              }
            );
          };

          insertShare(0);
        }
      );
    });
  };

  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const finalize = (groupMembersIds) => {
      normalizeBeneficiaries(groupMembersIds, insertTransaction);
    };

    const collectMembers = () => {
      db.all('SELECT user_id FROM group_members WHERE group_id = ?', [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const memberIds = rows.map((row) => Number(row.user_id));
        if (!memberIds.includes(Number(group.created_by))) {
          memberIds.push(Number(group.created_by));
        }
        finalize(memberIds);
      });
    };

    if (Number(group.created_by) === userId) {
      return collectMembers();
    }

    db.get('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, membership) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
      collectMembers();
    });
  });
});

// Delete Group (Creator only)
app.delete('/api/groups/:id', (req, res) => {
  const userId = Number(req.cookies.userId);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const groupId = Number(req.params.id);
  if (Number.isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id' });

  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    
    // Check if creator
    if (Number(group.created_by) !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete the group' });
    }

    const rollback = (message) => {
      db.run('ROLLBACK', () => res.status(500).json({ error: message }));
    };

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        'DELETE FROM transaction_shares WHERE transaction_id IN (SELECT id FROM transactions WHERE group_id = ?)',
        [groupId],
        (err) => {
          if (err) return rollback(err.message);

          db.run('DELETE FROM transactions WHERE group_id = ?', [groupId], (err) => {
            if (err) return rollback(err.message);

            db.run('DELETE FROM group_members WHERE group_id = ?', [groupId], (err) => {
              if (err) return rollback(err.message);

              db.run('DELETE FROM groups WHERE id = ?', [groupId], (err) => {
                if (err) return rollback(err.message);

                db.run('COMMIT', (err) => {
                  if (err) return rollback(err.message);
                  logDbChange('GROUP_DELETED', { groupId, deletedBy: userId });
                  res.json({ message: 'Group deleted' });
                });
              });
            });
          });
        }
      );
    });
  });
});

// Remove Member / Leave Group
app.delete('/api/groups/:groupId/members/:memberId', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  
  const { groupId, memberId } = req.params;
  const targetUserId = parseInt(memberId);

  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Logic:
    // 1. User can remove themselves (Leave)
    // 2. Creator can remove anyone
    // 3. Creator cannot be removed (must delete group) - or transfer ownership (not implemented yet)
    
    const isCreator = group.created_by === userId;
    const isSelf = userId === targetUserId;

    if (!isCreator && !isSelf) {
      return res.status(403).json({ error: 'Not authorized to remove this member' });
    }

    if (group.created_by === targetUserId && !isSelf) {
        // Someone else trying to remove creator? (Should be caught by !isCreator check above, but for safety)
        return res.status(403).json({ error: 'Cannot remove the group creator' });
    }
    
    // If creator leaves, warn them (or delete group? For now, just allow leaving if they really want, or block it)
    // Requirement says "creator could remove group", "member could leave". 
    // Typically creator leaving implies transferring ownership or deleting.
    // Let's block creator from "leaving" via this endpoint, force them to "delete group".
    if (group.created_by === targetUserId && isSelf) {
         return res.status(400).json({ error: 'Creator cannot leave. You must delete the group.' });
    }

    db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetUserId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logDbChange(isSelf ? 'GROUP_MEMBER_LEFT' : 'GROUP_MEMBER_REMOVED', {
        groupId: Number(groupId),
        userId: targetUserId,
        actedBy: Number(userId),
      });
      res.json({ message: isSelf ? 'Left group' : 'Member removed' });
    });
  });
});


// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ message: 'Logged out' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
