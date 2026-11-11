# Admin dan Room Multiplayer

## Admin MVP

Halaman admin sementara tersedia di route utama `/`. Data demo disimpan di `localStorage` agar alur dapat diuji tanpa backend.

Fitur:

- Membuat soal pilihan ganda.
- Membuat soal isian singkat.
- Menentukan jawaban benar dan nilai soal.
- Menghapus soal dari bank soal.
- Membuat room pertandingan.
- Membuat kode room, seed kota, tema, layout, durasi, dan daftar soal.
- Menyalin kode room untuk dibagikan ke pemain.

## Kontrak room yang disarankan

Saat backend dibuat, object room dapat mengikuti bentuk berikut:

```ts
type MatchRoom = {
  code: string;
  title: string;
  matchSeed: number;
  cityTheme: string;
  layoutPreset: "suburban-grid" | "park-loop" | "crossroad";
  durationSeconds: number;
  questionIds: string[];
  status: "lobby" | "running" | "finished";
};
```

Game cukup mengirim kode room, lalu mengambil konfigurasi match dari server. Server mengembalikan `matchSeed` yang sama untuk semua pemain agar kota, obstacle, dan tempat soal identik.

## Kontrak soal

```ts
type Question = {
  id: string;
  type: "multiple-choice" | "short-answer";
  text: string;
  options?: string[];
  points: number;
  // answer sebaiknya tidak dikirim ke client sebelum jawaban diterima.
};
```

Jawaban benar sebaiknya hanya digunakan oleh server ketika memvalidasi submission. Ini mencegah pemain melihat jawaban melalui browser developer tools.

## Endpoint yang dibutuhkan berikutnya

- `POST /api/questions` — membuat soal dari admin.
- `GET /api/questions` — mengambil bank soal admin.
- `POST /api/rooms` — membuat room dan seed kota.
- `GET /api/rooms/:code` — game mengambil konfigurasi room.
- `POST /api/rooms/:code/join` — pemain bergabung.
- `POST /api/rooms/:code/answers` — mengirim jawaban dan menerima skor server.
- Realtime channel — sinkronisasi lobby, timer, posisi pemain, dan leaderboard.

## Lobby Realtime Database

Route pemain saat ini tersedia di `/play`. Setelah admin membuat room, metadata lobby ditulis ke Realtime Database pada struktur:

```text
rooms/{roomCode}/
├── meta
│   ├── code
│   ├── title
│   ├── seed
│   ├── layout
│   ├── cityTheme
│   ├── duration
│   ├── questionIds
│   └── status: "lobby"
└── players/{playerId}
    ├── name
    └── joinedAt
```

Halaman `/play` memasang listener pada `rooms/{roomCode}/players`, sehingga daftar pemain di lobby berubah secara real-time. Setiap pemain memiliki `playerId` yang disimpan di browser. `onDisconnect().remove()` membersihkan pemain ketika koneksi terputus.

Status lobby saat ini baru mendukung `lobby`. Status `running` dan `finished`, timer pertandingan, posisi karakter, serta leaderboard akan ditambahkan pada tahap game world.

Admin sekarang memiliki monitor room untuk:

- Memulai room (`running`).
- Menghentikan room (`finished`).
- Melihat jumlah pemain online.
- Melihat nama pemain dan skor sementara.
- Menghapus room beserta lobby dan data pemainnya.

Penghapusan room harus berhasil di Firestore dan Realtime Database sebelum room dihilangkan dari UI admin. Halaman pemain juga memvalidasi metadata room sebelum membuat presence, sehingga kode room yang sudah dihapus tidak dapat dipakai untuk membuat room baru secara tidak sengaja.

Karena data room disimpan di dua layanan, penghapusan manual harus dilakukan di dokumen Firestore **dan** node RTDB `rooms/{roomCode}`. Halaman `/play` melakukan validasi silang dan memantau keduanya.

Skor saat ini default `0`; penghitungan skor dari jawaban akan diimplementasikan bersama modul kuis game.

