const db = require('./database');
const fs = require('fs');
const path = require('path');

const taskModel = {
    // Create a new task
    createTask: (title, deadline, photoPath = null, createdById) => {
        return new Promise((resolve, reject) => {
            // Start a transaction for creating the task and its statuses
            db.run('BEGIN TRANSACTION', (transErr) => {
                if (transErr) {
                    console.error('Error starting transaction:', transErr.message);
                    return reject(transErr);
                }
                
                db.run(
                    'INSERT INTO tasks (title, deadline, photo_path, created_by) VALUES (?, ?, ?, ?)',
                    [title, deadline, photoPath, createdById],
                    function (err) {
                        if (err) {
                            console.error('Error inserting task:', err.message);
                            db.run('ROLLBACK', () => {
                                reject(err);
                            });
                        } else {
                            const taskId = this.lastID;
                            console.log(`Task created with ID: ${taskId}`);
                            
                            // Add this task to all users' task_status with completed=0
                            db.all('SELECT id FROM users', [], (err, users) => {
                                if (err) {
                                    console.error('Error getting users:', err.message);
                                    db.run('ROLLBACK', () => {
                                        reject(err);
                                    });
                                } else {
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
                                            db.run('COMMIT', (commitErr) => {
                                                if (commitErr) {
                                                    console.error('Error committing transaction:', commitErr.message);
                                                    db.run('ROLLBACK', () => {
                                                        reject(commitErr);
                                                    });
                                                } else {
                                                    resolve({
                                                        id: taskId,
                                                        title,
                                                        deadline,
                                                        photo_path: photoPath,
                                                        created_by: createdById
                                                    });
                                                }
                                            });
                                        })
                                        .catch(err => {
                                            console.error('Error creating task statuses:', err.message);
                                            db.run('ROLLBACK', () => {
                                                reject(err);
                                            });
                                        });
                                }
                            });
                        }
                    }
                );
            });
        });
    },

    // Get all tasks
    getAllTasks: () => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT t.*, u.name as creator_name 
                FROM tasks t
                LEFT JOIN users u ON t.created_by = u.id
                ORDER BY t.deadline ASC
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    // Get task by ID
    getTaskById: (taskId) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT t.*, u.name as creator_name 
                FROM tasks t
                LEFT JOIN users u ON t.created_by = u.id
                WHERE t.id = ?
            `;
            
            db.get(query, [taskId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Update task
    updateTask: (taskId, title, deadline, photoPath = null) => {
        return new Promise((resolve, reject) => {
            let query, params;
            
            if (photoPath !== null) {
                query = 'UPDATE tasks SET title = ?, deadline = ?, photo_path = ? WHERE id = ?';
                params = [title, deadline, photoPath, taskId];
            } else {
                query = 'UPDATE tasks SET title = ?, deadline = ? WHERE id = ?';
                params = [title, deadline, taskId];
            }
            
            db.run(query, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        resolve({ success: true, message: 'Task updated successfully' });
                    } else {
                        resolve({ success: false, message: 'Task not found' });
                    }
                }
            });
        });
    },

    // Delete task
    deleteTask: (taskId) => {
        return new Promise((resolve, reject) => {
            // First get the task to check if it has a photo to delete
            db.get('SELECT photo_path FROM tasks WHERE id = ?', [taskId], (err, task) => {
                if (err) {
                    return reject(err);
                }
                
                // Begin transaction
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    
                    // Delete task_status entries first (due to foreign key constraint)
                    db.run('DELETE FROM task_status WHERE task_id = ?', [taskId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        // Then delete the task
                        db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            
                            if (this.changes === 0) {
                                db.run('ROLLBACK');
                                return resolve({ success: false, message: 'Task not found' });
                            }
                            
                            // Commit the transaction
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                
                                // If task had a photo, delete it
                                if (task && task.photo_path) {
                                    try {
                                        fs.unlinkSync(path.join(__dirname, '../../', task.photo_path));
                                    } catch (fsErr) {
                                        console.error('Failed to delete task image:', fsErr);
                                        // Don't reject as the task was still deleted successfully
                                    }
                                }
                                
                                resolve({ success: true, message: 'Task deleted successfully' });
                            });
                        });
                    });
                });
            });
        });
    },
    
    // Mark task as completed by a user
    markTaskAsCompleted: (taskId, userId) => {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            db.run(
                'UPDATE task_status SET completed = 1, completed_at = ? WHERE task_id = ? AND user_id = ?',
                [now, taskId, userId],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes > 0) {
                            resolve({ success: true, message: 'Task marked as completed' });
                        } else {
                            // Check if the task-user pair exists
                            db.get(
                                'SELECT * FROM task_status WHERE task_id = ? AND user_id = ?',
                                [taskId, userId],
                                (err, row) => {
                                    if (err) {
                                        reject(err);
                                    } else if (!row) {
                                        // If no row exists, create one
                                        db.run(
                                            'INSERT INTO task_status (task_id, user_id, completed, completed_at) VALUES (?, ?, 1, ?)',
                                            [taskId, userId, now],
                                            function (err) {
                                                if (err) {
                                                    reject(err);
                                                } else {
                                                    resolve({ success: true, message: 'Task marked as completed' });
                                                }
                                            }
                                        );
                                    } else {
                                        // The row exists but was already marked as completed
                                        resolve({ success: false, message: 'Task already marked as completed' });
                                    }
                                }
                            );
                        }
                    }
                }
            );
        });
    },
    
    // Get completion status of a task for all users
    getTaskCompletionStatus: (taskId) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT u.id, u.name, u.phone_number, ts.completed, ts.completed_at
                FROM users u
                LEFT JOIN task_status ts ON u.id = ts.user_id AND ts.task_id = ?
                WHERE u.role = 'user'
                ORDER BY ts.completed DESC, u.name ASC
            `;
            
            db.all(query, [taskId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    
    // Get all tasks with completion status for a specific user
    getTasksForUser: (userId) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT t.*, ts.completed, ts.completed_at
                FROM tasks t
                LEFT JOIN task_status ts ON t.id = ts.task_id AND ts.user_id = ?
                ORDER BY t.deadline ASC
            `;
            
            db.all(query, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
};

module.exports = taskModel;
