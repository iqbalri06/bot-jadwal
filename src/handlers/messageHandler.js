const userModel = require('../database/userModel');
const taskModel = require('../database/taskModel');
const fileUtils = require('../utils/fileUtils');
const messageFormatter = require('../utils/messageFormatter');
const commandValidator = require('../utils/commandValidator');
const moment = require('moment');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { handleNumericMenuSelection, handleSpecialCommand, userStates } = require('./menuHandlers');
const taskCreator = require('../utils/taskCreator');

const messageHandler = async (msg, sock) => {
    try {
        // Check if message is valid
        if (!msg || !msg.key || !msg.key.remoteJid) {
            console.error('Received invalid message format:', msg);
            return;
        }
        
        // Extract the sender's information
        const sender = msg.key.remoteJid;
        
        // Skip messages from groups or status updates
        if (sender.includes('@g.us') || sender.includes('status@broadcast')) {
            return;
        }
        
        // Check for different message types
        const hasImageMessage = !!msg.message?.imageMessage;
        
        // Get message content
        const messageContent = msg.message?.conversation || 
                              msg.message?.extendedTextMessage?.text || 
                              (hasImageMessage ? msg.message.imageMessage.caption || '' : '');
        
        // Log message type for debugging
        console.log(`Received message from ${sender}:`, {
            hasText: !!messageContent.trim(),
            hasImage: hasImageMessage,
            messageTypes: Object.keys(msg.message || {})
        });
        
        // Skip empty messages (unless they contain an image)
        if (!messageContent.trim() && !hasImageMessage) {
            console.log('Skipping empty message');
            return;
        }
        
        // Check if user exists in database, if not start registration
        const phoneNumber = sender.split('@')[0];
        let user = await userModel.getUserByPhoneNumber(phoneNumber);
        
        // Check for Super Admin phone number with both formats (with or without country code)
        const superAdminPhoneWithoutCode = '085155349970';
        const superAdminPhoneWithCode = '6285155349970';
        
        // Normalize phone number format for comparison
        const normalizedPhone = phoneNumber.startsWith('62') ? phoneNumber : 
                               (phoneNumber.startsWith('0') ? '62' + phoneNumber.substring(1) : phoneNumber);
        
        const normalizedSuperAdmin = superAdminPhoneWithoutCode.startsWith('0') ? 
                                    '62' + superAdminPhoneWithoutCode.substring(1) : superAdminPhoneWithoutCode;
                                    
        console.log(`Phone check: Received=${phoneNumber}, Normalized=${normalizedPhone}, SuperAdmin=${normalizedSuperAdmin}`);
        
        // If this is the super admin number but no account found, try the alternative format
        if (!user && (phoneNumber === superAdminPhoneWithoutCode || phoneNumber === superAdminPhoneWithCode)) {
            // Try alternative format
            const alternativePhone = phoneNumber === superAdminPhoneWithoutCode ? 
                                    superAdminPhoneWithCode : superAdminPhoneWithoutCode;
            
            console.log(`Trying alternative phone format: ${alternativePhone}`);
            user = await userModel.getUserByPhoneNumber(alternativePhone);
            
            // If user still not found, create the super admin account
            if (!user) {
                try {
                    user = await userModel.createUser(phoneNumber, 'Super Admin', 'superadmin');
                    console.log(`Auto-created Super Admin account for ${phoneNumber}`);
                    await sock.sendMessage(sender, { 
                        text: '✅ Selamat datang, Super Admin! Anda telah diidentifikasi sebagai Super Admin.\n\nGunakan *menu* untuk melihat pilihan menu.'
                    });
                    const mainMenu = messageFormatter.formatMainMenu('superadmin');
                    await sock.sendMessage(sender, { text: mainMenu });
                    return;
                } catch (error) {
                    console.error('Error auto-registering super admin:', error);
                }
            } else {
                // Found user with alternative format, notify and update the format
                console.log(`Found Super Admin with alternative format: ${alternativePhone}`);
                try {
                    // Update the phone number to current format using userModel
                    await userModel.updatePhoneNumber(user.id, phoneNumber);
                    user.phone_number = phoneNumber;
                    console.log(`Updated Super Admin phone format to: ${phoneNumber}`);
                } catch (error) {
                    console.error('Error updating super admin phone format:', error);
                }
            }
        }
        
        if (!user) {
            // For new users, prompt them to register with their name
            if (!userStates[sender] || userStates[sender].action !== 'registering') {
                userStates[sender] = {
                    action: 'registering',
                    step: 'waiting_for_name'
                };
                await sock.sendMessage(sender, { 
                    text: 'Selamat datang! Anda belum terdaftar.\n\nSilakan masukkan nama Anda untuk mendaftar:' 
                });
                return;
            } else if (userStates[sender].action === 'registering' && userStates[sender].step === 'waiting_for_name') {
                // User is responding with their name
                const name = messageContent.trim();
                if (name.length < 3) {
                    await sock.sendMessage(sender, { text: 'Nama terlalu pendek. Silakan masukkan nama yang valid (minimal 3 karakter):' });
                    return;
                }
                
                try {
                    user = await userModel.createUser(phoneNumber, name, 'user');
                    delete userStates[sender]; // Clear registration state
                    await sock.sendMessage(sender, { 
                        text: `✅ Selamat datang, ${name}! Anda telah berhasil terdaftar sebagai pengguna bot.` 
                    });
                    
                    // Send main menu after successful registration
                    const mainMenu = messageFormatter.formatMainMenu('user');
                    await sock.sendMessage(sender, { text: mainMenu });
                    return;
                } catch (error) {
                    console.error('Error registering user:', error);
                    await sock.sendMessage(sender, { 
                        text: '❌ Terjadi kesalahan saat mendaftarkan Anda. Silakan coba lagi nanti.' 
                    });
                    delete userStates[sender]; // Clear registration state on error
                    return;
                }
            }
            
            return; // End registration handling
        }
        
        // Handle ongoing conversations (state-based)
        if (userStates[sender]) {
            console.log(`Processing state for ${sender}:`, userStates[sender]);
            const result = await handleUserState(msg, sock, sender, user, userStates);
            console.log(`State processing result:`, result);
            if (result && result.handled) return;
        }
        
        // Handle menu commands or shortcut commands
        const input = messageContent.toLowerCase().trim();
        
        // Main menu command
        if (input === 'menu' || input === '0') {
            const mainMenu = messageFormatter.formatMainMenu(user.role);
            await sock.sendMessage(sender, { text: mainMenu });
            return;
        }
        
        // Handle numeric menu selections
        if (/^\d+$/.test(input)) {
            await handleNumericMenuSelection(parseInt(input), msg, sock, sender, user);
            return;
        }
        
        // Handle special format commands like detail.1, selesai.1, etc.
        if (input.includes('.')) {
            const [action, target] = input.split('.');
            await handleSpecialCommand(action, target, msg, sock, sender, user);
            return;
        }
        
        // Parse traditional command if not handled above
        const { command, args } = commandValidator.parseCommand(messageContent);
        
        // If not a recognized input, show main menu
        if (!command) {
            const mainMenu = messageFormatter.formatMainMenu(user.role);
            await sock.sendMessage(sender, { text: mainMenu });
            return;
        }
        
        // Handle legacy commands for backward compatibility
        await handleCommand(command, args, msg, sock, sender, user);
        
    } catch (error) {
        console.error('Error handling message:', error);
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan. Silakan coba lagi.' });
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }
};

