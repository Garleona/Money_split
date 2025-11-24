const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'db-changes.log');

function logDbChange(action, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };

  try {
    fs.appendFile(logFilePath, JSON.stringify(entry) + '\n', (err) => {
      if (err) {
        console.error('Failed to write DB change log:', err.message);
      }
    });
  } catch (err) {
    console.error('Unexpected error logging DB change:', err.message);
  }
}

module.exports = { logDbChange, logFilePath };

