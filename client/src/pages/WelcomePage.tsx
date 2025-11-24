import React, { useState, useEffect } from 'react';
import { Button } from 'baseui/button';
import { Card, StyledBody } from 'baseui/card';
import { Input } from 'baseui/input';
import { FormControl } from 'baseui/form-control';
import { styled } from 'baseui';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Spinner } from 'baseui/spinner';
import { Delete } from 'baseui/icon';

const PageContainer = styled('div', {
  display: 'flex',
  height: '100vh',
  backgroundColor: '#f6f6f6',
  '@media (max-width: 768px)': {
    flexDirection: 'column',
    paddingBottom: '60px', // Space for bottom nav
  },
});

const Sidebar = styled('div', {
  width: '350px',
  backgroundColor: 'white',
  borderRight: '1px solid #eee',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px',
  overflowY: 'auto',
  '@media (max-width: 768px)': {
    display: 'none', // Hide completely on mobile, use BottomNav instead
  },
});

const MainContent = styled('div', {
  flex: 1,
  padding: '40px',
  overflowY: 'auto',
  '@media (max-width: 768px)': {
    padding: '15px',
    width: '100%',
  },
});

const BottomNav = styled('div', {
  display: 'none',
  '@media (max-width: 768px)': {
    display: 'flex',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTop: '1px solid #eee',
    height: '60px',
    zIndex: 1000,
    justifyContent: 'space-around',
    alignItems: 'center',
    boxShadow: '0px -2px 10px rgba(0,0,0,0.05)',
  },
});

const NavItem = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  height: '100%',
  cursor: 'pointer',
  color: '#666',
  fontSize: '0.8rem',
});

const GroupItem = styled('div', {
  padding: '15px',
  border: '1px solid #eee',
  marginBottom: '10px',
  borderRadius: '8px',
  cursor: 'pointer',
  ':hover': {
    backgroundColor: '#f9f9f9',
  },
});

const SectionTitle = styled('h3', {
    marginTop: '20px',
    marginBottom: '10px',
    fontSize: '16px',
    color: '#333'
});

interface WelcomePageProps {
  user: { id: number; email: string; nickname?: string } | null;
  onLogout: () => void;
}

interface Group {
  id: number;
  name: string;
  invite_code: string;
  created_by: number;
}

interface Member {
    id: number;
    nickname: string;
    email: string;
    joined_at: string;
}

interface Transaction {
    id: number;
    description: string;
    amount: number;
    created_at: string;
    user_id: number;
    user_nickname: string;
    user_email: string;
    shares: TransactionShare[];
}

interface TransactionShare {
    user_id: number;
    amount: number;
    user_nickname: string;
    user_email: string;
}

const AnyInput = Input as any;
const AnyFormControl = FormControl as any;
const DeleteIcon = Delete as any;

type MobileTab = 'account' | 'create' | 'groups';

