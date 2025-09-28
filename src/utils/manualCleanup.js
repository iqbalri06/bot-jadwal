// Script untuk membersihkan database secara manual
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../taskbot.db');

// Initialize database connection
const db = new sqlite3.Database(dbPath);

// Hapus semua task_status
db.run('DELETE FROM task_status', (err) => {
    if (err) {
        console.error('Error deleting task status:', err.message);
        return;
    }
    console.log('✅ Semua task status telah dihapus');
    
    // Hapus semua tasks
    db.run('DELETE FROM tasks', (err) => {
        if (err) {
            console.error('Error deleting tasks:', err.message);
            return;
        }
        console.log('✅ Semua tugas telah dihapus');
        
        // Hapus semua user kecuali ID 5 (Super Admin)
        db.run('DELETE FROM users WHERE id != 5', (err) => {
            if (err) {
                console.error('Error deleting users:', err.message);
                return;
            }
            console.log('✅ Semua user kecuali Super Admin telah dihapus');
            
            // Update Super Admin
            db.run('UPDATE users SET phone_number = ?, name = ?, role = ? WHERE id = 5', 
                ['6285155349970', 'Super Admin', 'superadmin'], 
                (err) => {
                    if (err) {
                        console.error('Error updating Super Admin:', err.message);
                        return;
                    }
                    console.log('✅ Super Admin telah diperbarui dengan nomor 6285155349970');
                    
                    // Cek status akhir
                    db.all('SELECT * FROM users', [], (err, rows) => {
                        if (err) {
                            console.error('Error checking users:', err.message);
                            return;
                        }
                        console.log('Daftar user setelah pembersihan:');
                        console.log(rows);
                        db.close();
                    });
                }
            );
        });
    });
});
