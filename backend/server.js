const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// === 1. MIDDLEWARE ===
app.use(cors()); // Mengizinkan frontend mengambil data dari backend
app.use(express.json()); // Membaca data berformat JSON dari frontend

// Mengubah folder 'uploads' menjadi folder publik.
// Jika ada file bernama "foto-123.jpg" di folder uploads,
// frontend bisa mengaksesnya di: http://localhost:5000/uploads/foto-123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// === 2. KONEKSI DATABASE MYSQL ===
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal terhubung ke MySQL:', err.message);
    } else {
        console.log('✅ Berhasil terhubung ke database cangkang_db!');
        connection.release();
    }
});


// === 3. KONFIGURASI MULTER (UPLOAD FOTO KE FOLDER) ===
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Simpan ke folder uploads/
    },
    filename: (req, file, cb) => {
        // Buat nama file unik: "gedung-timestamp.jpg"
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'gedung-' + uniqueSuffix + ext); 
    }
});
const upload = multer({ storage: storage });


// === 4. ENDPOINT API: UPLOAD FOTO GEDUNG ===
// Mengunggah maksimal 5 foto ke folder, lalu menyimpan nama file-nya ke database
app.post('/api/gedung/:id/photos', upload.array('fotos', 5), (req, res) => {
    const gedungId = req.params.id;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'Tidak ada foto yang diunggah' });
    }

    // Ambil nama filenya saja (misal: "gedung-12345.jpg")
    const values = files.map(file => [gedungId, file.filename]);

    const query = 'INSERT INTO gedung_photos (gedung_id, nama_file) VALUES ?';
    db.query(query, [values], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.status(201).json({ 
            message: 'Foto berhasil disimpan', 
            nama_file_tersimpan: files.map(f => f.filename)
        });
    });
});


// === 5. ENDPOINT API: PENCARIAN GEDUNG TERDEKAT (HAVERSINE) ===
// Frontend mengirimkan titik koordinat user (lat & lng)
app.get('/api/gedung/terdekat', (req, res) => {
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);
    const radiusMaksimal = 10; // Maksimal pencarian jarak (dalam kilometer)

    if (!userLat || !userLng) {
        return res.status(400).json({ message: 'Latitude dan Longitude wajib dikirim' });
    }

    // Query untuk menghitung jarak dan mengambil data gedung serta 1 foto utamanya
    const query = `
        SELECT g.*, 
            (SELECT nama_file FROM gedung_photos gp WHERE gp.gedung_id = g.id LIMIT 1) as foto_utama,
            (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(g.latitude)) * 
                COS(RADIANS(g.longitude) - RADIANS(?)) + 
                SIN(RADIANS(?)) * SIN(RADIANS(g.latitude))
            )) AS jarak_km 
        FROM gedung g
        HAVING jarak_km <= ?
        ORDER BY jarak_km ASC;
    `;

    db.query(query, [userLat, userLng, userLat, radiusMaksimal], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// === 5A. ENDPOINT API: REGISTER (DAFTAR AKUN BARU) ===
app.post('/api/register', (req, res) => {
    const { nama, email, password, role } = req.body;

    // Pastikan user tidak mendaftar sebagai super_admin lewat jalur ini
    const finalRole = (role === 'admin' || role === 'penyewa') ? role : 'penyewa';

    const query = 'INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)';
    db.query(query, [nama, email, password, finalRole], (err, result) => {
        if (err) {
            // Jika email sudah ada, MySQL akan mengembalikan error duplikat
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Email sudah terdaftar!' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Pendaftaran berhasil! Silakan login.' });
    });
});

// === 5B. ENDPOINT API: LOGIN ===
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT id, nama, email, role FROM users WHERE email = ? AND password = ?';
    db.query(query, [email, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        // Jika berhasil, kirim data user ke frontend
        res.json({
            message: 'Login sukses',
            user: results[0] 
        });
    });
});

