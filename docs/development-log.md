# Development Log

## 2026-11-02 — Inisialisasi konsep

### Konteks

Proyek memiliki aplikasi Next.js dan asset 3D Kenney di `public/assets/3d-assets/`. Konsep awal yang dipilih adalah game kuis eksplorasi kota untuk mobile web.

### Keputusan

- Game ditargetkan untuk browser mobile dengan portrait sebagai prioritas.
- Pemain memiliki nama dan memilih karakter sebelum masuk kota.
- Soal ditempatkan sebagai node yang ditemukan melalui eksplorasi.
- Kota menggunakan pendekatan semi-prosedural agar sesi tidak selalu sama.
- Seed akan disimpan untuk membuat layout random dapat direproduksi.
- GLB diprioritaskan sebagai format aset runtime web.
- MVP dimulai dari satu tema suburban dan kuis pilihan ganda.
- Multiplayer dirancang sebagai perlombaan waktu dan skor, bukan sistem rebutan soal.
- Layout kota dan posisi soal dibagikan bersama melalui `matchSeed` yang sama.
- Status penemuan dan jawaban disimpan per pemain, sehingga soal yang sudah ditemukan tetap dapat dikerjakan pemain lain.
- Mini admin MVP dibuat di route utama untuk membuat soal pilihan ganda/isian dan generate room code.
- MVP admin memakai `localStorage`; backend dan API room menjadi tahap berikutnya.

### Temuan aset

- Tersedia enam karakter male dan enam karakter female.
- Tersedia beberapa aksesori dan alat bantu mobilitas.
- City kit menyediakan 21 tipe bangunan, komponen path, pagar, driveway, pohon, planter, serta tiga variasi tekstur.
- Preview PNG dapat dipakai untuk menu pemilihan karakter.

### Risiko yang perlu diuji

- Performa loading dan rendering GLB di perangkat mobile kelas menengah.
- Kontrol gerak yang paling nyaman: joystick virtual atau tap-to-move.
- Skala model, kamera, dan keterbacaan titik soal di layar kecil.
- Validasi collision dan pathfinding setelah layout diacak.
- Lisensi aset sebelum deployment publik.
- Sinkronisasi posisi, timer, dan leaderboard saat koneksi pemain tidak stabil.
- Validasi server agar skor dan waktu jawaban tidak dapat dimanipulasi dari client.
- Apakah indikator pemain lain membantu kompetisi atau justru membuat layar mobile terlalu ramai.

### Langkah berikutnya

1. Buat layar pemilihan nama dan karakter.
2. Pasang renderer 3D minimal dengan satu karakter dan satu area.
3. Uji kamera serta kontrol sentuh di viewport mobile.
4. Buat data soal statis dan satu titik soal interaktif.
5. Implementasikan generator layout sederhana berbasis grid dan seed.
6. Uji performa di perangkat mobile nyata.
7. Buat mock multiplayer dengan 2–4 pemain dan satu `matchSeed`.
8. Pastikan satu pemain menjawab soal tidak mengubah status soal pemain lain.
9. Tambahkan timer pertandingan dan leaderboard sementara.

