# Todo: Perbaikan Sinkronisasi Real-Time, Bank Soal Hierarki, & Monitor Siswa Admin

Dokumen rencana kerja dan daftar tugas terperinci untuk menyelesaikan laporan bug dan penambahan fitur Kyunika Games.

---

## 1. Perbaikan Bug Sinkronisasi & Presensi Pemain (Bugs 1, 2, 3)

- [x] **1.1. Perbaikan Penghapusan Data Pemain oleh `onDisconnect` & Lifecycle Room**
  - Mengubah perilaku `onDisconnect` di `app/play/page.tsx` dan `app/game/page.tsx` agar hanya mengatur `online: false` dan tidak menghapus (`remove()`) seluruh node data pemain saat navigasi tab/halaman atau refresh.
  - Memastikan saat status room berubah menjadi `finished`, data pemain tidak di-`remove()`, melainkan ditandai `online: false` agar seluruh lembar jawaban siswa tetap utuh dan dapat diperiksa admin di Room Monitor.
  - Saat pemain re-join atau me-refresh `/play`, melakukan `get(playerRef)` terlebih dahulu sebelum `update` agar nilai skor dan riwayat jawaban yang sudah dikerjakan tidak tertimpa kembali ke 0.
  - Menggunakan flag status `online: true/false` pada `rooms/{code}/players/{playerId}/online`.
- [x] **1.2. Presensi & Re-registrasi Pemain di Halaman Game (`app/game/page.tsx`)**
  - Menyimpan dan membaca `kyunika-player-name` dan `kyunika-player-id` dari `localStorage`.
  - Pada saat mount, menjalankan auto-register/update ke `rooms/{code}/players/{playerId}` dengan menyertakan `name`, `score`, `online: true`, dan `lastActive`.
  - Mengisolasi dependensi effect presensi via `playerNameRef` untuk mengeliminasi siklus unmount/remount dan flickering status `online: false`.
  - Menyinkronkan data skor dan riwayat soal yang sudah dijawab dari Realtime Database (`completedQuestions` dan `answers`) saat mount maupun refresh.
  - Sinkronisasi timer pertandingan global terpadu (`startedAt`) agar hitung mundur match tidak ter-reset setiap kali ada event pergerakan mobil 100ms di RTDB.
- [x] **1.3. Leaderboard Multiplayer Real-Time & Layar Akhir Pertandingan**
  - Listener `onValue(rooms/{roomCode}/players)` di `app/game/page.tsx` menyaring dan menampilkan semua pemain yang valid (`typeof player.name === "string" && player.name.trim().length > 0`).
  - Menampilkan urutan ranking antar-pemain secara live di UI leaderboard game (atas layar pada mobile & sidebar pada desktop).
  - Menambahkan modal podium interaktif (*Match Finished / Game Over*) saat pertandingan selesai atau waktu habis dengan ringkasan skor akhir, peringkat, dan podium top 3.
- [x] **1.4. Monitor Admin Real-Time (`app/admin/page.tsx`)**
  - Listener admin mendeteksi pemain segera setelah mereka join ke room (baik saat di lobby maupun saat bermain di `/game`).
  - Menampilkan status online/offline dan skor terbaru dari tiap pemain di panel admin secara real-time.

---

## 2. Bank Soal Berjenjang / Paket Kategori Soal (Fitur 4)

- [x] **2.1. Desain Model Data Bank Soal (`QuestionBank`)**
  - Menambahkan tipe `QuestionBank` (`id`, `title`, `description`, `createdAt`).
  - Menambahkan relasi `bankId` pada setiap `Question`.
  - Menyiapkan preset default bank soal: "Bank Umum" (`bank-umum`) dan "Matematika Lanjutan" (`bank-mtk-lanjutan`).
- [x] **2.2. Antarmuka Pengelolaan Bank Soal di Admin (`app/admin/page.tsx`)**
  - Menambahkan bar pemilih chip kategori Bank Soal di tab "Bank Soal".
  - Menambahkan formulir inline pembuatan Bank Soal baru ("Buat Bank Baru").
  - Menambahkan tombol hapus bank kustom dengan konfirmasi dan relokasi otomatis soal ke "Bank Umum".
  - Menambahkan dropdown pilihan Bank Soal target pada formulir pembuatan pertanyaan.
  - Menampilkan jumlah soal dan total poin terfilter berdasarkan Bank Soal yang aktif dipilih.
- [x] **2.3. Fitur Import Bank Soal ke Room**
  - Pada tab "Room Manager", menambahkan dropdown pemilih "Import Dari Bank Soal".
  - Hanya soal-soal dari Bank Soal terpilih yang di-attach ke `room.questionIds` dan diunggah ke `rooms/{code}/questions` di Realtime Database.
  - Kartu room dan daftar room menampilkan nama Bank Soal yang dipakai.
- [x] **2.4. Persistensi Data Bank Soal**
  - Menyimpan dan memuat data bank soal ke Firestore (`questionBanks`) serta `localStorage` (`kyunika-banks`) sebagai fallback.

---

## 3. Monitor Pengerjaan & Analisis Jawaban Siswa di Admin (Fitur 5)

