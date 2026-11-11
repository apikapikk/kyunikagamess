# Game World

## Game shell saat ini

Route `/game?room={roomCode}` menjadi halaman pertandingan setelah admin menekan **Mulai room**. Halaman ini membaca data dari Realtime Database:

- `rooms/{roomCode}/meta` untuk status, seed, layout, tema, durasi, dan daftar soal.
- `rooms/{roomCode}/players` untuk leaderboard sementara dan jumlah pemain online.

Scene game sekarang memakai `components/CityCanvas.tsx` dan memuat model GLB city kit serta mini character dari `public/assets/3d-assets/`. Posisi bangunan, pohon, karakter, dan titik soal ditentukan secara deterministik oleh `seed`.

## Kontrak renderer berikutnya

Renderer 3D harus menerima object berikut tanpa perlu mengetahui detail Firebase:

```ts
type CitySceneConfig = {
  seed: number;
  layout: string;
  theme: string;
  questionCount: number;
};
```

Dengan kontrak ini, generator kota dapat memilih model GLB bangunan, jalan, obstacle, dan titik soal berdasarkan seed yang sama untuk semua pemain.

## Kontrol prototype

Game sekarang menggunakan layar immersive fullscreen. Prototype desktop menggunakan `WASD` atau arrow keys, sedangkan mobile memakai tombol arah virtual. Avatar memakai model `character-male-a.glb`. Kamera memakai controller internal tanpa pointer capture sehingga dapat diputar dengan mouse drag atau swipe tanpa error gesture. Kota diperluas dengan grid bangunan, jalan tambahan, pohon, dan path. Timer menampilkan countdown ketika room berstatus `running`. Collision dengan bangunan belum aktif.

Posisi pemain disimpan di `rooms/{roomCode}/players/{playerId}/position` dan avatar pemain lain dirender dari data tersebut. Sinkronisasi sementara memakai interval maksimal 100 ms saat pemain bergerak; interpolation dan validasi server masih menjadi pekerjaan lanjutan.

## Rencana lanjutan

1. Tambahkan karakter pilihan pemain.
2. Tambahkan kontrol touch dan sinkronisasi posisi dengan throttling.
3. Jadikan titik soal interaktif dan hubungkan ke bank soal Firestore.
4. Tambahkan collision/pathfinding agar pemain tidak menembus bangunan.
