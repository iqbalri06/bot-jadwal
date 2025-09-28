const db = require('./database');

const userModel = {
    // Create a new user
    createUser: (phoneNumber, name, role = 'user') => {
        return new Promise((resolve, reject) => {
            const validRoles = ['superadmin', 'admin', 'user'];
            if (!validRoles.includes(role)) {
                return reject(new Error('Invalid role. Must be superadmin, admin, or user'));
            }

            db.run(
                'INSERT INTO users (phone_number, name, role) VALUES (?, ?, ?)',
                [phoneNumber, name, role],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            phone_number: phoneNumber,
                            name,
                            role
                        });
                    }
                }
            );
        });
    },

    // Get user by phone number
    getUserByPhoneNumber: (phoneNumber) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE phone_number = ?',
                [phoneNumber],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    },

    // Get user by role (returns first user with the specified role)
    getUserByRole: (role) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE role = ?',
                [role],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    },

    // Get all users
    getAllUsers: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, phone_number, name, role FROM users', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    // Update user role (only superadmin can change roles)
    updateUserRole: (phoneNumber, newRole) => {
        return new Promise((resolve, reject) => {
            const validRoles = ['superadmin', 'admin', 'user'];
            if (!validRoles.includes(newRole)) {
                return reject(new Error('Invalid role. Must be superadmin, admin, or user'));
            }

            db.run(
                'UPDATE users SET role = ? WHERE phone_number = ?',
                [newRole, phoneNumber],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes > 0) {
                            resolve({ success: true, message: 'Role updated successfully' });
                        } else {
                            resolve({ success: false, message: 'User not found' });
                        }
                    }
                }
            );
        });
    },

    // Update user's phone number
    updatePhoneNumber: (userId, newPhoneNumber) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET phone_number = ? WHERE id = ?',
                [newPhoneNumber, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes > 0) {
                            resolve({ success: true, message: 'Phone number updated successfully' });
                        } else {
                            resolve({ success: false, message: 'User not found' });
                        }
                    }
                }
            );
        });
    },

    // Delete user (only superadmin)
    deleteUser: (phoneNumber) => {
        return new Promise((resolve, reject) => {
            // First check if the user exists
            db.get('SELECT id FROM users WHERE phone_number = ?', [phoneNumber], (err, user) => {
                if (err) {
                    return reject(err);
                }
                
                if (!user) {
                    return resolve({ success: false, message: 'Pengguna tidak ditemukan.' });
                }
                
                const userId = user.id;
                
                // Begin a transaction to safely delete user and related data
                db.run('BEGIN TRANSACTION', (transErr) => {
                    if (transErr) {
                        return reject(transErr);
                    }
                    
                    // First delete related task_status entries
                    db.run('DELETE FROM task_status WHERE user_id = ?', [userId], (statusErr) => {
                        if (statusErr) {
                            db.run('ROLLBACK', () => {
                                reject(new Error(`Gagal menghapus status tugas pengguna: ${statusErr.message}`));
                            });
                            return;
                        }
                        
                        // Then delete the user
                        db.run('DELETE FROM users WHERE id = ?', [userId], function(userErr) {
                            if (userErr) {
                                db.run('ROLLBACK', () => {
                                    reject(new Error(`Gagal menghapus pengguna: ${userErr.message}`));
                                });
                                return;
                            }
                            
                            // Commit the transaction
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    db.run('ROLLBACK', () => {
                                        reject(new Error(`Gagal melakukan commit: ${commitErr.message}`));
                                    });
                                    return;
                                }
                                
                                resolve({ 
                                    success: true, 
                                    message: 'Pengguna berhasil dihapus beserta data terkaitnya.' 
                                });
                            });
                        });
                    });
                });
            });
        });
    }
};

module.exports = userModel;