const WelcomePage: React.FC<WelcomePageProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transactionForm, setTransactionForm] = useState({ description: '', amount: '' });
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [selectedPayFor, setSelectedPayFor] = useState<number[]>([]);
  const [showPayForPicker, setShowPayForPicker] = useState(false);
  
  // Mobile state
  const [activeTab, setActiveTab] = useState<MobileTab>('groups');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchGroups();
  }, [user, navigate]);

  useEffect(() => {
      if (selectedGroup) {
          fetchMembers(selectedGroup.id);
          fetchTransactions(selectedGroup.id);
          setSelectedPayFor([]);
          setShowPayForPicker(false);
      }
  }, [selectedGroup]);

  const fetchGroups = async () => {
      try {
          const res = await fetch('/api/groups', { credentials: 'include' });
          if (res.ok) {
              const data = await res.json();
              setGroups(data.groups);
          }
      } catch (e) {
          console.error("Failed to fetch groups", e);
      }
  };

  const fetchTransactions = async (groupId: number) => {
      setLoadingTransactions(true);
      try {
          const res = await fetch(`/api/groups/${groupId}/transactions`, { credentials: 'include' });
          if (res.ok) {
              const data = await res.json();
              setTransactions(data.transactions);
          }
      } catch (e) {
          console.error("Failed to fetch transactions", e);
      } finally {
          setLoadingTransactions(false);
      }
  };

  const fetchMembers = async (groupId: number) => {
      setLoadingMembers(true);
      try {
          const res = await fetch(`/api/groups/${groupId}/members`, { credentials: 'include' });
          if (res.ok) {
              const data = await res.json();
              console.log("Fetched members:", data.members); // Debug log
              setMembers(data.members);
          } else {
              console.error("Failed to fetch members response not ok");
          }
      } catch (e) {
          console.error("Failed to fetch members", e);
      } finally {
          setLoadingMembers(false);
      }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        const newGroup = data.group;
        setGroups([...groups, newGroup]);
        setGroupName('');
        setSelectedGroup(newGroup); 
      } else {
        alert(data.error || 'Failed to create group');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async () => {
      if (!selectedGroup || !confirm(`Are you sure you want to delete "${selectedGroup.name}"? This cannot be undone.`)) return;
      
      try {
          const res = await fetch(`/api/groups/${selectedGroup.id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) {
              setGroups(groups.filter(g => g.id !== selectedGroup.id));
              setSelectedGroup(null);
          } else {
              alert('Failed to delete group');
          }
      } catch (e) {
          console.error(e);
      }
  };

  const handleLeaveGroup = async () => {
      if (!selectedGroup || !user) return;
      if (!confirm(`Are you sure you want to leave "${selectedGroup.name}"?`)) return;

      try {
        const res = await fetch(`/api/groups/${selectedGroup.id}/members/${user.id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
            setGroups(groups.filter(g => g.id !== selectedGroup.id));
            setSelectedGroup(null);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to leave group');
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
      if (!selectedGroup) return;
      if (!confirm("Remove this member?")) return;

      try {
        const res = await fetch(`/api/groups/${selectedGroup.id}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
            setMembers(members.filter(m => m.id !== memberId));
        } else {
            alert('Failed to remove member');
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleAddTransaction = async () => {
      if (!selectedGroup) return;
      if (!transactionForm.description.trim()) {
          alert('Description is required');
          return;
      }
      const amountNumber = Number(transactionForm.amount);
      if (Number.isNaN(amountNumber) || amountNumber <= 0) {
          alert('Please enter a positive amount');
          return;
      }

      setSavingTransaction(true);
      try {
          const res = await fetch(`/api/groups/${selectedGroup.id}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  description: transactionForm.description,
                  amount: amountNumber,
                  payForUserIds: selectedPayFor,
              }),
              credentials: 'include',
          });
          const data = await res.json();
          if (res.ok) {
              setTransactionForm({ description: '', amount: '' });
              setTransactions([data.transaction, ...transactions]);
              if (selectedPayFor.length === 0) {
                  setShowPayForPicker(false);
              }
          } else {
              alert(data.error || 'Failed to add transaction');
          }
      } catch (e) {
          console.error('Failed to add transaction', e);
          alert('Network error adding transaction');
      } finally {
          setSavingTransaction(false);
      }
  };

  const handleSettlePayment = async (settlement: Settlement) => {
      if (!selectedGroup || !user) return;
      if (!confirm(`Mark payment of ${formatCurrency(settlement.amount)} from ${settlement.from.nickname} to ${settlement.to.nickname} as paid?`)) return;

      // To "settle", we create a transaction where the payer pays the receiver the settlement amount.
      // Wait, if A owes B $10, it means A pays B $10.
      // In our system, "A paid $10 for B" effectively cancels out "A owes B $10" (if A originally owed B).
      // BUT, standard settlement is: A gives money to B.
      // If A gives money to B, it's like B paid for A? No.
      // A pays B. A's "paid" amount increases. B's "paid" amount (in the group context) doesn't change, but B receives money.
      
      // Let's model it as a Reimbursement transaction:
      // Description: "Settlement: A -> B"
      // Amount: $10
      // Payer: A (The one who owes money)
      // "Pay for": B (The one who is owed money)
      
      // If A pays $10 for B:
      // A paid $10. A's balance +10.
      // B "consumed" $10. B's balance -10.
      // Net effect: A is +10 relative to before, B is -10 relative to before.
      // If A was -10 (owed) and B was +10 (owed to), this zeros them out. Correct.

      setSavingTransaction(true);
      try {
          const res = await fetch(`/api/groups/${selectedGroup.id}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  description: `Settlement: ${settlement.from.nickname} -> ${settlement.to.nickname}`,
                  amount: settlement.amount,
                  payForUserIds: [settlement.to.id], // Paid FOR the creditor
              }),
              credentials: 'include',
          });
          const data = await res.json();
          if (res.ok) {
              setTransactions([data.transaction, ...transactions]);
          } else {
              alert(data.error || 'Failed to record settlement');
          }
      } catch (e) {
          console.error('Failed to settle', e);
          alert('Network error recording settlement');
      } finally {
          setSavingTransaction(false);
      }
  };

  const formatCurrency = (value: number) =>
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value || 0);

  const inviteLink = selectedGroup ? `${window.location.origin}/split/join?code=${selectedGroup.invite_code}` : '';

  const paidTotals = React.useMemo(() => {
      const totals: Record<number, number> = {};
      transactions.forEach((tx) => {
          totals[tx.user_id] = (totals[tx.user_id] || 0) + tx.amount;
      });
      return totals;
  }, [transactions]);

  const owedTotals = React.useMemo(() => {
      const totals: Record<number, number> = {};
      transactions.forEach((tx) => {
          if (tx.shares && tx.shares.length) {
              tx.shares.forEach((share) => {
                  totals[share.user_id] = (totals[share.user_id] || 0) + share.amount;
              });
          } else if (members.length) {
              const share = tx.amount / members.length;
              members.forEach((member) => {
                  totals[member.id] = (totals[member.id] || 0) + share;
              });
          }
      });
      return totals;
  }, [transactions, members]);

  const memberTotals = paidTotals;

  const groupTotal = React.useMemo(
      () => transactions.reduce((sum, tx) => sum + tx.amount, 0),
      [transactions]
  );

  interface Settlement {
      from: Member;
      to: Member;
      amount: number;
  }

  const settlements = React.useMemo<Settlement[]>(() => {
      if (members.length === 0) return [];

      const credits: { member: Member; amount: number }[] = [];
      const debts: { member: Member; amount: number }[] = [];

      members.forEach((member) => {
          const paid = memberTotals[member.id] || 0;
          const owed = owedTotals[member.id] || 0;
          const balance = paid - owed;
          if (balance > 0.01) {
              credits.push({ member, amount: balance });
          } else if (balance < -0.01) {
              debts.push({ member, amount: -balance });
          }
      });

      const settlementsResult: Settlement[] = [];

      let i = 0;
      let j = 0;
      while (i < debts.length && j < credits.length) {
          const debtor = debts[i];
          const creditor = credits[j];
          const amount = Math.min(debtor.amount, creditor.amount);

            settlementsResult.push({
                from: debtor.member,
                to: creditor.member,
                amount,
            });

            debtor.amount -= amount;
            creditor.amount -= amount;

            if (debtor.amount <= 0.01) i++;
            if (creditor.amount <= 0.01) j++;
      }

      return settlementsResult;
  }, [members, memberTotals, owedTotals]);

  const copyToClipboard = () => {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  const isCreator = selectedGroup && user && Number(selectedGroup.created_by) === Number(user.id);

  // Mobile Views Renderers
  const renderMobileAccount = () => (
      <div style={{ padding: '20px', textAlign: 'center' }}>
          {user.nickname && <h2>{user.nickname}</h2>}
          <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '20px' }}>{user.email}</p>
          <Button onClick={onLogout} kind="secondary" style={{ width: '100%' }}>
              Logout
          </Button>
      </div>
  );

  const renderMobileCreate = () => (
      <div style={{ padding: '20px' }}>
          <SectionTitle>Create New Group</SectionTitle>
          <AnyInput 
              value={groupName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.currentTarget.value)}
              placeholder="Group Name"
          />
          <Button 
            onClick={() => { handleCreateGroup().then(() => { if (groupName.trim()) setActiveTab('groups'); }); }} 
            isLoading={isCreating} 
            style={{ width: '100%', marginTop: '10px' }}
          >
              Create Group
          </Button>
      </div>
  );

  const renderMobileGroupsList = () => (
      <div style={{ padding: '10px' }}>
           <SectionTitle>Your Groups</SectionTitle>
            {groups.length === 0 && <p style={{color:'#999', fontSize: '0.9em', textAlign: 'center', marginTop: '20px'}}>No groups yet.</p>}
            {groups.map(group => (
                <GroupItem 
                    key={group.id} 
                    onClick={() => { setSelectedGroup(group); /* Stay in groups tab, but view details */ }}
                    style={{ 
                        backgroundColor: selectedGroup?.id === group.id ? '#e0f7fa' : 'white',
                        borderColor: selectedGroup?.id === group.id ? '#00acc1' : '#eee'
                    }}
                >
                    <strong>{group.name}</strong>
                </GroupItem>
            ))}
      </div>
  );

  return (
    <PageContainer>
      {/* Desktop Sidebar */}
      <Sidebar>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {user.nickname && <h2>{user.nickname}</h2>}
            <p style={{ color: '#666', fontSize: '0.9em' }}>{user.email}</p>
            <Button onClick={onLogout} kind="secondary" size="compact" style={{ marginTop: '10px' }}>
                Logout
            </Button>
        </div>

        <hr style={{ width: '100%', border: '0', borderTop: '1px solid #eee' }} />

        <SectionTitle>Create New Group</SectionTitle>
        <div style={{ display: 'flex', gap: '5px' }}>
            <AnyInput 
                value={groupName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.currentTarget.value)}
                placeholder="Group Name"
                size="compact"
            />
            <Button onClick={handleCreateGroup} isLoading={isCreating} size="compact">
                +
            </Button>
        </div>

        <SectionTitle>Your Groups</SectionTitle>
        {groups.length === 0 && <p style={{color:'#999', fontSize: '0.9em'}}>No groups yet.</p>}
        {groups.map(group => (
            <GroupItem 
                key={group.id} 
                onClick={() => setSelectedGroup(group)}
                style={{ 
                    backgroundColor: selectedGroup?.id === group.id ? '#e0f7fa' : 'white',
                    borderColor: selectedGroup?.id === group.id ? '#00acc1' : '#eee'
                }}
            >
                <strong>{group.name}</strong>
            </GroupItem>
        ))}
      </Sidebar>

      <MainContent>
        {isMobile && activeTab === 'account' ? (
            renderMobileAccount()
        ) : isMobile && activeTab === 'create' ? (
            renderMobileCreate()
        ) : isMobile && activeTab === 'groups' && !selectedGroup ? (
            renderMobileGroupsList()
        ) : !selectedGroup ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa' }}>
                <h2>Select a group to view details</h2>
            </div>
        ) : (
            <div>
                {isMobile && (
                    <Button 
                        kind="tertiary" 
                        size="compact" 
                        onClick={() => setSelectedGroup(null)}
                        style={{ marginBottom: '10px' }}
                    >
                        ← Back to Groups
                    </Button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1>{selectedGroup.name}</h1>
                    <div>
                        {isCreator ? (
                            <Button
                                kind="secondary"
                                overrides={{
                                    BaseButton: {
                                        style: {
                                            backgroundColor: '#d32f2f',
                                            color: '#fff',
                                        },
                                    },
                                }}
                                onClick={handleDeleteGroup}
                            >
                                Delete Group
                            </Button>
                        ) : (
                            <Button kind="secondary" onClick={handleLeaveGroup}>Leave Group</Button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <Card title="Invite Members" overrides={{ Root: { style: { width: '300px', '@media (max-width: 768px)': { width: '100%' } } } }}>
                        <StyledBody style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <QRCode value={inviteLink} size={150} />
                            
                            <div style={{ marginTop: '20px', width: '100%' }}>
                                <p style={{ fontSize: '0.8em', color: '#666', marginBottom: '5px' }}>Invite Link:</p>
                                <div style={{ 
                                    display: 'flex', 
                                    background: '#f0f0f0', 
                                    padding: '8px', 
                                    borderRadius: '4px', 
                                    fontSize: '0.8em',
                                    marginBottom: '10px',
                                    wordBreak: 'break-all'
                                }}>
                                    {inviteLink}
                                </div>
                                <Button 
                                    onClick={copyToClipboard} 
                                    size="compact" 
                                    kind="secondary" 
                                    style={{ width: '100%' }}
                                >
                                    {copied ? "Copied!" : "Copy Link"}
                                </Button>
                            </div>
                        </StyledBody>
                    </Card>

                    <Card 
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div>
                                    <span>Members ({members.length})</span>
                                    <div style={{ fontSize: '0.8em', color: '#555' }}>
                                        Group Total: {formatCurrency(groupTotal)}
                                    </div>
                                </div>
                                <Button 
                                    kind="tertiary" 
                                    size="compact" 
                                    onClick={() => selectedGroup && fetchMembers(selectedGroup.id)}
                                    disabled={loadingMembers}
                                >
                                    Refresh
                                </Button>
                            </div>
                        }
                        overrides={{ Root: { style: { flex: 1, minWidth: '300px', '@media (max-width: 768px)': { minWidth: '100%' } } } }}
                    >
                        <StyledBody>
                            {loadingMembers ? <Spinner /> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {members.map(member => (
                                        <li key={member.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong>{member.nickname}</strong>
                                                <div style={{ fontSize: '0.8em', color: '#006064', marginTop: '2px' }}>
                                                    Paid: {formatCurrency(memberTotals[member.id] || 0)} | Owes: {formatCurrency(owedTotals[member.id] || 0)}
                                                </div>
                                                {Number(member.id) === Number(selectedGroup.created_by) && <span style={{marginLeft:'8px', background:'#eee', padding:'2px 6px', borderRadius:'4px', fontSize:'0.7em'}}>Owner</span>}
                                            </div>
                                            {isCreator && member.id !== user.id && (
                                                <Button size="compact" kind="tertiary" onClick={() => handleRemoveMember(member.id)}>
                                                    <DeleteIcon size={18} />
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </StyledBody>
                    </Card>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '20px' }}>
                    <Card title="Add Transaction" overrides={{ Root: { style: { width: '320px', '@media (max-width: 768px)': { width: '100%' } } } }}>
                        <StyledBody>
                            <AnyFormControl label="Description">
                                <AnyInput
                                    value={transactionForm.description}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransactionForm({ ...transactionForm, description: e.currentTarget.value })}
                                    placeholder="e.g. Dinner"
                                />
                            </AnyFormControl>
                            <AnyFormControl label="Amount">
                                <AnyInput
                                    type="number"
                                    value={transactionForm.amount}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransactionForm({ ...transactionForm, amount: e.currentTarget.value })}
                                    placeholder="0.00"
                                    startEnhancer="$"
                                />
                            </AnyFormControl>
                            <div style={{ marginBottom: '12px' }}>
                                <Button
                                    kind="tertiary"
                                    size="compact"
                                    onClick={() => setShowPayForPicker((prev) => !prev)}
                                    overrides={{
                                        BaseButton: {
                                            style: {
                                                backgroundColor: '#FFEBEE', // Light pink
                                                color: '#C62828', // Darker red/pink for text
                                                ':hover': {
                                                    backgroundColor: '#FFCDD2',
                                                },
                                            },
                                        },
                                    }}
                                >
                                    {selectedPayFor.length > 0
                                        ? `Pay for (${selectedPayFor.length} selected)`
                                        : 'Pay for (whole group)'}
                                </Button>
                                {showPayForPicker && (
                                    <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '8px', marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                                        {members.length === 0 && <p style={{ color: '#888', fontSize: '0.85em' }}>No members yet.</p>}
                                        {members.map((member) => (
                                            <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', marginBottom: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPayFor.includes(member.id)}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        if (e.target.checked) {
                                                            setSelectedPayFor((prev) => [...prev, member.id]);
                                                        } else {
                                                            setSelectedPayFor((prev) => prev.filter((id) => id !== member.id));
                                                        }
                                                    }}
                                                />
                                                {member.nickname}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={handleAddTransaction}
                                isLoading={savingTransaction}
                                style={{ width: '100%' }}
                            >
                                Save Transaction
                            </Button>
                        </StyledBody>
                    </Card>

                    <Card 
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Transactions ({transactions.length})</span>
                                <Button 
                                    kind="tertiary" 
                                    size="compact" 
                                    onClick={() => selectedGroup && fetchTransactions(selectedGroup.id)}
                                    disabled={loadingTransactions}
                                >
                                    Refresh
                                </Button>
                            </div>
                        }
                        overrides={{ Root: { style: { flex: 1, minWidth: '320px', '@media (max-width: 768px)': { minWidth: '100%' } } } }}
                    >
                        <StyledBody>
                            {loadingTransactions ? <Spinner /> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {transactions.length === 0 && <p style={{ color: '#888' }}>No transactions yet.</p>}
                                    {transactions.map(tx => (
                                        <li key={tx.id} style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong>{tx.description}</strong>
                                                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                                                        {tx.user_nickname || tx.user_email} • {new Date(tx.created_at).toLocaleString()}
                                                    </div>
                                                    {tx.shares && tx.shares.length > 0 && (
                                                        <div style={{ fontSize: '0.75em', color: '#555', marginTop: '4px' }}>
                                                            Paid for: {tx.shares.map((share) => share.user_nickname || share.user_email).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontWeight: 'bold' }}>{formatCurrency(tx.amount)}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </StyledBody>
                    </Card>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <Card title="Settlement Summary">
                        <StyledBody>
                            {members.length === 0 ? (
                                <p style={{ color: '#888' }}>No members yet.</p>
                            ) : groupTotal === 0 ? (
                                <p style={{ color: '#888' }}>No spending recorded yet.</p>
                            ) : settlements.length === 0 ? (
                                <div>
                                    <p style={{ color: '#2e7d32', fontWeight: 600 }}>All settled!</p>
                                    <p style={{ fontSize: '0.9em' }}>
                                        Everyone has contributed exactly what they owe.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ fontSize: '0.9em', marginBottom: '10px' }}>
                                        The following payments will balance the group:
                                    </p>
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {settlements.map((settlement, idx) => (
                                            <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong>{settlement.from.nickname}</strong> should pay{' '}
                                                    <strong>{formatCurrency(settlement.amount)}</strong> to{' '}
                                                    <strong>{settlement.to.nickname}</strong>.
                                                </div>
                                                {(Number(user.id) === Number(settlement.from.id) || Number(user.id) === Number(settlement.to.id)) && (
                                                    <Button
                                                        size="compact"
                                                        kind="secondary"
                                                        onClick={() => handleSettlePayment(settlement)}
                                                        isLoading={savingTransaction}
                                                    >
                                                        Unpaid
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </StyledBody>
                    </Card>
                </div>
            </div>
        )}
      </MainContent>

      <BottomNav>
          <NavItem 
            onClick={() => { setActiveTab('account'); setSelectedGroup(null); }}
            style={{ color: activeTab === 'account' ? 'black' : '#888' }}
          >
              <div style={{ fontSize: '20px' }}>👤</div> {/* Fallback icon */}
              <span>Account</span>
          </NavItem>
          
          <NavItem 
            onClick={() => { setActiveTab('create'); setSelectedGroup(null); }}
            style={{ color: activeTab === 'create' ? 'black' : '#888' }}
          >
             <div style={{ fontSize: '24px', fontWeight: 'bold' }}>+</div>
             <span>New Group</span>
          </NavItem>

          <NavItem 
            onClick={() => { setActiveTab('groups'); setSelectedGroup(null); }}
            style={{ color: activeTab === 'groups' ? 'black' : '#888' }}
          >
              <div style={{ fontSize: '20px' }}>☰</div> {/* Fallback icon */}
              <span>Groups</span>
          </NavItem>
      </BottomNav>
    </PageContainer>
  );
};

export default WelcomePage;