- [x] **3.1. Struktur Data Jawaban Detail Pemain**
  - Di `app/game/page.tsx`, saat pemain menjawab pilihan ganda atau isian singkat, menyimpan catatan jawaban lengkap ke `rooms/{roomCode}/players/{playerId}/answers/{questionId}`:
    - `questionId`: ID butir soal
    - `questionText`: Teks pertanyaan
    - `playerAnswer`: Jawaban yang dipilih/diketik pemain
    - `correctAnswer`: Kunci jawaban
    - `isCorrect`: boolean (benar/salah)
    - `pointsAwarded`: Poin yang didapatkan
    - `answeredAt`: Timestamp waktu menjawab
- [x] **3.2. Panel Detail Jawaban Pemain di Admin (`app/admin/page.tsx`)**
  - Pada daftar pemain di Room Monitor, menambahkan accordion drawer "Lihat pengerjaan ▼".
  - Menampilkan indikator performa:
    - Status online / offline pemain
    - Jumlah soal selesai (misal: 3/5 Soal)
    - Indikator Benar (`✓ X Benar`) dan Salah (`✗ Y Salah`)
    - Skor terkini
  - Menampilkan drawer rincian butir per butir soal: status jawaban, jawaban siswa, dan kunci jawaban.
- [x] **3.3. Ringkasan Performa Kelas/Room**
  - Menampilkan bar analisis kelas (`class-analytics-bar`): Total Siswa & Online, Rata-rata Skor Kelas, Persentase Akurasi Kelas, dan Total Butir Soal Tersedia.

---

## 4. Pengujian & Verifikasi Akhir

- [x] Verifikasi sinkronisasi 2 pemain: kedua pemain tersinkron ke RTDB dan muncul di monitor admin serta leaderboard.
- [x] Verifikasi refresh browser pada pemain: nama dan skor tetap terjaga via `localStorage` dan re-registrasi RTDB.
- [x] Verifikasi hierarki Bank Soal: pembuatan bank soal baru (misal: MTK-Lanjutan) dan import eksklusif ke room.
- [x] Verifikasi pengerjaan soal: jawaban tercatat butir per butir dan dapat diinspeksi secara detail di admin.
- [x] Build check: `npm run build` berhasil 100% tanpa error TypeScript maupun linting.
- [x] Dokumentasi: `docs/log.md` diperbarui dengan ringkasan perubahan teknis.

---

## 5. Perbaikan Gameplay & Eksplorasi Soal, Kontrol Mobile, Keamanan Admin, & Ekspansi Kota

- [x] **5.1. Kunci Pembukaan Kuis dari Radar HUD (Eksplorasi Wajib)**
  - Menghapus pembukaan instan modal kuis saat chip radar soal di kanan atas di-klik (`openQuiz` dinonaktifkan dari klik radar).
  - Mengarahkan klik chip sebagai navigasi target GPS (menampilkan petunjuk arah dan jarak ke lokasi soal).
  - Memastikan modal kuis hanya dapat dibuka jika kendaraan pemain benar-benar berada dalam jarak dekat pilar soal (< 3.4 unit) via tombol proximity prompt atau keyboard `Space`.
- [x] **5.2. Penyesuaian Kontrol Mobile (Analog di Kanan, Hapus Rem)**
  - Memindahkan posisi Virtual Joystick analog ke sisi kanan bawah layar (`bottom-right`).
  - Menghapus tombol rem sentuh (`mobile-brake-btn`) dari tampilan antarmuka game.
  - Memperbarui gaya CSS `.mobile-controls-layer` agar nyaman dikendalikan dengan jempol kanan.
- [x] **5.3. Sistem Autentikasi / Kredensial Halaman Admin (`/admin`)**
  - Membuat antarmuka Login Guard di `app/admin/page.tsx` sebelum panel admin dapat diakses.
  - Menerapkan verifikasi kredensial admin (username & password) dengan penyimpanan sesi (`sessionStorage`).
  - Menambahkan tombol Logout / Keluar di sidebar admin untuk mengakhiri sesi.
- [x] **5.4. Pengurangan Kepadatan NPC Traffic**
  - Mengurangi kepadatan mobil NPC lalu lintas di `components/CityCanvas.tsx` agar tidak memadati jalan raya dan memudahkan pemain mengemudi.
- [x] **5.5. Perluasan Tata Kota Metropolitan**
  - Memperluas grid jaringan jalan menjadi 9 avenue utama (`[-80, -60, -40, -20, 0, 20, 40, 60, 80]`) dengan rentang jalan dari `-92` hingga `+92`.
  - Memperluas bidang tanah ground plane menjadi 220x220 unit dan batas tabrakan kota ke `limit = 89.0`.
  - Menambahkan titik sebaran kandidat soal dan sebaran blok perkotaan outer ring.
- [x] **5.6. Pengujian, Uji Build & Pembaruan Log**
  - Menjalankan `npm run lint` dan `npm run build` hingga lolos 100%.
  - Memperbarui `docs/log.md` dengan dokumentasi teknis menyeluruh.
