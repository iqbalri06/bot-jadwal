const taskModel = require('../database/taskModel');
const userModel = require('../database/userModel');
const messageFormatter = require('../utils/messageFormatter');
const commandValidator = require('../utils/commandValidator');
const fileUtils = require('../utils/fileUtils');

// User states for multi-step interactions
const userStates = {};

// Handle numeric menu selections based on user role
const handleNumericMenuSelection = async (selection, msg, sock, sender, user) => {
    try {
        // Common options for all roles
        if (selection === 1) {
            // View task list
            try {
                const tasks = await taskModel.getTasksForUser(user.id);
                const formattedMessage = messageFormatter.formatTaskList(tasks);
                await sock.sendMessage(sender, { text: formattedMessage });
            } catch (error) {
                console.error('Error getting tasks:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil daftar tugas.' });
            }
            return;
        } else if (selection === 2) {
            // Help menu
            const helpMessage = messageFormatter.formatHelpMessage(user.role);
            await sock.sendMessage(sender, { text: helpMessage });
            return;
        }
        
        // Option for all roles - Mark task as completed
        if (selection === 3) {
            // Mark task as completed
            await sock.sendMessage(sender, { 
                text: 'Untuk menandai tugas sebagai selesai, lihat daftar tugas terlebih dahulu dengan ketik *1*, ' +
                      'lalu tandai dengan mengetik *selesai.nomor* (contoh: selesai.1)' 
            });
            return;
        }
    
        // Admin options
        if (user.role === 'admin' || user.role === 'superadmin') {
            if (selection === 4) {
                // Add new task
                await startTaskCreation(sock, sender, user);
                return;
            } else if (selection === 5) {
            // Edit task
            await sock.sendMessage(sender, { 
                text: 'Untuk mengedit tugas, lihat daftar tugas terlebih dahulu dengan ketik *1*, ' +
                      'lalu edit dengan mengetik *edit.nomor* (contoh: edit.1)' 
            });
                return;
            } else if (selection === 6) {
                // Delete task
                await sock.sendMessage(sender, { 
                    text: 'Untuk menghapus tugas, lihat daftar tugas terlebih dahulu dengan ketik *1*, ' +
                          'lalu hapus dengan mengetik *hapus.nomor* (contoh: hapus.1)' 
                });
                return;
            } else if (selection === 7) {
                // View task completion status
                await sock.sendMessage(sender, { 
                    text: 'Untuk melihat status penyelesaian tugas, lihat daftar tugas terlebih dahulu dengan ketik *1*, ' +
                          'lalu lihat detail dengan mengetik *detail.nomor* (contoh: detail.1)' 
                });
                return;
            }
        }
        
        // Super admin options
        if (user.role === 'superadmin') {
            if (selection === 8) {
                // User management menu
                const userMenu = messageFormatter.formatUserMenu();
                await sock.sendMessage(sender, { text: userMenu });
                
                // Set state to user management menu
                userStates[sender] = {
                    action: 'user_menu',
                    step: 'waiting_for_selection'
                };
                return;
            }
        }
    
    // If we get here, the selection was invalid
    await sock.sendMessage(sender, { text: '❌ Pilihan tidak valid. Silakan pilih menu yang tersedia.' });
    const mainMenu = messageFormatter.formatMainMenu(user.role);
    await sock.sendMessage(sender, { text: mainMenu });
  } catch (error) {
    console.error('Error handling numeric menu selection:', error);
    await sock.sendMessage(sender, { text: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
};

// Handle special format commands like detail.1, selesai.1, etc.
const handleSpecialCommand = async (action, target, msg, sock, sender, user) => {
    try {
        // Handle detail.X command
        if (action === 'detail') {
            const taskIndex = parseInt(target) - 1; // Convert from 1-based to 0-based index
            if (isNaN(taskIndex) || taskIndex < 0) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                return;
            }
            
            // Get all tasks first to find the task by index
            const tasks = await taskModel.getTasksForUser(user.id);
            
            // Check if index is out of bounds
            if (taskIndex >= tasks.length) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid. Daftar tugas hanya memiliki ' + tasks.length + ' item.' });
                return;
            }
            
            // Get the actual task by the database ID
            const task = await taskModel.getTaskById(tasks[taskIndex].id);
            
            if (!task) {
                await sock.sendMessage(sender, { text: '❌ Tugas tidak ditemukan. Mungkin sudah dihapus.' });
                return;
            }
            
            // For admin and superadmin, also get the completion status
            let users = null;
            if (user.role === 'admin' || user.role === 'superadmin') {
                users = await taskModel.getTaskCompletionStatus(task.id);
            }
            
            const formattedMessage = messageFormatter.formatTaskDetail(task, users, user.role);
            await sock.sendMessage(sender, { text: formattedMessage });
            
            // Check for single photo (old format) or multiple photos (new format)
            if (task.photo_path) {
                // Handle legacy single photo path
                const photoBuffer = fileUtils.getMedia(task.photo_path);
                if (photoBuffer) {
                    await sock.sendMessage(sender, { 
                        image: photoBuffer,
                        caption: `📷 Foto tugas: ${task.title}`
                    });
                }
            } else {
                // Try to get multiple photos
                try {
                    const taskPhotoModel = require('../utils/taskPhotoModel');
                    const photos = await taskPhotoModel.getTaskPhotos(task.id);
                    
                    if (photos && photos.length > 0) {
                        // Send message about number of photos
                        if (photos.length > 1) {
                            await sock.sendMessage(sender, { text: `📷 Tugas ini memiliki ${photos.length} foto.` });
                        }
                        
                        // Send each photo
                        for (let i = 0; i < photos.length; i++) {
                            const photoBuffer = fileUtils.getMedia(photos[i]);
                            if (photoBuffer) {
                                await sock.sendMessage(sender, { 
                                    image: photoBuffer,
                                    caption: `📷 Foto tugas ${i+1}/${photos.length}: ${task.title}`
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error fetching task photos:", err);
                }
            }
            return;
        }
        
        // Handle selesai.X command (for users to mark tasks as completed)
        else if (action === 'selesai') {
            if (!commandValidator.hasPermission(user.role, 'markTaskDone')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            const taskIndex = parseInt(target) - 1; // Convert from 1-based to 0-based index
            if (isNaN(taskIndex) || taskIndex < 0) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                return;
            }
            
            // Get all tasks first to find the task by index
            const tasks = await taskModel.getTasksForUser(user.id);
            
            // Check if index is out of bounds
            if (taskIndex >= tasks.length) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid. Daftar tugas hanya memiliki ' + tasks.length + ' item.' });
                return;
            }
            
            // Get the actual task by the database ID
            const taskId = tasks[taskIndex].id;
            const task = await taskModel.getTaskById(taskId);
            
            if (!task) {
                await sock.sendMessage(sender, { text: '❌ Tugas tidak ditemukan. Mungkin sudah dihapus.' });
                return;
            }
            
            const result = await taskModel.markTaskAsCompleted(taskId, user.id);
            
            if (result.success) {
                await sock.sendMessage(sender, { text: `✅ Tugas "${task.title}" telah ditandai sebagai selesai.` });
            } else {
                await sock.sendMessage(sender, { text: `⚠️ ${result.message}` });
            }
            return;
        }
        
        // Handle edit.X command (for admins to edit tasks)
        else if (action === 'edit') {
            if (!commandValidator.hasPermission(user.role, 'updateTask')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            const taskIndex = parseInt(target) - 1; // Convert from 1-based to 0-based index
            if (isNaN(taskIndex) || taskIndex < 0) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                return;
            }
            
            // Get all tasks first to find the task by index
            const tasks = await taskModel.getTasksForUser(user.id);
            
            // Check if index is out of bounds
            if (taskIndex >= tasks.length) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid. Daftar tugas hanya memiliki ' + tasks.length + ' item.' });
                return;
            }
            
            // Get the actual task by the database ID
            const taskId = tasks[taskIndex].id;
            const task = await taskModel.getTaskById(taskId);
            
            if (!task) {
                await sock.sendMessage(sender, { text: '❌ Tugas tidak ditemukan. Mungkin sudah dihapus.' });
                return;
            }
            
            // Start the edit conversation
            userStates[sender] = {
                action: 'editing_task',
                step: 'waiting_for_title',
                taskId: taskId
            };
            
            await sock.sendMessage(sender, { 
                text: `Masukkan judul baru untuk tugas "${task.title}":` 
            });
            return;
        }
        
        // Handle hapus.X command (for admins to delete tasks)
        else if (action === 'hapus' && /^\d+$/.test(target)) {
            if (!commandValidator.hasPermission(user.role, 'deleteTask')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            const taskIndex = parseInt(target) - 1; // Convert from 1-based to 0-based index
            if (isNaN(taskIndex) || taskIndex < 0) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                return;
            }
            
            // Get all tasks first to find the task by index
            const tasks = await taskModel.getTasksForUser(user.id);
            
            // Check if index is out of bounds
            if (taskIndex >= tasks.length) {
                await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid. Daftar tugas hanya memiliki ' + tasks.length + ' item.' });
                return;
            }
            
            // Get the actual task by the database ID
            const taskId = tasks[taskIndex].id;
            const task = await taskModel.getTaskById(taskId);
            
            if (!task) {
                await sock.sendMessage(sender, { text: '❌ Tugas tidak ditemukan. Mungkin sudah dihapus.' });
                return;
            }
            
            const result = await taskModel.deleteTask(taskId);
            
            if (result.success) {
                await sock.sendMessage(sender, { text: `✅ Tugas "${task.title}" telah dihapus.` });
            } else {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` });
            }
            return;
        }
        
        // Handle tambah.user command (for superadmin to add users)
        else if (action === 'tambah' && target === 'user') {
            if (!commandValidator.hasPermission(user.role, 'createUser')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            userStates[sender] = {
                action: 'adding_user',
                step: 'waiting_for_number'
            };
            
            await sock.sendMessage(sender, { text: 'Masukkan nomor telepon pengguna baru:' });
            return;
        }
        
        // Handle role.X command (for superadmin to change user roles)
        else if (action === 'role' && target) {
            if (!commandValidator.hasPermission(user.role, 'updateUserRole')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Normalize the phone number format
            let phoneNumber = target;
            if (phoneNumber.startsWith('0')) {
                // Convert 08xxxx to 628xxxx
                phoneNumber = '62' + phoneNumber.substring(1);
            }
            
            const userToUpdate = await userModel.getUserByPhoneNumber(phoneNumber);
            if (!userToUpdate) {
                await sock.sendMessage(sender, { text: `❌ Pengguna dengan nomor ${target} tidak ditemukan.` });
                return;
            }
            
            userStates[sender] = {
                action: 'changing_role',
                step: 'waiting_for_role',
                targetUser: phoneNumber,
                targetUserName: userToUpdate.name
            };
            
            await sock.sendMessage(sender, { 
                text: `Pilih role baru untuk ${userToUpdate.name} (${phoneNumber}):\n` +
                      `1. Admin\n` +
                      `2. User` 
            });
            return;
        }
        
        // Handle hapus.X command (for either users or tasks, depending on the target format)
        else if (action === 'hapus' && target) {
            // Check if target is a phone number (10-15 digits)
            if (/^\d{10,15}$/.test(target)) {
                // This is a phone number - handle user deletion
                if (!commandValidator.hasPermission(user.role, 'deleteUser')) {
                    await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                    return;
                }
                
                try {
                    // Normalize the phone number format
                    let phoneNumber = target;
                    if (phoneNumber.startsWith('0')) {
                        // Convert 08xxxx to 628xxxx
                        phoneNumber = '62' + phoneNumber.substring(1);
                    }
                    
                    const userToDelete = await userModel.getUserByPhoneNumber(phoneNumber);
                    if (!userToDelete) {
                        await sock.sendMessage(sender, { text: `❌ Pengguna dengan nomor ${target} tidak ditemukan.` });
                        return;
                    }
                    
                    // Prevent deleting oneself
                    const senderNumber = sender.split('@')[0];
                    const normalizedSender = senderNumber.startsWith('0') ? '62' + senderNumber.substring(1) : senderNumber;
                    
                    if (userToDelete.phone_number === normalizedSender) {
                        await sock.sendMessage(sender, { text: '❌ Anda tidak dapat menghapus akun Anda sendiri.' });
                        return;
                    }
                    
                    // Prevent deleting other superadmins
                    if (userToDelete.role === 'superadmin' && user.role === 'superadmin') {
                        await sock.sendMessage(sender, { text: '❌ Anda tidak dapat menghapus pengguna Super Admin lain.' });
                        return;
                    }
                    
                    userStates[sender] = {
                        action: 'deleting_user',
                        step: 'confirm_delete',
                        targetUser: phoneNumber,
                        targetUserName: userToDelete.name
                    };
                    
                    await sock.sendMessage(sender, { 
                        text: `⚠️ Anda yakin ingin menghapus pengguna ${userToDelete.name} (${phoneNumber})?\n` +
                              `Semua data terkait pengguna ini akan dihapus.\n\n` +
                              `Ketik *ya* untuk mengkonfirmasi atau ketik apa saja untuk membatalkan.` 
                    });
                } catch (error) {
                    console.error('Error preparing to delete user:', error);
                    await sock.sendMessage(sender, { 
                        text: `❌ Terjadi kesalahan saat memeriksa pengguna: ${error.message || 'Error tidak diketahui'}` 
                    });
                }
                return;
            } else {
                // This is likely a task index - handle task deletion
                if (!commandValidator.hasPermission(user.role, 'deleteTask')) {
                    await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                    return;
                }
                
                const taskIndex = parseInt(target) - 1; // Convert from 1-based to 0-based index
                if (isNaN(taskIndex) || taskIndex < 0) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                try {
                    // Get all tasks first to find the task by index
                    const tasks = await taskModel.getTasksForUser(user.id);
                    
                    // Check if index is out of bounds
                    if (taskIndex >= tasks.length) {
                        await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid. Daftar tugas hanya memiliki ' + tasks.length + ' item.' });
                        return;
                    }
                    
                    // Get the actual task by the database ID
                    const taskId = tasks[taskIndex].id;
                    const task = await taskModel.getTaskById(taskId);
                    
                    if (!task) {
                        await sock.sendMessage(sender, { text: '❌ Tugas tidak ditemukan. Mungkin sudah dihapus.' });
                        return;
                    }
                    
                    const result = await taskModel.deleteTask(taskId);
                    
                    if (result.success) {
                        await sock.sendMessage(sender, { text: `✅ Tugas "${task.title}" telah dihapus.` });
                    } else {
                        await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                    }
                } catch (error) {
                    console.error('Error deleting task:', error);
                    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat menghapus tugas.' });
                }
                return;
            }
        }
        
        // If we reach here, the command wasn't recognized
        await sock.sendMessage(sender, { text: '❌ Perintah tidak dikenali.' });
        const mainMenu = messageFormatter.formatMainMenu(user.role);
        await sock.sendMessage(sender, { text: mainMenu });
        
    } catch (error) {
        console.error('Error handling special command:', error);
        await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat memproses perintah.' });
    }
};

// Helper function to start task creation
const startTaskCreation = async (sock, sender, user) => {
    try {
        await sock.sendMessage(sender, { text: 'Masukkan judul tugas:' });
        
        userStates[sender] = {
            action: 'adding_task',
            step: 'waiting_for_title',
            userId: user.id
        };
        
        console.log('Task creation started for sender:', sender);
        console.log('userStates[sender]:', userStates[sender]);
    } catch (error) {
        console.error('Error starting task creation:', error);
        await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat memulai pembuatan tugas. Silakan coba lagi.' });
    }
};

// Export the functions for use in messageHandler.js
module.exports = {
    handleNumericMenuSelection,
    handleSpecialCommand,
    userStates
};
