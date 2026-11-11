# Inventaris Aset

## Sumber aset

Asset root: `public/assets/3d-assets/`.

Paket utama yang terdeteksi:

### Kenney Mini Characters

Lokasi: `public/assets/3d-assets/kenney_mini-characters/`

- Karakter laki-laki: `character-male-a` sampai `character-male-f`.
- Karakter perempuan: `character-female-a` sampai `character-female-f`.
- Aksesori dan alat bantu: kacamata, masker, hearing aid, tongkat, kruk, dan kursi roda.
- Format runtime yang tersedia: GLB.
- Preview PNG tersedia untuk layar pemilihan karakter.

Rencana penggunaan:

- Tampilkan preview PNG di menu pilih karakter.
- Muat file GLB pilihan pemain ke dunia game.
- Pisahkan aksesori sebagai opsi personalisasi lanjutan bila pipeline model mendukungnya.

### Kenney City Kit Suburban 20

Lokasi: `public/assets/3d-assets/kenney_city-kit-suburban_20/`

- Bangunan: `building-type-a` sampai `building-type-u`.
- Jalur: `path-short`, `path-long`, dan variasi batu.
- Driveway dan pagar dalam beberapa ukuran.
- Tanaman: `tree-small`, `tree-large`, dan `planter`.
- Variasi material/warna: variation A, B, dan C.
- Format runtime yang tersedia: GLB.
- Preview dan sample scene tersedia untuk referensi visual.

Rencana penggunaan:

- Bangunan dan path menjadi komponen layout kota.
- Pagar, driveway, pohon, dan planter menjadi dekorasi yang diacak.
- Variasi tekstur menjadi tema visual per sesi atau per zona.

### Kenney City Kit Commercial 2.1

Lokasi: `public/assets/3d-assets/kenney_city-kit-commercial_2.1/`

- Pencakar langit (*skyscrapers*): `building-skyscraper-a` sampai `building-skyscraper-e`.
- Bangunan komersial/toko: `building-a` sampai `building-n`.
- Detail eksterior toko & kafe: kanopi (`detail-awning`, `detail-awning-wide`), payung kafe outdoor (`detail-parasol-a`, `detail-parasol-b`), overhang.
- Format runtime: GLB.

Rencana penggunaan:
- Membangun zona *Downtown Commercial District* di sepanjang Avenue Center.
- Memberikan variasi vertikal (skyline pencakar langit) dan kafe trotoar di samping zona perumahan suburban.

### Kenney Car Kit

Lokasi: `public/assets/3d-assets/kenney_car-kit/`

- Mobil: sedan, sedan-sports, suv, suv-luxury, hatchback-sports, race-future, taxi, delivery, van, police.
- Format runtime: GLB.

Rencana penggunaan:
- Kendaraan utama pemain (avatar interaktif) dan mobil lalu lintas ambient NPC.

## Catatan lisensi

Masing-masing paket memiliki `License.txt`. Lisensi perlu dibaca dan dicatat sebelum game dipublikasikan, terutama jika aset didistribusikan dalam build produksi.

## Konvensi yang disarankan

- Gunakan path GLB sebagai sumber referensi runtime.
- Jangan mengubah file vendor asli secara langsung.
- Jika perlu optimasi, buat salinan turunan dengan nama yang jelas.
- Simpan metadata mapping aset di kode/config, bukan mengandalkan nama file yang tersebar.

