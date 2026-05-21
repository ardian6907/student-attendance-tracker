# AbsenKelas

Aplikasi absensi digital berbasis QR Code untuk lingkungan kampus. Dosen dapat membuat sesi absensi dengan QR Code, mahasiswa cukup scan dari kamera HP untuk tercatat hadir secara otomatis.

---

## Fitur Utama

| Peran | Fitur |
|-------|-------|
| **Admin** | Kelola akun dosen & mahasiswa, reset password, hapus akun |
| **Dosen** | Buat sesi absensi dengan QR Code, tutup/buka sesi, pantau & atur status kehadiran mahasiswa (Hadir / Izin / Sakit / Alpa) |
| **Mahasiswa** | Scan QR Code dari kamera untuk absen otomatis, lihat riwayat kehadiran |

---

## Teknologi

- **Frontend**: React 19, TanStack Start, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — autentikasi, database real-time, RLS
- **QR Code**: `qrcode.react` (generate) + `@zxing/browser` (scan kamera)
- **State**: TanStack Query

---

## Struktur Database

Tabel utama di Lovable Cloud:

| Tabel | Fungsi |
|-------|--------|
| `profiles` | Data pengguna (nama, NIM, username) |
| `user_roles` | Peran pengguna: `admin`, `dosen`, `mahasiswa` |
| `attendance_sessions` | Sesi absensi (judul matakuliah, kode QR, status buka/tutup) |
| `attendances` | Catatan kehadiran mahasiswa per sesi |

Semua tabel dilindungi Row Level Security (RLS) sesuai peran.

---

## Cara Menjalankan

1. **Install dependensi**
   ```bash
   bun install
   ```

2. **Jalankan server pengembangan**
   ```bash
   bun dev
   ```

3. **Buka di browser**
   ```
   http://localhost:3000
   ```

---

## Akun Default

Saat pertama kali dijalankan, akun admin otomatis dibuat:

- **Email**: `admin@kampus.local`
- **Password**: `admin123`

> Segera ganti password setelah login pertama.

---

## Alur Kerja

### 1. Admin
1. Login sebagai admin.
2. Tambah akun **Dosen** dan **Mahasiswa** (admin menentukan email & password awal).
3. Reset password akun jika diperlukan.

### 2. Dosen
1. Login sebagai dosen.
2. Buat sesi baru → masukkan judul matakuliah/pertemuan.
3. QR Code dan kode manual muncul di layar → tampilkan ke kelas.
4. Pantau kehadiran mahasiswa secara real-time.
5. Klik status mahasiswa (Hadir / Izin / Sakit / Alpa) untuk mengubah. Klik 2 kali pada status yang sama untuk membatalkan.
6. Klik **Tutup Sesi** untuk mengakhiri absensi.

### 3. Mahasiswa
1. Login sebagai mahasiswa.
2. Klik **Scan QR** → izinkan akses kamera.
3. Arahkan kamera ke QR Code dosen → absen tercatat otomatis sebagai **Hadir**.
4. Lihat riwayat kehadiran di dashboard.

---

## Catatan Penting

- Email saat login **harus persis sama** (case-sensitive), termasuk huruf besar/kecil.
- Kode QR sesi bersifat unik per sesi dan berlaku selama sesi belum ditutup.
- Data tersimpan di Lovable Cloud, dapat diakses lintas perangkat.

---

## Lisensi

Proyek ini dibuat untuk keperluan akademik kampus.
