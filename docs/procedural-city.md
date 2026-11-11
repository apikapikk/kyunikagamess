# Rancangan Kota Semi-Prosedural

## Apakah kota bisa dibuat random?

Bisa. Dengan aset city kit yang tersedia, kota dapat dibuat berbeda setiap sesi dengan mengacak kombinasi bangunan, jalan, path, pagar, tanaman, dan warna tekstur. Untuk menjaga kualitas, pendekatan yang disarankan adalah **semi-prosedural**, bukan random penuh.

Random penuh dapat menghasilkan jalan buntu, bangunan bertumpuk, titik soal yang sulit dijangkau, atau kamera yang membingungkan. Semi-prosedural memakai aturan tetap lalu mengacak pilihan di dalam aturan tersebut.

## Pipeline pembuatan kota

1. Buat grid atau zona dasar.
2. Tentukan jalur utama yang selalu terhubung dari spawn ke area tujuan.
3. Tambahkan jalur samping dari pilihan `path-short`, `path-long`, atau batu.
4. Isi blok kota dengan variasi `building-type-a` sampai `building-type-u`.
5. Tambahkan driveway, pagar, planter, dan pohon sebagai dekorasi.
6. Validasi agar objek tidak saling bertabrakan dan jalur tetap dapat dilewati.
7. Tempatkan titik soal pada node yang dapat dijangkau.
8. Validasi jarak minimum antar titik soal dan jarak dari spawn.
9. Simpan seed dan hasil layout untuk kebutuhan replay/debugging.
10. Bagikan `matchSeed` yang sama ke semua pemain dalam pertandingan.

## Parameter randomisasi

Contoh parameter yang dapat diubah per sesi:

| Parameter | Contoh nilai | Tujuan |
|---|---:|---|
| Seed | `20261102` | Membuat hasil random dapat diulang |
| Ukuran grid | 6 × 6 | Mengatur luas kota |
| Jumlah bangunan | 10–18 | Mengatur kepadatan |
| Jumlah titik soal | 5–10 | Menentukan durasi sesi |
| Rasio jalur samping | 20–40% | Mengatur pilihan rute |
| Kepadatan dekorasi | rendah/sedang/tinggi | Mengatur performa dan tampilan |
| Variasi tekstur | A/B/C | Memberi identitas visual sesi |

## Aturan kualitas minimum

- Spawn pemain selalu berada di area kosong.
- Ada satu jalur utama yang tidak terputus.
- Setiap titik soal terhubung dengan jalur yang bisa dilalui.
- Tidak ada dua titik soal terlalu berdekatan.
- Titik soal tidak diletakkan di belakang bangunan atau pagar.
- Jumlah objek dibatasi agar frame rate tetap nyaman di mobile.
- Layout yang gagal validasi dibuang dan dibuat ulang dengan seed yang sama plus counter percobaan.
- Layout pertandingan harus identik untuk semua pemain, tetapi status soal dan progress tetap disimpan per pemain.

## Soal bersama, progress personal

Posisi soal adalah bagian dari kota dan sama untuk semua pemain. Namun, soal tidak memiliki status global seperti `claimed` atau `completed` yang dapat mengunci pemain lain. Gunakan status terpisah untuk setiap pemain, misalnya:

```text
match
├── shared city layout
├── shared question nodes
└── player progress
    ├── player A: discovered, answered
    ├── player B: discovered
    └── player C: unanswered
```

Dengan model ini, dua pemain dapat berdiri di lokasi yang sama dan mengerjakan soal yang sama tanpa saling menunggu atau kehilangan kesempatan.

## Variasi yang aman untuk MVP

Mulai dari tiga preset layout, lalu tambahkan randomisasi ringan:

- **Suburban Grid** — jalan berbentuk kotak dengan bangunan di tiap blok.
- **Park Loop** — jalur memutar mengelilingi area taman kecil.
- **Crossroad** — satu persimpangan besar dengan jalur pendek ke beberapa cluster rumah.

Setiap preset menggunakan aset yang sama, tetapi urutan bangunan, dekorasi, tekstur, dan posisi soal berbeda.

## Rekomendasi teknis aset

Gunakan format GLB untuk runtime web karena lebih praktis untuk dimuat sebagai satu paket model dan material. FBX dapat dipertahankan sebagai sumber cadangan untuk proses 3D, tetapi jangan jadikan format utama di browser.

Load aset berdasarkan kebutuhan area, bukan memuat seluruh city kit sekaligus. Untuk mobile, pertimbangkan pengurangan jumlah objek, jarak render, dan penggunaan model dekorasi yang lebih sederhana.

