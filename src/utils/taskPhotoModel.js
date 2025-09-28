const db = require('../database/database');
const fs = require('fs');
const path = require('path');

const taskModel = {
    // Create a new task with multiple photos
    createTaskWithPhotos: (title, deadline, photoPaths = [], createdById) => {
        return new Promise((resolve, reject) => {
            // Start a transaction for creating the task and its statuses
            db.run('BEGIN TRANSACTION', (transErr) => {
                if (transErr) {
                    console.error('Error starting transaction:', transErr.message);
                    return reject(transErr);
                }
                
                // First insert the task (without photo_path - we'll use the task_photos table)
                db.run(
                    'INSERT INTO tasks (title, deadline, created_by) VALUES (?, ?, ?)',
                    [title, deadline, createdById],
                    function (err) {
                        if (err) {
                            console.error('Error inserting task:', err.message);
                            db.run('ROLLBACK', () => {
                                reject(err);
                            });
                            return;
                        }
                        
                        const taskId = this.lastID;
                        console.log(`Task created with ID: ${taskId}`);
                        
                        // Function to add photos
                        const addPhotos = () => {
                            if (!photoPaths || photoPaths.length === 0) {
                                return Promise.resolve();
                            }
                            
                            const photoPromises = photoPaths.map(photoPath => {
                                return new Promise((resolve, reject) => {
                                    db.run(
                                        'INSERT INTO task_photos (task_id, photo_path) VALUES (?, ?)',
                                        [taskId, photoPath],
                                        (err) => {
                                            if (err) {
                                                console.error(`Error adding photo for task ${taskId}:`, err.message);
                                                reject(err);
                                            } else {
                                                console.log(`Added photo for task ${taskId}: ${photoPath}`);
                                                resolve();
                                            }
                                        }
                                    );
                                });
                            });
                            
                            return Promise.all(photoPromises);
                        };
                        
                        // Add this task to all users' task_status with completed=0
                        db.all('SELECT id FROM users', [], (err, users) => {
                            if (err) {
                                console.error('Error getting users:', err.message);
                                db.run('ROLLBACK', () => {
                                    reject(err);
                                });
                                return;
                            }
                            
                            console.log(`Adding task status for ${users.length} users`);
                            
                            const insertStatements = users.map(user => {
                                return new Promise((resolve, reject) => {
                                    db.run(
                                        'INSERT INTO task_status (task_id, user_id, completed) VALUES (?, ?, 0)',
                                        [taskId, user.id],
                                        err => {
                                            if (err) {
                                                console.error(`Error adding task status for user ${user.id}:`, err.message);
                                                reject(err);
                                            } else {
                                                resolve();
                                            }
                                        }
                                    );
                                });
                            });
                            
                            Promise.all(insertStatements)
                                .then(() => {
                                    console.log('All task statuses created successfully');
                                    
                                    // Add photos
                                    return addPhotos();
                                })
                                .then(() => {
                                    // Commit the transaction
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Error committing transaction:', err.message);
                                            db.run('ROLLBACK', () => {
                                                reject(err);
                                            });
                                        } else {
                                            // Get the full task info to return
                                            db.get(
                                                `SELECT t.*, u.name as creator_name 
                                                 FROM tasks t
                                                 LEFT JOIN users u ON t.created_by = u.id
                                                 WHERE t.id = ?`,
                                                [taskId],
                                                (err, task) => {
                                                    if (err) {
                                                        reject(err);
                                                    } else {
                                                        // Get photos for the task
                                                        db.all('SELECT photo_path FROM task_photos WHERE task_id = ?',
                                                            [taskId],
                                                            (err, photos) => {
                                                                if (err) {
                                                                    reject(err);
                                                                } else {
                                                                    task.photos = photos.map(p => p.photo_path);
                                                                    resolve(task);
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                    });
                                })
                                .catch(err => {
                                    console.error('Error in transaction:', err);
                                    db.run('ROLLBACK', () => {
                                        reject(err);
                                    });
                                });
                        });
                    }
                );
            });
        });
    },
    
    // Get photos for a task
    getTaskPhotos: (taskId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT photo_path FROM task_photos WHERE task_id = ? ORDER BY created_at',
                [taskId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map(row => row.photo_path));
                    }
                }
            );
        });
    },
    
    // Add photo to an existing task
    addPhotoToTask: (taskId, photoPath) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO task_photos (task_id, photo_path) VALUES (?, ?)',
                [taskId, photoPath],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            task_id: taskId,
                            photo_path: photoPath
                        });
                    }
                }
            );
        });
    },
    
    // Remove photo from task
    removePhotoFromTask: (photoId) => {
        return new Promise((resolve, reject) => {
            // First get the photo path
            db.get('SELECT photo_path FROM task_photos WHERE id = ?', [photoId], (err, photo) => {
                if (err) {
                    return reject(err);
                }
                
                if (!photo) {
                    return resolve({ success: false, message: 'Foto tidak ditemukan.' });
                }
                
                // Delete from database
                db.run('DELETE FROM task_photos WHERE id = ?', [photoId], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    
                    try {
                        // Delete file from filesystem
                        if (photo.photo_path) {
                            const filePath = path.join(__dirname, '../../', photo.photo_path);
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        }
                        
                        resolve({ success: true, message: 'Foto berhasil dihapus.' });
                    } catch (fileErr) {
                        console.error('Error deleting photo file:', fileErr);
                        // Still consider success if database entry was deleted
                        resolve({ success: true, message: 'Foto berhasil dihapus dari database.' });
                    }
                });
            });
        });
    }
};

module.exports = taskModel;