// Handle user state (for multi-step interactions)
const handleUserState = async (msg, sock, sender, user, userStates) => {
    const state = userStates[sender];
    if (!state) {
        console.error(`No state found for sender ${sender} even though userStates[sender] was truthy`);
        return { handled: false };
    }
    
    // Check message types
    const hasImageMessage = !!msg.message?.imageMessage;
    
    // Get text content from appropriate field
    const messageContent = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          (hasImageMessage ? msg.message.imageMessage.caption || '' : '');
    
    console.log(`Handling state for ${sender}:`, state);
    console.log(`Message content: "${messageContent}"`);
    
    
    switch (state.action) {
        case 'user_menu':
            if (state.step === 'waiting_for_selection') {
                const selection = parseInt(messageContent.trim());
                
                // Handle user menu selection
                if (selection === 1) {
                    // View all users
                    try {
                        const users = await userModel.getAllUsers();
                        const formattedMessage = messageFormatter.formatUserList(users);
                        await sock.sendMessage(sender, { text: formattedMessage });
                    } catch (error) {
                        console.error('Error getting users:', error);
                        await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil daftar pengguna.' });
                    }
                    
                    // Keep the same state for further actions
                    return { handled: true };
                } else if (selection === 2) {
                    // Add new user
                    userStates[sender] = {
                        action: 'adding_user',
                        step: 'waiting_for_number'
                    };
                    
                    await sock.sendMessage(sender, { text: 'Masukkan nomor telepon pengguna baru:' });
                    return { handled: true };
                } else if (selection === 3) {
                    // Change user role
                    await sock.sendMessage(sender, { 
                        text: 'Untuk mengubah role pengguna, silakan ketik *role.nomor* (contoh: role.628123456789)'
                    });
                    
                    // Show the user list for reference
                    try {
                        const users = await userModel.getAllUsers();
                        const formattedMessage = messageFormatter.formatUserList(users);
                        await sock.sendMessage(sender, { text: formattedMessage });
                    } catch (error) {
                        console.error('Error getting users:', error);
                    }
                    return { handled: true };
                } else if (selection === 4) {
                    // Delete user
                    await sock.sendMessage(sender, { 
                        text: 'Untuk menghapus pengguna, silakan ketik *hapus.nomor* (contoh: hapus.628123456789)'
                    });
                    
                    // Show the user list for reference
                    try {
                        const users = await userModel.getAllUsers();
                        const formattedMessage = messageFormatter.formatUserList(users);
                        await sock.sendMessage(sender, { text: formattedMessage });
                    } catch (error) {
                        console.error('Error getting users:', error);
                    }
                    return { handled: true };
                } else if (selection === 0) {
                    // Return to main menu
                    delete userStates[sender];
                    const mainMenu = messageFormatter.formatMainMenu(user.role);
                    await sock.sendMessage(sender, { text: mainMenu });
                    return { handled: true };
                } else {
                    await sock.sendMessage(sender, { text: '❌ Pilihan tidak valid. Silakan pilih menu yang tersedia.' });
                    const userMenu = messageFormatter.formatUserMenu();
                    await sock.sendMessage(sender, { text: userMenu });
                    return { handled: true };
                }
            }
            break;
            
        case 'adding_user':
            if (state.step === 'waiting_for_number') {
                const phoneNumber = messageContent.trim();
                
                // Validate phone number
                if (!commandValidator.validatePhoneNumber(phoneNumber)) {
                    await sock.sendMessage(sender, { text: '❌ Format nomor telepon tidak valid. Silakan coba lagi:' });
                    return { handled: true };
                }
                
                // Check if user already exists
                const existingUser = await userModel.getUserByPhoneNumber(phoneNumber);
                if (existingUser) {
                    await sock.sendMessage(sender, { text: '❌ Pengguna dengan nomor tersebut sudah terdaftar. Silakan coba nomor lain:' });
                    return { handled: true };
                }
                
                // Store the phone number and move to the next step
                state.phoneNumber = phoneNumber;
                state.step = 'waiting_for_name';
                await sock.sendMessage(sender, { text: 'Masukkan nama pengguna:' });
                return { handled: true };
            } else if (state.step === 'waiting_for_name') {
                const name = messageContent.trim();
                if (!name) {
                    await sock.sendMessage(sender, { text: '❌ Nama tidak boleh kosong. Silakan masukkan nama:' });
                    return { handled: true };
                }
                
                state.name = name;
                state.step = 'waiting_for_role';
                await sock.sendMessage(sender, { 
                    text: 'Pilih role pengguna:\n1. Admin\n2. User' 
                });
                return { handled: true };
            } else if (state.step === 'waiting_for_role') {
                const selection = messageContent.trim();
                let role;
                
                if (selection === '1' || selection.toLowerCase() === 'admin') {
                    role = 'admin';
                } else if (selection === '2' || selection.toLowerCase() === 'user') {
                    role = 'user';
                } else {
                    await sock.sendMessage(sender, { text: '❌ Pilihan tidak valid. Pilih 1 untuk Admin atau 2 untuk User:' });
                    return { handled: true };
                }
                
                try {
                    // Create the new user
                    await userModel.createUser(state.phoneNumber, state.name, role);
                    await sock.sendMessage(sender, { 
                        text: `✅ Pengguna ${state.name} (${state.phoneNumber}) berhasil ditambahkan sebagai ${role}.`
                    });
                    
                    // Clear the state and return to main menu
                    delete userStates[sender];
                    const mainMenu = messageFormatter.formatMainMenu(user.role);
                    await sock.sendMessage(sender, { text: mainMenu });
                } catch (error) {
                    console.error('Error registering user:', error);
                    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mendaftarkan pengguna baru.' });
                    delete userStates[sender];
                }
                return { handled: true };
            }
            break;
        
        case 'changing_role':
            if (state.step === 'waiting_for_role') {
                const selection = messageContent.trim();
                let newRole;
                
                if (selection === '1' || selection.toLowerCase() === 'admin') {
                    newRole = 'admin';
                } else if (selection === '2' || selection.toLowerCase() === 'user') {
                    newRole = 'user';
                } else {
                    await sock.sendMessage(sender, { text: '❌ Pilihan tidak valid. Pilih 1 untuk Admin atau 2 untuk User:' });
                    return { handled: true };
                }
                
                try {
                    const result = await userModel.updateUserRole(state.targetUser, newRole);
                    
                    if (result.success) {
                        await sock.sendMessage(sender, { 
                            text: `✅ Role pengguna ${state.targetUserName || state.targetUser} berhasil diubah menjadi ${newRole}.`
                        });
                    } else {
                        await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                    }
                    
                    // Clear the state and return to main menu
                    delete userStates[sender];
                    const mainMenu = messageFormatter.formatMainMenu(user.role);
                    await sock.sendMessage(sender, { text: mainMenu });
                } catch (error) {
                    console.error('Error updating user role:', error);
                    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengubah role pengguna.' });
                    delete userStates[sender];
                }
                return { handled: true };
            }
            break;
            
        case 'deleting_user':
            if (state.step === 'confirm_delete') {
                const response = messageContent.toLowerCase().trim();
                
                if (response === 'ya') {
                    try {
                        // First check if user exists
                        const userToDelete = await userModel.getUserByPhoneNumber(state.targetUser);
                        
                        if (!userToDelete) {
                            await sock.sendMessage(sender, { text: `❌ Pengguna dengan nomor ${state.targetUser} tidak ditemukan.` });
                        } else {
                            // Try to delete the user
                            const result = await userModel.deleteUser(state.targetUser);
                            
                            if (result.success) {
                                await sock.sendMessage(sender, { text: `✅ Pengguna ${state.targetUserName || userToDelete.name} (${state.targetUser}) berhasil dihapus.` });
                            } else {
                                await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                            }
                        }
                    } catch (error) {
                        console.error('Error deleting user:', error);
                        await sock.sendMessage(sender, { 
                            text: `❌ Terjadi kesalahan saat menghapus pengguna: ${error.message || 'Error tidak diketahui'}`
                        });
                    }
                } else {
                    await sock.sendMessage(sender, { text: '❌ Penghapusan pengguna dibatalkan.' });
                }
                
                // Clear the state and return to main menu
                delete userStates[sender];
                const mainMenu = messageFormatter.formatMainMenu(user.role);
                await sock.sendMessage(sender, { text: mainMenu });
                return { handled: true };
            }
            break;
        
        case 'adding_task':
            if (state.step === 'waiting_for_title') {
                const title = messageContent.trim();
                if (!title) {
                    await sock.sendMessage(sender, { text: '❌ Judul tidak boleh kosong. Silakan masukkan judul tugas:' });
                    return { handled: true };
                }
                
                // Store title and move to the next step
                state.title = title;
                state.step = 'waiting_for_deadline';
                
                await sock.sendMessage(sender, { text: 'Masukkan deadline tugas (format: DD-MM-YYYY):' });
                console.log(`Stored title "${title}" and waiting for deadline`);
                return { handled: true };
                
            } else if (state.step === 'waiting_for_deadline') {
                const deadlineText = messageContent.trim();
                
                // Validate date format
                const date = moment(deadlineText, 'DD-MM-YYYY');
                if (!date.isValid()) {
                    await sock.sendMessage(sender, { 
                        text: '❌ Format tanggal tidak valid. Gunakan format DD-MM-YYYY. Silakan coba lagi:' 
                    });
                    return { handled: true };
                }
                
                state.deadline = date.format('YYYY-MM-DD');
                state.step = 'waiting_for_image';
                state.photos = []; // Initialize array for multiple photos
                
                await sock.sendMessage(sender, { 
                    text: 'Silakan kirim foto tugas. Anda dapat mengirimkan beberapa foto secara bergantian.\n\nKetik "selesai" jika sudah selesai mengirim foto atau "skip" untuk melanjutkan tanpa foto.' 
                });
                return { handled: true };
                
            } else if (state.step === 'waiting_for_image') {
                // Add detailed logging about the received message
                console.log('Received message in waiting_for_image state:', JSON.stringify({
                    hasImage: !!msg.message.imageMessage,
                    messageTypes: Object.keys(msg.message || {}),
                    mimeType: msg.message?.imageMessage?.mimetype
                }));
                
                // Check for text commands
                if (msg.message.conversation) {
                    const command = msg.message.conversation.toLowerCase().trim();
                    
                    // If user wants to finish adding photos
                    if (command === 'selesai') {
                        try {
                            const taskPhotoModel = require('../utils/taskPhotoModel');
                            
                            // Check if we have photos
                            if (state.photos && state.photos.length > 0) {
                                // Create task with multiple photos
                                console.log('Creating task with photos:', {
                                    title: state.title,
                                    deadline: state.deadline,
                                    photos: state.photos,
                                    userId: user.id
                                });
                                
                                const createdTask = await taskPhotoModel.createTaskWithPhotos(
                                    state.title,
                                    state.deadline,
                                    state.photos,
                                    user.id
                                );
                                
                                console.log('Task created successfully:', createdTask);
                                
                                // Confirm to user
                                await sock.sendMessage(sender, { text: `✅ Tugas "${state.title}" berhasil dibuat dengan ${state.photos.length} foto.` });
                            } else {
                                // Create task without photos
                                console.log('Creating task without photos:', {
                                    title: state.title,
                                    deadline: state.deadline,
                                    userId: user.id
                                });
                                
                                const createdTask = await taskModel.createTask(
                                    state.title,
                                    state.deadline,
                                    null,
                                    user.id
                                );
                                
                                console.log('Task created successfully:', createdTask);
                                
                                // Confirm to user
                                await sock.sendMessage(sender, { text: `✅ Tugas "${state.title}" berhasil dibuat tanpa foto.` });
                            }
                            
                            // Clear the state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        } catch (error) {
                            console.error('Error creating task:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal membuat tugas: ${error.message}.\n\nSilakan coba lagi.` 
                            });
                            return { handled: true };
                        }
                    }
                    // If user wants to skip adding photos
                    else if (command === 'skip') {
                        try {
                            // Create task without image
                            console.log('Creating task without image (skip command):', {
                                title: state.title,
                                deadline: state.deadline,
                                userId: user.id
                            });
                            
                            const createdTask = await taskModel.createTask(
                                state.title,
                                state.deadline,
                                null,
                                user.id
                            );
                            
                            console.log('Task created successfully:', createdTask);
                            
                            // Confirm to user
                            await sock.sendMessage(sender, { text: `✅ Tugas "${state.title}" berhasil dibuat tanpa foto.` });
                            
                            // Clear the state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        } catch (error) {
                            console.error('Error creating task:', error);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal membuat tugas: ${error.message}.\n\nSilakan coba lagi.` 
                            });
                            return { handled: true };
                        }
                    }
                }
                
                // Handle image message - detect properly even without caption
                if (hasImageMessage) {
                    try {
                        console.log('Attempting to download image...');
                        let stream;
                        
                        // Use a timeout to prevent hanging downloads
                        const downloadPromise = downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            { logger: console }
                        );
                        
                        // Create a timeout promise
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Download timed out after 30 seconds')), 30000);
                        });
                        
                        try {
                            // Race the download against the timeout
                            stream = await Promise.race([downloadPromise, timeoutPromise]);
                            console.log('Image downloaded successfully, size:', stream.length);
                        } catch (downloadError) {
                            console.error('Error downloading media:', downloadError);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal mengunduh gambar: ${downloadError.message}.\n\nSilakan coba kirim ulang dengan ukuran file yang lebih kecil.` 
                            });
                            return { handled: true };
                        }
                        
                        if (!stream || !Buffer.isBuffer(stream)) {
                            console.error('Downloaded stream is not a valid buffer:', stream);
                            await sock.sendMessage(sender, { 
                                text: `❌ Format gambar tidak valid. Silakan coba kirim ulang dengan format JPG/PNG.` 
                            });
                            return { handled: true };
                        }
                        
                        // Check file size limit (5MB)
                        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
                        if (stream.length > MAX_FILE_SIZE) {
                            console.error(`Image too large: ${stream.length} bytes`);
                            await sock.sendMessage(sender, { 
                                text: `❌ Ukuran gambar terlalu besar (${(stream.length / (1024 * 1024)).toFixed(2)}MB). Maksimal 5MB.\n\nSilakan kompres gambar dan coba lagi.` 
                            });
                            return { handled: true };
                        }
                        
                        // Save the image
                        console.log('Saving image to disk...');
                        let imagePath;
                        try {
                            imagePath = await fileUtils.saveMedia(stream, `task_${Date.now()}.jpg`);
                            console.log('Image saved at path:', imagePath);
                        } catch (saveError) {
                            console.error('Error saving media:', saveError);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal menyimpan gambar: ${saveError.message}.\n\nSilakan coba kirim ulang.` 
                            });
                            return { handled: true };
                        }
                        
                        // Add to the photos array
                        if (!state.photos) state.photos = [];
                        state.photos.push(imagePath);
                        
                        // Confirm to user
                        await sock.sendMessage(sender, { text: `✅ Foto #${state.photos.length} berhasil ditambahkan.\n\nKirim foto lainnya atau ketik "selesai" jika sudah selesai.` });
                        return { handled: true };
                    } catch (error) {
                        console.error('Error processing task image:', error);
                        console.error('Error stack:', error.stack);
                        
                        // More detailed error message and keeping the state
                        await sock.sendMessage(sender, { 
                            text: `❌ Gagal menyimpan foto tugas: ${error.message}.\n\nSilakan kirim foto lagi, atau ketik "selesai" untuk membuat tugas dengan foto yang sudah ada, atau ketik "skip" untuk melanjutkan tanpa foto.` 
                        });
                        // Don't delete the state, give user another chance
                        return { handled: true };
                    }
                } else {
                    await sock.sendMessage(sender, { 
                        text: `Silakan kirim foto tugas, ketik "selesai" untuk menyelesaikan, atau ketik "skip" untuk melanjutkan tanpa foto.` 
                    });
                    return { handled: true };
                }
            }
            break;
            
        case 'editing_task':
            // Handle the various steps of editing a task
            if (state.step === 'waiting_for_title') {
                state.newTitle = messageContent.trim();
                state.step = 'waiting_for_deadline';
                
                await sock.sendMessage(sender, { 
                    text: `Masukkan deadline baru untuk tugas (format: DD-MM-YYYY):` 
                });
                return { handled: true };
                
            } else if (state.step === 'waiting_for_deadline') {
                const deadlineText = messageContent.trim();
                
                // Validate date format
                const date = moment(deadlineText, 'DD-MM-YYYY');
                if (!date.isValid()) {
                    await sock.sendMessage(sender, { 
                        text: `❌ Format tanggal tidak valid. Gunakan format DD-MM-YYYY. Silakan coba lagi.` 
                    });
                    return { handled: true };
                }
                
                state.newDeadline = date.format('YYYY-MM-DD');
                state.step = 'waiting_for_image_decision';
                
                await sock.sendMessage(sender, { 
                    text: `Apakah Anda ingin mengubah foto? Ketik "ya" untuk mengubah, "tidak" untuk tetap menggunakan foto yang ada, atau "hapus" untuk menghapus foto.` 
                });
                return { handled: true };
                
            } else if (state.step === 'waiting_for_image_decision') {
                const decision = messageContent.toLowerCase().trim();
                
                if (decision === 'ya') {
                    state.step = 'waiting_for_image';
                    await sock.sendMessage(sender, { 
                        text: `Silakan kirim foto baru untuk tugas ini:` 
                    });
                    return { handled: true };
                    
                } else if (decision === 'tidak') {
                    // Update task without changing the photo
                    try {
                        await taskModel.updateTask(
                            state.taskId,
                            state.newTitle,
                            state.newDeadline
                        );
                        
                        await sock.sendMessage(sender, { 
                            text: `✅ Tugas berhasil diperbarui.` 
                        });
                        
                        // Clear state and show main menu
                        delete userStates[sender];
                        const mainMenu = messageFormatter.formatMainMenu(user.role);
                        await sock.sendMessage(sender, { text: mainMenu });
                        return { handled: true };
                    } catch (error) {
                        console.error('Error updating task:', error);
                        await sock.sendMessage(sender, { 
                            text: `❌ Gagal memperbarui tugas. Silakan coba lagi.` 
                        });
                        delete userStates[sender];
                        return { handled: true };
                    }
                    
                } else if (decision === 'hapus') {
                    // Update task and remove photo
                    try {
                        await taskModel.updateTask(
                            state.taskId,
                            state.newTitle,
                            state.newDeadline,
                            null
                        );
                        
                        await sock.sendMessage(sender, { 
                            text: `✅ Tugas berhasil diperbarui dan foto dihapus.` 
                        });
                        
                        // Clear state and show main menu
                        delete userStates[sender];
                        const mainMenu = messageFormatter.formatMainMenu(user.role);
                        await sock.sendMessage(sender, { text: mainMenu });
                        return { handled: true };
                    } catch (error) {
                        console.error('Error updating task and removing photo:', error);
                        await sock.sendMessage(sender, { 
                            text: `❌ Gagal memperbarui tugas. Silakan coba lagi.` 
                        });
                        delete userStates[sender];
                        return { handled: true };
                    }
                } else {
                    await sock.sendMessage(sender, { 
                        text: `Pilihan tidak valid. Ketik "ya", "tidak", atau "hapus".` 
                    });
                    return { handled: true };
                }
                
            } else if (state.step === 'waiting_for_image') {
                if (hasImageMessage) {
                    try {
                        console.log('Attempting to download image for task edit...');
                        let stream;
                        
                        // Use a timeout to prevent hanging downloads
                        const downloadPromise = downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            { logger: console }
                        );
                        
                        // Create a timeout promise
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Download timed out after 30 seconds')), 30000);
                        });
                        
                        try {
                            // Race the download against the timeout
                            stream = await Promise.race([downloadPromise, timeoutPromise]);
                            console.log('Image downloaded successfully, size:', stream.length);
                        } catch (downloadError) {
                            console.error('Error downloading media:', downloadError);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal mengunduh gambar: ${downloadError.message}.\n\nTugas diperbarui tanpa mengubah foto.` 
                            });
                            
                            // Update task without new image
                            await taskModel.updateTask(
                                state.taskId,
                                state.newTitle,
                                state.newDeadline,
                                null // Keep existing image
                            );
                            
                            // Clear state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        }
                        
                        // Check file size and format
                        if (!stream || !Buffer.isBuffer(stream)) {
                            console.error('Downloaded stream is not a valid buffer:', stream);
                            await sock.sendMessage(sender, { 
                                text: `❌ Format gambar tidak valid. Tugas diperbarui tanpa mengubah foto.` 
                            });
                            
                            // Update task without changing image
                            await taskModel.updateTask(
                                state.taskId,
                                state.newTitle,
                                state.newDeadline,
                                null // Keep existing image
                            );
                            
                            // Clear state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        }
                        
                        // Check file size limit (5MB)
                        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
                        if (stream.length > MAX_FILE_SIZE) {
                            console.error(`Image too large: ${stream.length} bytes`);
                            await sock.sendMessage(sender, { 
                                text: `❌ Ukuran gambar terlalu besar (${(stream.length / (1024 * 1024)).toFixed(2)}MB). Maksimal 5MB. Tugas diperbarui tanpa mengubah foto.` 
                            });
                            
                            // Update task without new image
                            await taskModel.updateTask(
                                state.taskId,
                                state.newTitle,
                                state.newDeadline,
                                null // Keep existing image
                            );
                            
                            // Clear state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        }
                        
                        // Save the image
                        let imagePath;
                        try {
                            imagePath = await fileUtils.saveMedia(stream, `task_${Date.now()}.jpg`);
                        } catch (saveError) {
                            console.error('Error saving media:', saveError);
                            await sock.sendMessage(sender, { 
                                text: `❌ Gagal menyimpan foto: ${saveError.message}. Tugas diperbarui tanpa mengubah foto.` 
                            });
                            
                            // Update task without new image
                            await taskModel.updateTask(
                                state.taskId,
                                state.newTitle,
                                state.newDeadline,
                                null // Keep existing image
                            );
                            
                            // Clear state and show main menu
                            delete userStates[sender];
                            const mainMenu = messageFormatter.formatMainMenu(user.role);
                            await sock.sendMessage(sender, { text: mainMenu });
                            return { handled: true };
                        }
                        
                        // Update the task
                        await taskModel.updateTask(
                            state.taskId,
                            state.newTitle,
                            state.newDeadline,
                            imagePath
                        );
                        
                        // Confirm to user
                        await sock.sendMessage(sender, { 
                            text: `✅ Tugas berhasil diperbarui dengan foto baru.` 
                        });
                        
                        // Clear state and show main menu
                        delete userStates[sender];
                        const mainMenu = messageFormatter.formatMainMenu(user.role);
                        await sock.sendMessage(sender, { text: mainMenu });
                        return { handled: true };
                    } catch (error) {
                        console.error('Error processing task image update:', error);
                        await sock.sendMessage(sender, { 
                            text: `❌ Gagal menyimpan foto tugas: ${error.message}. Tugas diperbarui tanpa mengubah foto.` 
                        });
                        
                        try {
                            // Try to update task without the image if there was an error
                            await taskModel.updateTask(
                                state.taskId,
                                state.newTitle,
                                state.newDeadline,
                                null // Keep existing image
                            );
                        } catch (updateError) {
                            console.error('Error updating task after image failure:', updateError);
                        }
                        
                        delete userStates[sender];
                        const mainMenu = messageFormatter.formatMainMenu(user.role);
                        await sock.sendMessage(sender, { text: mainMenu });
                        return { handled: true };
                    }
                } else {
                    await sock.sendMessage(sender, { 
                        text: `Silakan kirim foto untuk tugas ini:` 
                    });
                    return { handled: true };
                }
            }
            break;
    }
    
    return { handled: false };
};

// Handle specific commands
const handleCommand = async (command, args, msg, sock, sender, user) => {
    switch (command) {
        case 'help':
            const helpMessage = messageFormatter.formatHelpMessage(user.role);
            await sock.sendMessage(sender, { text: helpMessage });
            break;
            
        case 'tasks':
            // Permission: All users can view tasks
            if (!commandValidator.hasPermission(user.role, 'viewTasks')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            try {
                const tasks = await taskModel.getTasksForUser(user.id);
                const formattedMessage = messageFormatter.formatTaskList(tasks);
                await sock.sendMessage(sender, { text: formattedMessage });
            } catch (error) {
                console.error('Error getting tasks:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil daftar tugas.' });
            }
            break;
            
        case 'task':
            // Permission: All users can view task details
            if (!commandValidator.hasPermission(user.role, 'viewTasks')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const taskExpectedArgs = commandValidator.getExpectedArgs('task');
            const taskValidation = commandValidator.validateCommand(command, args, taskExpectedArgs);
            
            if (!taskValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${taskValidation.errors.join('\n')}` });
                return;
            }
            
            try {
                // Get all tasks first
                const tasks = await taskModel.getAllTasks();
                const taskIndex = parseInt(args[0]) - 1;
                
                if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                const task = await taskModel.getTaskById(tasks[taskIndex].id);
                
                // For admin and superadmin, also get the completion status
                let users = null;
                if (user.role === 'admin' || user.role === 'superadmin') {
                    users = await taskModel.getTaskCompletionStatus(task.id);
                }
                
                const formattedMessage = messageFormatter.formatTaskDetail(task, users, user.role);
                await sock.sendMessage(sender, { text: formattedMessage });
                
                // Check for single photo (old format) or multiple photos (new format)
                if (task.photo_path) {
                    try {
                        // Handle legacy single photo path
                        const photoBuffer = fileUtils.getMedia(task.photo_path);
                        if (photoBuffer) {
                            await sock.sendMessage(sender, {
                                image: photoBuffer,
                                caption: `📷 Foto tugas: ${task.title}`
                            });
                        } else {
                            console.log(`Warning: Photo not found at path ${task.photo_path}`);
                        }
                    } catch (photoError) {
                        console.error('Error sending task photo:', photoError);
                        await sock.sendMessage(sender, { text: '⚠️ Tidak dapat menampilkan foto tugas.' });
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
                            
                            // Send each photo with better error handling
                            for (let i = 0; i < photos.length; i++) {
                                try {
                                    const photoPath = photos[i];
                                    const photoBuffer = fileUtils.getMedia(photoPath);
                                    
                                    if (photoBuffer) {
                                        await sock.sendMessage(sender, { 
                                            image: photoBuffer,
                                            caption: `📷 Foto tugas ${i+1}/${photos.length}: ${task.title}`
                                        });
                                    } else {
                                        console.log(`Warning: Photo not found at path ${photoPath}`);
                                    }
                                } catch (photoError) {
                                    console.error(`Error sending photo ${i+1}:`, photoError);
                                    await sock.sendMessage(sender, { text: `⚠️ Tidak dapat menampilkan foto tugas ${i+1}.` });
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Error fetching task photos:", err);
                        await sock.sendMessage(sender, { text: '⚠️ Terjadi kesalahan saat mengambil foto-foto tugas.' });
                    }
                }
            } catch (error) {
                console.error('Error getting task details:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil detail tugas.' });
            }
            break;
            
        case 'done':
            // Permission: All users can mark tasks as done
            if (!commandValidator.hasPermission(user.role, 'markTaskDone')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const doneExpectedArgs = commandValidator.getExpectedArgs('done');
            const doneValidation = commandValidator.validateCommand(command, args, doneExpectedArgs);
            
            if (!doneValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${doneValidation.errors.join('\n')}` });
                return;
            }
            
            try {
                // Get all tasks first
                const tasks = await taskModel.getAllTasks();
                const taskIndex = parseInt(args[0]) - 1;
                
                if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                const result = await taskModel.markTaskAsCompleted(tasks[taskIndex].id, user.id);
                
                if (result.success) {
                    await sock.sendMessage(sender, { text: `✅ Tugas "${tasks[taskIndex].title}" telah ditandai sebagai selesai.` });
                } else {
                    await sock.sendMessage(sender, { text: `⚠️ ${result.message}` });
                }
            } catch (error) {
                console.error('Error marking task as completed:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat menandai tugas sebagai selesai.' });
            }
            break;
            
        case 'add':
            // Permission: Only admin and superadmin can add tasks
            if (!commandValidator.hasPermission(user.role, 'createTask')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // For adding tasks, we'll use a multi-step process
            await sock.sendMessage(sender, { text: 'Masukkan judul tugas:' });
            
            userStates[sender] = {
                action: 'adding_task',
                step: 'waiting_for_title'
            };
            
            // The rest of the process is handled in a conversation flow
            break;
            
        case 'edit':
            // Permission: Only admin and superadmin can edit tasks
            if (!commandValidator.hasPermission(user.role, 'updateTask')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const editExpectedArgs = commandValidator.getExpectedArgs('edit');
            const editValidation = commandValidator.validateCommand(command, args, editExpectedArgs);
            
            if (!editValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${editValidation.errors.join('\n')}` });
                return;
            }
            
            try {
                // Get all tasks first
                const tasks = await taskModel.getAllTasks();
                const taskIndex = parseInt(args[0]) - 1;
                
                if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                // Start the edit conversation
                userStates[sender] = {
                    action: 'editing_task',
                    step: 'waiting_for_title',
                    taskId: tasks[taskIndex].id
                };
                
                await sock.sendMessage(sender, { 
                    text: `Masukkan judul baru untuk tugas "${tasks[taskIndex].title}":` 
                });
            } catch (error) {
                console.error('Error starting task edit process:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat memulai proses edit tugas.' });
            }
            break;
            
        case 'delete':
            // Permission: Only admin and superadmin can delete tasks
            if (!commandValidator.hasPermission(user.role, 'deleteTask')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const deleteExpectedArgs = commandValidator.getExpectedArgs('delete');
            const deleteValidation = commandValidator.validateCommand(command, args, deleteExpectedArgs);
            
            if (!deleteValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${deleteValidation.errors.join('\n')}` });
                return;
            }
            
            try {
                // Get all tasks first
                const tasks = await taskModel.getAllTasks();
                const taskIndex = parseInt(args[0]) - 1;
                
                if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                const taskToDelete = tasks[taskIndex];
                const result = await taskModel.deleteTask(taskToDelete.id);
                
                if (result.success) {
                    await sock.sendMessage(sender, { text: `✅ Tugas "${taskToDelete.title}" telah dihapus.` });
                } else {
                    await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat menghapus tugas.' });
            }
            break;
            
        case 'status':
            // Permission: Only admin and superadmin can view task completion status
            if (!commandValidator.hasPermission(user.role, 'viewTaskStatus')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const statusExpectedArgs = commandValidator.getExpectedArgs('status');
            const statusValidation = commandValidator.validateCommand(command, args, statusExpectedArgs);
            
            if (!statusValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${statusValidation.errors.join('\n')}` });
                return;
            }
            
            try {
                // Get all tasks first
                const tasks = await taskModel.getAllTasks();
                const taskIndex = parseInt(args[0]) - 1;
                
                if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
                    await sock.sendMessage(sender, { text: '❌ Nomor tugas tidak valid.' });
                    return;
                }
                
                const task = await taskModel.getTaskById(tasks[taskIndex].id);
                const users = await taskModel.getTaskCompletionStatus(task.id);
                
                const formattedMessage = messageFormatter.formatTaskDetail(task, users, user.role);
                await sock.sendMessage(sender, { text: formattedMessage });
            } catch (error) {
                console.error('Error getting task status:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil status tugas.' });
            }
            break;
            
        case 'users':
            // Permission: Only superadmin can view users list
            if (!commandValidator.hasPermission(user.role, 'viewUsers')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            try {
                const users = await userModel.getAllUsers();
                const formattedMessage = messageFormatter.formatUserList(users);
                await sock.sendMessage(sender, { text: formattedMessage });
            } catch (error) {
                console.error('Error getting users:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengambil daftar pengguna.' });
            }
            break;
            
        case 'register':
            // Permission: Only superadmin can register users
            if (!commandValidator.hasPermission(user.role, 'createUser')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const registerExpectedArgs = commandValidator.getExpectedArgs('register');
            const registerValidation = commandValidator.validateCommand(command, args, registerExpectedArgs);
            
            if (!registerValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${registerValidation.errors.join('\n')}` });
                return;
            }
            
            const newUserNumber = args[0];
            const newUserName = args[1];
            const newUserRole = args[2].toLowerCase();
            
            // Validate phone number format
            if (!commandValidator.validatePhoneNumber(newUserNumber)) {
                await sock.sendMessage(sender, { text: '❌ Format nomor telepon tidak valid.' });
                return;
            }
            
            // Validate role
            if (!['admin', 'user'].includes(newUserRole)) {
                await sock.sendMessage(sender, { text: '❌ Role tidak valid. Gunakan "admin" atau "user".' });
                return;
            }
            
            try {
                // Check if user already exists
                const existingUser = await userModel.getUserByPhoneNumber(newUserNumber);
                
                if (existingUser) {
                    await sock.sendMessage(sender, { text: '❌ Pengguna dengan nomor tersebut sudah terdaftar.' });
                    return;
                }
                
                // Create the new user
                await userModel.createUser(newUserNumber, newUserName, newUserRole);
                await sock.sendMessage(sender, { text: `✅ Pengguna ${newUserName} (${newUserNumber}) berhasil ditambahkan sebagai ${newUserRole}.` });
            } catch (error) {
                console.error('Error registering user:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mendaftarkan pengguna baru.' });
            }
            break;
            
        case 'role':
            // Permission: Only superadmin can change roles
            if (!commandValidator.hasPermission(user.role, 'updateUserRole')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const roleExpectedArgs = commandValidator.getExpectedArgs('role');
            const roleValidation = commandValidator.validateCommand(command, args, roleExpectedArgs);
            
            if (!roleValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${roleValidation.errors.join('\n')}` });
                return;
            }
            
            const userNumber = args[0];
            const newRole = args[1].toLowerCase();
            
            // Validate role
            if (!['admin', 'user'].includes(newRole)) {
                await sock.sendMessage(sender, { text: '❌ Role tidak valid. Gunakan "admin" atau "user".' });
                return;
            }
            
            try {
                // Update the user role
                const result = await userModel.updateUserRole(userNumber, newRole);
                
                if (result.success) {
                    await sock.sendMessage(sender, { text: `✅ Role pengguna ${userNumber} berhasil diubah menjadi ${newRole}.` });
                } else {
                    await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                }
            } catch (error) {
                console.error('Error updating user role:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat mengubah role pengguna.' });
            }
            break;
            
        case 'remove':
            // Permission: Only superadmin can remove users
            if (!commandValidator.hasPermission(user.role, 'deleteUser')) {
                await sock.sendMessage(sender, { text: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.' });
                return;
            }
            
            // Validate command
            const removeExpectedArgs = commandValidator.getExpectedArgs('remove');
            const removeValidation = commandValidator.validateCommand(command, args, removeExpectedArgs);
            
            if (!removeValidation.isValid) {
                await sock.sendMessage(sender, { text: `❌ ${removeValidation.errors.join('\n')}` });
                return;
            }
            
            const userToRemove = args[0];
            
            try {
                // Delete the user
                const result = await userModel.deleteUser(userToRemove);
                
                if (result.success) {
                    await sock.sendMessage(sender, { text: `✅ Pengguna ${userToRemove} berhasil dihapus.` });
                } else {
                    await sock.sendMessage(sender, { text: `❌ ${result.message}` });
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan saat menghapus pengguna.' });
            }
            break;
            
        default:
            await sock.sendMessage(sender, { text: '❌ Perintah tidak dikenali. Ketik /help untuk melihat daftar perintah.' });
    }
};

module.exports = messageHandler;
