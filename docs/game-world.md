# Game World

## Game shell saat ini

Route `/game?room={roomCode}` menjadi halaman pertandingan setelah admin menekan **Mulai room**. Halaman ini membaca data dari Realtime Database:

- `rooms/{roomCode}/meta` untuk status, seed, layout, tema (`mega-world`, `nature-valley`, `forest`), durasi, dan daftar soal.
- `rooms/{roomCode}/players` untuk profil pemain, skor, jawaban, dan pilihan karakter.
- `rooms/{roomCode}/positions` untuk sinkronisasi posisi pemain secara real-time.

Scene game memakai `components/CityCanvas.tsx` dengan dunia alam prosedural 3D skala **280×280** (`WORLD_LIMIT = 140.0`), tanpa aset kota Kenney.

## Arsitektur Dunia Nature (`components/CityCanvas.tsx`)

- **Terrain Prosedural Berkontur (`terrainHeight` & `NatureGround`)**:
  - Mesh terrain 440×440 (`180×180` segmen) dengan *vertex colors* yang memadukan padang rumput, dua jalur tanah berliku yang kontras (dilengkapi batu pijakan `RockPath_Round_Small` dan kerikil `C05_pebbles`), tepi pasir danau/kolam, serta perbukitan batu di tepi lembah.
  - Dua perairan alami (1 danau utama dengan dermaga `C09_pier` + 1 kolam hutan) lengkap dengan alang-alang dan teratai.
- **Ekosistem Gabungan & Collision (`useNatureWorld`)**:
  - Menggabungkan paket `ohmtap-ot39-blocky-nature` dan `Stylized Nature MegaKit[Standard]` dengan skala yang telah dinormalisasi: rumpun hutan lebat (48–68 rumpun + 28 pohon *landmark* tunggal), semak berbunga, bunga liar, pakis, semanggi, jamur, batu besar, batang kayu tumbang, dan tebing pembatas lembah.
  - Collision aktif pada batang pohon, batu/log, dan area air dalam, sementara rumput/bunga tetap dapat dilewati.
- **NPC Hewan Liar Ambient (`RoamingNpcAnimal`)**:
  - 8 hewan rigged (`deer`, `fawn`, `fox`, `sheep`, `rabbit`, `duck`, `boar`, `hedgehog`) yang berjalan santai dan sesekali berhenti di area habitat masing-masing dengan animasi kaki/kepala/ekor dan *soft collision* ringan.
- **3 Pilihan Tema Alam**:
  - `mega-world`: *Nature Mega World* (seimbang antara hutan, padang bunga, dan danau).
  - `nature-valley`: *Lembah Hijau* (lembah terbuka cerah dengan dominasi pinus dan batu).
  - `forest`: *Hutan Rimba* (kanopi hutan lebat, berkabut, penuh pakis, jamur, dan pohon rimba).
- **Karakter Hewan Voxel Rigged**:
  - Menggunakan `GLB_Rigged` dari `Voxel_Animals_Farm_Forest_Wild` dengan animasi prosedural kaki, sayap, kepala, dan ekor untuk pemain lokal maupun pemain lain (`RemotePetAvatar`).

## Monitoring Admin Real-Time (`app/admin/page.tsx`)

- `WorldMonitorMap` di dashboard admin menggabungkan data `rooms/{roomCode}/players` dan `rooms/{roomCode}/positions` secara real-time, menampilkan jalur tanah, danau, kolam, titik soal, serta posisi pemain pada skala 280×280.
