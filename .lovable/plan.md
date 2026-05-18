# Rencana Perubahan

Aplikasi akan diubah cukup besar. Berikut ringkasannya:

## 1. Aktifkan Lovable Cloud (backend)
Saat ini semua data disimpan di browser (`localStorage`). Akan diganti ke Lovable Cloud supaya:
- Data tersimpan permanen & bisa diakses lintas perangkat
- Dosen bisa membuat sesi di laptop, mahasiswa scan dari HP
- Autentikasi pakai email + password yang aman

## 2. Struktur database (di Lovable Cloud)
- `profiles` — data user (nama, username, role, nim, email)
- `user_roles` — peran (admin/dosen/mahasiswa) — terpisah demi keamanan
- `students` — daftar mahasiswa (NIM, nama)
- `sessions` — sesi absensi (judul matakuliah, kode unik untuk barcode/QR, dibuat oleh dosen, status open/closed)
- `attendances` — catatan kehadiran (session_id, student_id, status: Hadir/Izin/Sakit/Alpa, waktu)

RLS aktif di semua tabel sesuai peran.

## 3. Login: email ATAU username
- Form login terima 1 field "Email atau Username" + password
- Kalau input mengandung `@` → login langsung pakai email
- Kalau username → cari email-nya di `profiles`, lalu login pakai email itu
- Admin default dibuat otomatis saat setup (email + password ditampilkan ke user)

## 4. Admin kelola password mahasiswa
Di panel admin:
- Tambah mahasiswa → otomatis dibuatkan akun (username = NIM, email auto `nim@kampus.local`, password ditentukan admin saat membuat)
- Tombol "Reset Password" pada tiap mahasiswa → admin set password baru
- Sama untuk akun dosen

## 5. Absensi pakai QR Code (bukan kode ketik)
- **Dosen**: buat sesi → aplikasi generate QR code besar di layar (berisi kode unik sesi). Dosen tinggal tampilkan ke kelas.
- **Mahasiswa**: tombol "Scan QR" → buka kamera HP/laptop → scan QR dosen → otomatis tercatat **Hadir**, tanpa input apapun.
- Untuk Izin/Sakit: ada menu terpisah "Ajukan Izin/Sakit" dengan pilih sesi aktif + lampirkan keterangan (opsional).
- Library: `qrcode.react` (generate QR) + `@zxing/browser` (scan kamera).

## 6. Yang HILANG dari versi sekarang
- Semua data lokal (mahasiswa, sesi, akun) akan **direset** karena pindah ke database baru. Admin perlu input ulang daftar mahasiswa (atau saya siapkan tombol "Isi 30 mahasiswa contoh").
- Input kode manual diganti scan QR (tetap tampilkan kode di bawah QR sebagai fallback kalau kamera gagal? — saya akan tetap sediakan input manual sebagai cadangan).

## Catatan teknis
- Lovable Cloud = Supabase di balik layar, tidak perlu akun terpisah
- Tabel `user_roles` terpisah dari profiles → cegah privilege escalation
- Function `has_role()` SECURITY DEFINER untuk RLS tanpa rekursi
- Email auto seperti `2024001@kampus.local` cuma supaya Supabase Auth bisa pakai (mahasiswa tidak perlu tahu)

---

**Pertanyaan singkat sebelum saya jalankan:**
1. Domain email auto untuk mahasiswa: pakai `@kampus.local` atau ada domain kampus asli yang ingin dipakai?
2. Saat scan QR berhasil — langsung set **Hadir** tanpa konfirmasi, atau tampilkan tombol "Konfirmasi Hadir" dulu?
3. Boleh saya **reset semua data lokal** yang ada sekarang (semua akan pindah ke database kosong)?

Atau bilang saja "lanjut pakai default" dan saya pakai: `@kampus.local`, langsung Hadir tanpa konfirmasi, reset data lama.