// === 5C. ENDPOINT API: TAMBAH GEDUNG BARU ===
// Menerima data gedung (tanpa foto) dari Admin
app.post('/api/gedung', (req, res) => {
    const { owner_id, nama_gedung, kategori, deskripsi, harga, tipe_sewa, sisa_kamar, latitude, longitude, alamat } = req.body;

    const query = `
        INSERT INTO gedung (owner_id, nama_gedung, kategori, deskripsi, harga, tipe_sewa, sisa_kamar, latitude, longitude, alamat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(query, [owner_id, nama_gedung, kategori, deskripsi, harga, tipe_sewa, sisa_kamar, latitude, longitude, alamat], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Kembalikan ID gedung yang baru dibuat agar frontend bisa lanjut mengunggah fotonya
        res.status(201).json({ 
            message: 'Gedung berhasil ditambahkan!',
            gedung_id: result.insertId 
        });
    });
});

// === 5D. ENDPOINT API: AMBIL GEDUNG BERDASARKAN OWNER (ADMIN) ===
// Menampilkan daftar gedung hanya milik Admin yang sedang login
app.get('/api/gedung/owner/:owner_id', (req, res) => {
    const ownerId = req.params.owner_id;
    
    const query = `
        SELECT g.*, 
            (SELECT nama_file FROM gedung_photos gp WHERE gp.gedung_id = g.id LIMIT 1) as foto_utama
        FROM gedung g
        WHERE g.owner_id = ?
        ORDER BY g.created_at DESC
    `;
    
    db.query(query, [ownerId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// === 5E. ENDPOINT API: UPDATE (EDIT) GEDUNG ===
app.put('/api/gedung/:id', (req, res) => {
    const { nama_gedung, kategori, deskripsi, harga, tipe_sewa, sisa_kamar, latitude, longitude, alamat } = req.body;
    const query = `
        UPDATE gedung 
        SET nama_gedung=?, kategori=?, deskripsi=?, harga=?, tipe_sewa=?, sisa_kamar=?, latitude=?, longitude=?, alamat=? 
        WHERE id=?`;
    
    db.query(query, [nama_gedung, kategori, deskripsi, harga, tipe_sewa, sisa_kamar, latitude, longitude, alamat, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Properti berhasil diperbarui!' });
    });
});

// === 5F. ENDPOINT API: HAPUS GEDUNG ===
app.delete('/api/gedung/:id', (req, res) => {
    const query = 'DELETE FROM gedung WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        // Catatan: Karena kita memakai ON DELETE CASCADE di database, 
        // data foto & booking yang terkait dengan gedung ini akan otomatis ikut terhapus.
        res.json({ message: 'Properti berhasil dihapus!' });
    });
});

// === 5G. ENDPOINT API: AMBIL RIWAYAT BOOKING PENYEWA ===
app.get('/api/booking/penyewa/:penyewa_id', (req, res) => {
    const penyewaId = req.params.penyewa_id;
    
    // Query ini menggabungkan (JOIN) data booking dengan data gedung,
    // serta mengambil 1 foto utama dari gedung tersebut.
    const query = `
        SELECT 
            b.id as booking_id, b.status, b.tanggal_booking,
            g.id as gedung_id, g.nama_gedung, g.harga, g.tipe_sewa, g.kategori, g.alamat,
            (SELECT nama_file FROM gedung_photos gp WHERE gp.gedung_id = g.id LIMIT 1) as foto_utama,
            u.nama as nama_pemilik, u.email as email_pemilik
        FROM bookings b
        JOIN gedung g ON b.gedung_id = g.id
        JOIN users u ON g.owner_id = u.id
        WHERE b.penyewa_id = ?
        ORDER BY b.tanggal_booking DESC
    `;
    
    db.query(query, [penyewaId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// === 5H. ENDPOINT API: AMBIL SEMUA GEDUNG (UNTUK LANDING PAGE & DEFAULT PENCARIAN) ===
app.get('/api/gedung', (req, res) => {
    // Mengambil semua data gedung dari yang paling baru diupload
    const query = `
        SELECT g.*, 
            (SELECT nama_file FROM gedung_photos gp WHERE gp.gedung_id = g.id LIMIT 1) as foto_utama
        FROM gedung g
        ORDER BY g.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// === 5I. ENDPOINT API: AMBIL DETAIL 1 GEDUNG BERSERTA SEMUA FOTO ===
app.get('/api/gedung/:id', (req, res) => {
    const gedungId = req.params.id;
    
    // Ambil data gedung + data pemiliknya
    const queryGedung = `
        SELECT g.*, u.nama as nama_pemilik, u.email as email_pemilik
        FROM gedung g
        JOIN users u ON g.owner_id = u.id
        WHERE g.id = ?
    `;
    
    // Ambil semua foto gedung ini
    const queryPhotos = 'SELECT nama_file FROM gedung_photos WHERE gedung_id = ?';

    db.query(queryGedung, [gedungId], (err, resultsGedung) => {
        if (err) return res.status(500).json({ error: err.message });
        if (resultsGedung.length === 0) return res.status(404).json({ message: 'Properti tidak ditemukan' });

        db.query(queryPhotos, [gedungId], (err, resultsPhotos) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const gedung = resultsGedung[0];
            gedung.fotos = resultsPhotos.map(p => p.nama_file); // Gabungkan array foto ke objek gedung
            res.json(gedung);
        });
    });
});

// === 5J. ENDPOINT API: AJUKAN SEWA (BOOKING) ===
app.post('/api/booking', (req, res) => {
    const { gedung_id, penyewa_id } = req.body;

    // Cek apakah user ini sudah mengajukan sewa di properti ini dan statusnya masih pending
    const checkQuery = 'SELECT id FROM bookings WHERE gedung_id = ? AND penyewa_id = ? AND status = "pending"';
    db.query(checkQuery, [gedung_id, penyewa_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            return res.status(400).json({ message: 'Anda sudah memiliki pengajuan sewa yang sedang menunggu konfirmasi untuk properti ini.' });
        }
        
        // Masukkan data booking baru
        const insertQuery = 'INSERT INTO bookings (gedung_id, penyewa_id) VALUES (?, ?)';
        db.query(insertQuery, [gedung_id, penyewa_id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Berhasil mengajukan sewa! Silakan pantau di Dashboard Anda.' });
        });
    });
});

