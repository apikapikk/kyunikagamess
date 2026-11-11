# Konsep Game

## Ringkasan

Pemain berperan sebagai karakter kecil yang mengunjungi kota virtual. Di sepanjang perjalanan terdapat objek, landmark, atau NPC yang menyimpan soal. Pemain mengumpulkan soal dengan mendatangi titik tersebut, menjawabnya, lalu mendapatkan skor, progres, atau koleksi. Dalam mode multiplayer, beberapa pemain berlomba menyelesaikan soal sebanyak dan secepat mungkin.

Nama kerja: **Kyunika Games**.

Target platform: web mobile, dengan layout portrait sebagai prioritas.

## Pengalaman utama

1. Pemain membuka game dan membuat nama.
2. Pemain memilih karakter mini.
3. Pemain masuk ke kota yang dibuat dari seed sesi.
4. Pemain bergerak dengan kontrol sentuh dan mencari ikon soal.
5. Pemain mendekati titik soal lalu membuka kuis.
6. Pemain menjawab dan menerima feedback singkat.
7. Pemain melanjutkan eksplorasi untuk menyelesaikan target sesi.

## Core loop

`Jelajah kota → temukan soal → jawab secepat dan seakurat mungkin → dapat reward → lanjut mencari soal`

Eksplorasi harus tetap menjadi bagian penting. Soal tidak langsung ditampilkan sebagai daftar panjang; lokasi dan tema soal menjadi alasan pemain bergerak mengelilingi kota. Soal bukan objek yang bisa direbut: setelah ditemukan atau dijawab oleh satu pemain, soal tetap tersedia bagi pemain lain.

## Mode multiplayer

Mode utama multiplayer adalah pertandingan cepat di satu kota bersama. Pemain dapat melihat posisi atau indikator pemain lain, lalu berlomba mengumpulkan skor selama durasi pertandingan.

Aturan inti:

- Setiap pemain memiliki status penemuan dan status jawaban sendiri.
- Pemain A yang menemukan atau menjawab soal tidak mengunci soal tersebut.
- Pemain B tetap dapat mendatangi lokasi dan mengerjakan soal yang sama.
- Kecepatan dihitung dari waktu soal dibuka sampai jawaban dikirim, bukan dari siapa yang pertama menyentuh lokasi.
- Jawaban benar memberi poin; jawaban salah dapat mengurangi waktu, streak, atau memberi penalti ringan sesuai hasil playtest.
- Skor akhir menggabungkan akurasi, jumlah soal selesai, dan bonus kecepatan.

Dengan aturan ini, pemain tetap terdorong menjelajah dan bergerak cepat, tetapi tidak frustrasi karena soal diambil pemain lain.

## Alur pertandingan multiplayer

1. Pemain membuat atau bergabung ke room.
2. Semua pemain melihat lobby dan siap bermain.
3. Server membuat satu `matchSeed` dan membagikan layout kota yang sama.
4. Pertandingan dimulai dengan countdown.
5. Pemain menjelajah, menemukan soal, dan mengerjakannya secara independen.
6. Leaderboard menampilkan skor sementara secara berkala.
7. Saat timer habis, semua input soal ditutup dan hasil akhir ditampilkan.

## Perhitungan skor awal

Contoh formula yang mudah dipahami:

`score = basePoint × tingkat kesulitan + bonus_kecepatan + bonus_streak`

Bonus kecepatan perlu dibatasi agar akurasi tetap lebih penting daripada sekadar menekan jawaban secara terburu-buru. Hasil akhir sebaiknya menampilkan jumlah benar, jumlah salah, total soal, dan waktu total agar leaderboard terasa adil.

## MVP

Fokus versi pertama:

- Input nama pemain.
- Pilih satu dari beberapa karakter yang tersedia.
- Satu kota suburban kecil.
- Pergerakan karakter pada area yang aman untuk kamera mobile.
- 5–10 titik soal per sesi.
- Kuis pilihan ganda.
- Skor, jumlah soal terjawab, dan status selesai.
- Randomisasi layout menggunakan seed agar sesi dapat diulang saat debugging.
- Game shell membaca `matchSeed` dan metadata room secara real-time sebelum renderer 3D dijalankan.

Fitur yang ditunda:

- Multiplayer real-time.
- Login dan sinkronisasi cloud.
- Editor kota untuk pengguna.
- Sistem ekonomi atau item berbayar.
- Dunia tanpa batas.

## Gaya interaksi mobile

- Portrait-first, tombol besar, dan target sentuh yang mudah dijangkau ibu jari.
- Kontrol sederhana: virtual joystick atau tap-to-move; pilih salah satu setelah prototipe diuji.
- Kamera mengikuti karakter dengan sudut isometrik/third-person ringan.
- UI kuis muncul sebagai panel penuh atau bottom sheet agar soal mudah dibaca.
- Hindari teks penting yang hanya dibedakan lewat warna.
- Sediakan tombol jeda, ulangi instruksi, dan keluar dari kuis.

## Struktur sesi

Setiap sesi memiliki:

- `seed`: angka/string yang menentukan hasil randomisasi.
- `cityTheme`: tema kota yang dipakai.
- `questionSet`: kumpulan soal yang tersedia.
- `questionNodes`: posisi titik soal yang sudah lolos validasi jarak.
- `progress`: node yang sudah dikunjungi dan jawaban pemain.

Seed membuat kota berbeda-beda tetapi tetap dapat direproduksi ketika ada bug atau ketika pemain membagikan sesi tertentu.

## Reward awal

- Poin untuk jawaban benar.
- Bonus streak untuk beberapa jawaban benar berurutan.
- Badge untuk eksplorasi, misalnya menyelesaikan semua titik di satu zona.
- Koleksi tema/varian kosmetik sebagai pengembangan lanjutan.

Reward sebaiknya tidak membuat pemain yang salah langsung kehilangan sesi. Jawaban salah memberi feedback dan kesempatan belajar, lalu pemain tetap bisa melanjutkan.

