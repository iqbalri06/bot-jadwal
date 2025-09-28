const moment = require('moment');

const messageFormatter = {
    // Format the main menu based on user role
    formatMainMenu: (role) => {
        let message = '🤖 *MENU UTAMA*\n\n';
        
        message += '*Pilih menu dengan mengetik angka:*\n\n';
        
        message += '1️⃣ *Lihat Daftar Tugas*\n';
        message += '2️⃣ *Bantuan*\n';
        
        // Semua role bisa menandai tugas selesai
        message += '3️⃣ *Tandai Tugas Selesai*\n';
        
        if (role === 'admin' || role === 'superadmin') {
            message += '4️⃣ *Tambah Tugas Baru*\n';
            message += '5️⃣ *Edit Tugas*\n';
            message += '6️⃣ *Hapus Tugas*\n';
            message += '7️⃣ *Lihat Status Tugas*\n';
        }
        
        if (role === 'superadmin') {
            message += '8️⃣ *Kelola Pengguna*\n';
        }
        
        message += '\n_Ketik *menu* untuk menampilkan menu ini kembali._';
        
        return message;
    },
    
    // Format user management menu for super admin
    formatUserMenu: () => {
        let message = '👥 *MENU PENGELOLAAN PENGGUNA*\n\n';
        
        message += '*Pilih menu dengan mengetik angka:*\n\n';
        message += '1️⃣ *Lihat Daftar Pengguna*\n';
        message += '2️⃣ *Tambah Pengguna Baru*\n';
        message += '3️⃣ *Ubah Role Pengguna*\n';
        message += '4️⃣ *Hapus Pengguna*\n';
        message += '0️⃣ *Kembali ke Menu Utama*\n';
        
        return message;
    },
    
    // Format the task list message
    formatTaskList: (tasks) => {
        if (!tasks || tasks.length === 0) {
            return '📋 *DAFTAR TUGAS*\n\nBelum ada tugas yang tersedia.\n\n_Ketik *0* untuk kembali ke menu utama._';
        }
        
        let message = '📋 *DAFTAR TUGAS*\n\n';
        
        tasks.forEach((task, index) => {
            const deadline = moment(task.deadline).format('DD-MM-YYYY');
            const status = task.completed ? '✅ Selesai' : '⏳ Belum selesai';
            
            message += `*${index + 1}. ${task.title}*\n`;
            message += `📅 Deadline: ${deadline}\n`;
            message += `📊 Status: ${status}\n\n`;
        });
        
        message += '_Ketik *detail.N* untuk melihat detail tugas (contoh: detail.3 untuk tugas no.3)_\n';
        message += '_Ketik *0* untuk kembali ke menu utama._';
        return message;
    },
    
    // Format the task detail message
    formatTaskDetail: (task, users = null, userRole = 'user') => {
        if (!task) {
            return '❌ Tugas tidak ditemukan.\n\n_Ketik *0* untuk kembali ke menu utama._';
        }
        
        const deadline = moment(task.deadline).format('DD-MM-YYYY');
        let message = `📝 *DETAIL TUGAS*\n\n`;
        message += `*${task.title}*\n`;
        message += `📅 Deadline: ${deadline}\n`;
        message += `👤 Dibuat oleh: ${task.creator_name || 'Unknown'}\n`;
        
        if (users) {
            message += `\n📊 *STATUS PENYELESAIAN*\n`;
            
            const completed = users.filter(u => u.completed).length;
            message += `✅ Selesai: ${completed} dari ${users.length} pengguna\n\n`;
            
            if (completed > 0) {
                message += `*Pengguna yang telah menyelesaikan:*\n`;
                users.filter(u => u.completed).forEach(user => {
                    const completedDate = moment(user.completed_at).format('DD-MM-YYYY HH:mm');
                    message += `- ${user.name} (${completedDate})\n`;
                });
            }
            
            if (users.length - completed > 0) {
                message += `\n*Pengguna yang belum menyelesaikan:*\n`;
                users.filter(u => !u.completed).forEach(user => {
                    message += `- ${user.name}\n`;
                });
            }
        }
        
        // Add action options based on role
        message += '\n*Pilihan:*\n';
        
        // Semua pengguna bisa menandai tugas selesai
        message += '_Ketik *selesai.N* untuk menandai tugas selesai (sesuai nomor tugas di daftar)_\n';
        
        if (userRole === 'admin' || userRole === 'superadmin') {
            message += '_Ketik *edit.N* untuk mengedit tugas ini (sesuai nomor tugas di daftar)_\n';
            message += '_Ketik *hapus.N* untuk menghapus tugas ini (sesuai nomor tugas di daftar)_\n';
        }
        
        message += '_Ketik *0* untuk kembali ke menu utama._';
        
        return message;
    },
    
    // Format user list message
    formatUserList: (users) => {
        if (!users || users.length === 0) {
            return '👥 *DAFTAR PENGGUNA*\n\nBelum ada pengguna yang terdaftar.\n\n_Ketik *0* untuk kembali ke menu utama._';
        }
        
        let message = '👥 *DAFTAR PENGGUNA*\n\n';
        
        // Group users by role
        const groupedUsers = {
            superadmin: users.filter(u => u.role === 'superadmin'),
            admin: users.filter(u => u.role === 'admin'),
            user: users.filter(u => u.role === 'user')
        };
        
        // Super Admin section
        if (groupedUsers.superadmin.length > 0) {
            message += '*Super Admin:*\n';
            groupedUsers.superadmin.forEach(user => {
                message += `- ${user.name} (${user.phone_number})\n`;
            });
            message += '\n';
        }
        
        // Admin section
        if (groupedUsers.admin.length > 0) {
            message += '*Admin:*\n';
            groupedUsers.admin.forEach((user, index) => {
                message += `- ${user.name} (${user.phone_number})\n`;
            });
            message += '\n';
        }
        
        // User section
        if (groupedUsers.user.length > 0) {
            message += '*User:*\n';
            groupedUsers.user.forEach((user, index) => {
                message += `- ${user.name} (${user.phone_number})\n`;
            });
        }
        
        message += '\n*Pilihan:*\n';
        message += '_Ketik *tambah.user* untuk menambah pengguna baru_\n';
        message += '_Ketik *role.nomor* untuk mengubah role pengguna (contoh: role.628123456789)_\n';
        message += '_Ketik *hapus.nomor* untuk menghapus pengguna (contoh: hapus.628123456789)_\n';
        message += '_Ketik *0* untuk kembali ke menu utama._';
        
        return message;
    },
    
    // Format help message based on user role
    formatHelpMessage: (role) => {
        let message = '🤖 *BOT MANAJEMEN TUGAS KULIAH*\n\n';
        
        message += '*Cara Penggunaan:*\n';
        message += '- Ketik *menu* untuk menampilkan menu utama\n';
        message += '- Pilih opsi dengan mengetik angka yang sesuai\n';
        message += '- Ketik *0* untuk kembali ke menu utama\n\n';
        
        message += '*Menu Semua Pengguna:*\n';
        message += '- *1* - Lihat daftar tugas\n';
        message += '- *2* - Bantuan\n';
        message += '- *3* - Tandai tugas selesai\n';
        message += '- *detail.N* - Lihat detail tugas (contoh: detail.1 untuk tugas no.1)\n';
        message += '- *selesai.N* - Menandai tugas selesai (contoh: selesai.1 untuk tugas no.1)\n\n';
        
        if (role === 'admin' || role === 'superadmin') {
            message += '*Menu Admin:*\n';
            message += '- *4* - Tambah tugas baru\n';
            message += '- *5* - Edit tugas\n';
            message += '- *6* - Hapus tugas\n';
            message += '- *7* - Lihat status tugas\n\n';
        }
        
        if (role === 'superadmin') {
            message += '*Menu Super Admin:*\n';
            message += '- *8* - Kelola pengguna\n';
            message += '  - *tambah.user* - Tambah pengguna baru\n';
            message += '  - *role.nomor* - Ubah role pengguna\n';
            message += '  - *hapus.nomor* - Hapus pengguna\n\n';
        }
        
        message += '_Ketik *0* untuk kembali ke menu utama._';
        
        return message;
    }
};

module.exports = messageFormatter;
