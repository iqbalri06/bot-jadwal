/**
 * Script untuk menambahkan tugas contoh ke database
 * Gunakan untuk pengujian setelah reset database
 */

const db = require('../database/database');
const taskModel = require('../database/taskModel');
const userModel = require('../database/userModel');

const addSampleTasks = async () => {
    try {
        console.log('Mencari super admin...');
        const superAdmin = await userModel.getUserByRole('superadmin');
        
        if (!superAdmin) {
            console.log('Super admin tidak ditemukan. Pastikan ada pengguna dengan role superadmin terlebih dahulu.');
            return;
        }
        
        console.log(`Menambahkan tugas contoh dengan creator: ${superAdmin.name} (${superAdmin.phone_number})`);
        
        // Tambahkan beberapa tugas contoh
        const tasks = [
            {
                title: 'Tugas Matematika',
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 hari dari sekarang
                photo_path: null
            },
            {
                title: 'Tugas Fisika',
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 hari dari sekarang
                photo_path: null
            },
            {
                title: 'Tugas Kimia',
                deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 hari dari sekarang
                photo_path: null
            }
        ];
        
        for (const task of tasks) {
            await taskModel.createTask(task.title, task.deadline, task.photo_path, superAdmin.id);
            console.log(`Tugas "${task.title}" berhasil ditambahkan.`);
        }
        
        console.log('Semua tugas contoh berhasil ditambahkan!');
    } catch (error) {
        console.error('Terjadi kesalahan saat menambahkan tugas contoh:', error);
    } finally {
        db.close();
    }
};

// Jalankan fungsi
addSampleTasks();
