# Bot WhatsApp Manajemen Tugas Kuliah

Bot WhatsApp untuk mengelola daftar tugas kuliah dengan sistem role super admin, admin, dan user menggunakan Baileys, Node.js, dan SQLite sebagai database.

## Fitur

### Role Super Admin
- Dapat mengatur semua hal (termasuk mengelola admin, user, dan tugas)
- CRUD tugas (buat, baca, update, hapus)
- Melihat siapa saja user yang sudah mengerjakan tugas

### Role Admin
- Bisa CRUD tugas (buat, baca, update, hapus)
- Tidak bisa mengatur role super admin atau admin lain
- Bisa melihat daftar siapa saja yang sudah mengerjakan tugas

### Role User
- Hanya bisa melihat daftar tugas
- Bisa menandai tugas yang sudah dikerjakan
- Tanda selesai bersifat personal, namun bisa dilihat oleh admin dan super admin

## Detail Tugas
- Judul (wajib)
- Deadline (wajib, berupa tanggal)
- Foto (opsional, bisa ada atau tidak)

## Database (SQLite)
- users → menyimpan data user, role (superadmin, admin, user)
- tasks → menyimpan data tugas (judul, deadline, foto opsional, dibuat oleh siapa)
- task_status → relasi user dengan tugas (status sudah dikerjakan atau belum)

## Alur Utama
1. Super admin register/mendaftarkan user dan menentukan role (admin/user)
2. Admin/Super admin menambahkan tugas baru (judul, deadline, foto opsional)
3. User melihat daftar tugas
4. User menandai tugas sudah dikerjakan
5. Admin dan Super admin bisa melihat laporan siapa saja user yang sudah menyelesaikan tugas tertentu

## Cara Menjalankan

1. Pastikan Node.js sudah terinstall
2. Clone repositori ini
3. Install dependensi dengan menjalankan:
   ```
   npm install
   ```
4. Jalankan bot dengan menjalankan:
   ```
   npm start
   ```
5. Scan QR code yang muncul pada terminal dengan WhatsApp

## Menu dan Perintah

Bot ini menggunakan sistem menu berbasis angka untuk kemudahan penggunaan.

### Menu Utama
- Ketik `menu` untuk menampilkan menu utama
- Pilih opsi dengan mengetik angka yang sesuai

### Menu Pengguna
- `1` - Lihat daftar tugas
- `2` - Bantuan
- `3` - Tandai tugas selesai (khusus user)

### Menu Admin
- `3` - Tambah tugas baru
- `4` - Edit tugas
- `5` - Hapus tugas
- `6` - Lihat status tugas

### Menu Super Admin
- `7` - Kelola pengguna
  - `1` - Lihat daftar pengguna
  - `2` - Tambah pengguna baru
  - `3` - Ubah role pengguna
  - `4` - Hapus pengguna

### Perintah Khusus
- `detail.nomor` - Lihat detail tugas (contoh: detail.1)
- `selesai.nomor` - Tandai tugas selesai (contoh: selesai.1)
- `edit.nomor` - Edit tugas (contoh: edit.1)
- `hapus.nomor` - Hapus tugas (contoh: hapus.1)
- `tambah.user` - Tambah pengguna baru
- `role.nomor` - Ubah role pengguna (contoh: role.628123456789)
- `hapus.nomor` - Hapus pengguna (contoh: hapus.628123456789)
- `0` - Kembali ke menu utama

## Dependensi

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - Library WhatsApp Web API
- [sqlite3](https://www.npmjs.com/package/sqlite3) - Library SQLite untuk Node.js
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal) - Untuk menampilkan QR code di terminal
- [moment](https://www.npmjs.com/package/moment) - Library untuk manipulasi tanggal