// === 5K. ENDPOINT API: AMBIL DAFTAR PERMINTAAN SEWA MASUK UNTUK ADMIN (PEMILIK) ===
app.get('/api/booking/admin/:owner_id', (req, res) => {
    const ownerId = req.params.owner_id;
    
    // Gabungkan tabel booking, gedung (untuk tahu kos mana), dan user (untuk tahu siapa penyewanya)
    const query = `
        SELECT b.id as booking_id, b.status, b.tanggal_booking,
               g.nama_gedung, g.kategori,
               u.nama as nama_penyewa, u.email as email_penyewa
        FROM bookings b
        JOIN gedung g ON b.gedung_id = g.id
        JOIN users u ON b.penyewa_id = u.id
        WHERE g.owner_id = ?
        ORDER BY b.tanggal_booking DESC
    `;
    
    db.query(query, [ownerId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// === 5L. ENDPOINT API: UPDATE STATUS BOOKING (SETUJUI / TOLAK) ===
app.put('/api/booking/:id/status', (req, res) => {
    const { status } = req.body; // Berisi 'disetujui' atau 'ditolak'
    const bookingId = req.params.id;

    const query = 'UPDATE bookings SET status = ? WHERE id = ?';
    db.query(query, [status, bookingId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // (Opsional Logika Cerdas): Jika disetujui, kita bisa kurangi sisa kamar otomatis
        if (status === 'disetujui') {
            const queryKurangiKamar = `
                UPDATE gedung g 
                JOIN bookings b ON g.id = b.gedung_id 
                SET g.sisa_kamar = g.sisa_kamar - 1 
                WHERE b.id = ? AND g.sisa_kamar > 0
            `;
            db.query(queryKurangiKamar, [bookingId]); // Eksekusi secara background
        }

        res.json({ message: `Permintaan sewa berhasil ${status}!` });
    });
});

// === 6. JALANKAN SERVER ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server Cangkang Backend berjalan di http://localhost:${PORT}`);
});