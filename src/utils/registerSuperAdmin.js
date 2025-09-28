const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database');
        registerSuperAdmin();
    }
});

// Function to register a new super admin
function registerSuperAdmin() {
    const phoneNumber = '085155349970';
    const name = 'Super Admin';
    const role = 'superadmin';
    
    // First check if the user already exists
    db.get(
        'SELECT * FROM users WHERE phone_number = ?',
        [phoneNumber],
        (err, row) => {
            if (err) {
                console.error('Error checking for existing user:', err.message);
                closeAndExit(1);
            } else if (row) {
                // User exists, update to superadmin
                db.run(
                    'UPDATE users SET role = ? WHERE phone_number = ?',
                    [role, phoneNumber],
                    function (err) {
                        if (err) {
                            console.error('Error updating user role:', err.message);
                            closeAndExit(1);
                        } else {
                            console.log(`User ${phoneNumber} role updated to superadmin successfully!`);
                            closeAndExit(0);
                        }
                    }
                );
            } else {
                // User doesn't exist, create new superadmin
                db.run(
                    'INSERT INTO users (phone_number, name, role) VALUES (?, ?, ?)',
                    [phoneNumber, name, role],
                    function (err) {
                        if (err) {
                            console.error('Error creating superadmin:', err.message);
                            closeAndExit(1);
                        } else {
                            console.log(`Superadmin ${phoneNumber} created successfully!`);
                            closeAndExit(0);
                        }
                    }
                );
            }
        }
    );
}

function closeAndExit(code) {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
        process.exit(code);
    });
}
