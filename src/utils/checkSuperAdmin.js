const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath);

// Check the super admin exists
function checkSuperAdmin() {
    console.log('Checking super admin account...');
    
    const superAdminPhone = '085155349970';
    
    db.get("SELECT * FROM users WHERE phone_number = ?", [superAdminPhone], (err, superAdmin) => {
        if (err) {
            console.error('Error checking for superadmin:', err.message);
            db.close();
            return;
        }
        
        if (superAdmin) {
            console.log('✅ Super Admin account found:');
            console.log(`  - Name: ${superAdmin.name}`);
            console.log(`  - Phone: ${superAdmin.phone_number}`);
            console.log(`  - Role: ${superAdmin.role}`);
        } else {
            console.log('❌ Super Admin account NOT found');
        }
        
        // Check total users count
        db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
            if (err) {
                console.error('Error counting users:', err.message);
            } else {
                console.log(`\nTotal users in database: ${result.count}`);
            }
            
            // Check total tasks count
            db.get("SELECT COUNT(*) as count FROM tasks", (err, result) => {
                if (err) {
                    console.error('Error counting tasks:', err.message);
                } else {
                    console.log(`Total tasks in database: ${result.count}`);
                }
                
                db.close();
            });
        });
    });
}

// Run the check
checkSuperAdmin();
