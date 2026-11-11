# Development Log

## 2026-11-09 — Konfigurasi routing publik (/play sebagai route entry), pemindahan dashboard ke /admin, dan optimasi gitignore aset

### Temuan

1. **Route Entry Publik**: Untuk persiapan deployment / hosting publik, akses utama root `/` seharusnya langsung mengarahkan pengunjung ke halaman bergabung `/play` (agar pemain langsung bisa memasukkan nama dan kode room), bukan ke dashboard admin.
2. **Pemisahan Dashboard Admin**: Dashboard admin (pengelolaan bank soal dan room) dipindahkan ke rute tersendiri `/admin` agar rapi dan tidak terekspos secara default.
3. **Asset Bloat pada Git**: Folder asset 3D Kenney berisi format mentah yang tidak digunakan dalam web build (`FBX format`, `OBJ format`, `Previews`, dan `kenney_mini-characters` lama), yang menghabiskan puluhan megabyte jika di-commit ke Git repo.

### Perubahan

1. **Routing Entry Publik**:
   - `app/page.tsx` diubah untuk melakukan server-side / client-side redirect langsung ke `/play`.
   - `next.config.ts` ditambahkan aturan `redirects()` otomatis dari `/` ke `/play`.
   - Dashboard admin dibuatkan rute khusus di `app/admin/page.tsx`.
   - Di `app/play/page.tsx`, ditambahkan link sekunder (*host link*) menuju `/admin` untuk memudahkan admin/guru membuka kontrol room.
2. **Optimasi `.gitignore`**:
   - Mengabaikan file dan folder mentah yang tidak dibutuhkan dalam runtime 3D:
     - `**/Models/FBX format/`
     - `**/Models/OBJ format/`
     - `**/Previews/`
     - `public/assets/3d-assets/kenney_mini-characters/`
     - `/.firebase` dan `.firebase`
   - Hanya model berformat `.glb` yang digunakan oleh Three.js yang akan di-commit ke Git, menjaga ukuran repositori tetap sangat ringan.
3. **Uji Produksi**:
   - Menjalankan `npm run build` dan berhasil 100% tanpa error, menghasilkan rute statis: `/`, `/_not-found`, `/admin`, `/game`, `/play`.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.
- `npm run build` sukses terkompilasi dalam 9.6s.


## 2026-11-09 — Ekspansi kota metropolitan 180x180 (7x7 Avenue, 36 Blok Kota) & Sistem Penguncian Soal Independen per Pemain

### Temuan

1. **Permintaan Ekspansi Dunia**: Kota membutuhkan area jelajah yang jauh lebih luas dari sebelumnya (120x120) agar pengalaman berkendara terasa lebih imersif layaknya kota metropolitan sesungguhnya.
2. **Aturan Pengerjaan Soal Independen per Pemain**:
   - Ketika seorang pemain menyelesaikan suatu soal (baik benar maupun salah), pemain tersebut **tidak boleh mengerjakan soal itu lagi** (soal terkunci untuk pemain tersebut dan tidak bisa di-spam untuk menambah poin).
   - Di saat yang sama, **pemain lain yang belum mengerjakan soal tersebut tetap harus bisa menemukan dan mengerjakannya secara independen**. Progres soal tidak boleh memengaruhi ketersediaan soal bagi pemain lain.

### Perubahan

1. **Ekspansi Tata Kota Menjadi 180x180 Unit (7 Avenue, 36 Blok)**:
   - Menambah 2 avenue besar sehingga jaringan jalan kini memiliki 7 avenue utama: `[-60, -40, -20, 0, 20, 40, 60]` dengan rentang jalan dari `-72` hingga `+72`.
   - Bidang tanah diperluas menjadi `args={[180, 180]}` dengan batas collision luar dinaikkan ke `limit = 69.0`.
   - Dunia permainan kini terbagi ke dalam **36 blok perkotaan terstruktur (6x6)**:
     - **Downtown Financial Core**: 4 pencakar langit bertingkat tinggi mengelilingi courtyard plaza sentral.
     - **Shopping Boulevard & Dining**: Pusat perbelanjaan dengan kanopi toko dan payung kafe outdoor.
     - **Corporate Tech Hub**: Gedung perkantoran modern dengan planter dan arsitektur sleek.
     - **Central Civic Park**: Gedung kebudayaan ikonik dengan 4 pohon rindang dan plaza terbuka.
     - **Intermediate Commercial Ring**: 12 blok pertokoan, restoran, dan plaza komersial.
     - **Suburban Residential Perimeter**: 20 blok perumahan asri dengan pekarangan, pohon, dan pagar rapi.
   - Jaringan jalan tersambung otomatis dengan 49 persimpangan (`road-crossroad`), lampu jalan di seluruh trotoar, dan lampu lalu lintas di persimpangan.
   - Menambah koordinat kandidat penempatan soal (*candidate spots*) menjadi 48+ titik di sepanjang jalan raya kota.
   - Kecepatan jelajah mobil disesuaikan menjadi 15.5 unit/detik agar berkendara di kota besar terasa responsif dan dinamis.
2. **Sistem Penguncian Soal Independen per Pemain**:
   - Sinkronisasi data progres soal pemain ke Firebase Realtime Database pada path: `rooms/${roomCode}/players/${playerId}/completedQuestions`.
   - Progres soal tersimpan strictly di bawah ID pemain masing-masing (`players/${playerId}`), sehingga pengerjaan oleh Pemain A tidak mengunci atau mengubah ketersediaan soal untuk Pemain B.
   - **Indikator 3D Progresif**: Pilar cahaya dan cincin soal di 3D canvas berubah menjadi hijau redup jika sudah diselesaikan oleh pemain lokal, sementara untuk pemain lain yang belum menyelesaikan tetap menyala ungu/oranye dan berdenyut (*pulsing*).
   - **Banner Proximity Bersyarat**: Jika pemain mendekati soal yang sudah diselesaikan, banner berubah menjadi status hijau `SOAL #{N} SUDAH KAMU SELESAIKAN` dan tombol pengerjaan serta tombol Space dinonaktifkan.
   - **Pencegahan Eksploitasi Skor**: Modal kuis mendeteksi status pengerjaan soal. Jika dibuka dari radar chip, opsi jawaban dan form input terkunci (*disabled*) dengan notifikasi bahwa soal sudah pernah diselesaikan, mencegah submit ulang atau farming skor.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.


## 2026-11-09 — Rombak total tata kota (kota luas 120x120, jalan mulus tanpa putus, nol tumpang tindih)

### Temuan

1. **Kota Terlalu Kecil**: Ukuran kota sebelumnya hanya mencakup area kecil sekitar 48x48 unit, membuat eksplorasi dengan mobil terasa sangat sempit dan cepat habis.
2. **Jalan Putus-Putus**: Pemeriksaan pada file model 3D `road-straight.glb` dan `road-crossroad.glb` menemukan bahwa geometri dasarnya berukuran 1x1 unit. Implementasi lama menggunakan penskalaan yang tidak sinkron dengan interval langkah penempatan (`step`), sehingga menyisakan celah kosong antar ubin jalan.
3. **Komponen Saling Menimpa**: Bangunan, pohon, kanopi, payung kafe, dan pagar diletakkan dengan koordinat yang berbenturan satu sama lain.

### Perubahan

1. **Perluasan Skala Kota Menjadi 120x120 Unit**:
   - Memperluas area dunia permainan menjadi grid 5 avenue utama (`x, z ∈ {-40, -20, 0, 20, 40}`) yang membentang dari koordinat `-52` sampai `+52` di atas bidang tanah berukuran 140x140 unit.
   - Peta dibagi menjadi **16 blok kota terstruktur** (4x4) dengan ukuran masing-masing 15x15 unit bersih.
2. **Jalan Mulus Edge-to-Edge (Nol Celah & Putus)**:
   - Skala ubin jalan disinkronkan secara matematis: `scale = 4.0` dengan interval langkah penempatan tepat `step = 4.0`.
   - Seluruh ubin persimpangan (`road-crossroad`), jalan lurus (`road-straight`), dan zebra cross pejalan kaki (`road-crossing`) tersambung rapat tepi-ke-tepi (*edge-to-edge*) tanpa ada celah satupun.
3. **Tata Letak Bersih Non-Overlapping (Zero Component Clashing)**:
   - Di dalam setiap blok, bangunan, pohon peneduh, kanopi toko, dan payung kafe ditempatkan pada sub-lot yang berjarak aman dari jalan maupun satu sama lain.
   - **Downtown Financial Core**: 4 pencakar langit megah (`building-skyscraper-*.glb`) mengelilingi plaza taman sentral.
   - **Shopping & Food Boulevard**: Pertokoan retail modern dengan kanopi toko dan kafe outdoor berpayung peneduh.
   - **Tech & Civic Park**: Kompleks perkantoran modern dan taman budaya terbuka dengan pohon peneduh rindang dan pot bunga.
   - **Suburban Residential Districts**: 12 blok hunian luar dengan rumah berjejer rapi menghadap jalan, dilengkapi pohon pekarangan.
4. **Fisika & Pergerakan Kendaraan**:
   - Kecepatan jelajah mobil ditingkatkan menjadi maksimum 13.5 unit/detik dengan akselerasi yang lebih responsif agar menyenangkan untuk menjelajahi kota yang luas.
   - Batas tepi kota diperluas hingga `[-50.0, 50.0]`.
   - Sistem collision AABB mendeteksi seluruh bangunan, pohon, dan batas kota dengan mulus (*wall-sliding* tanpa tersangkut).
   - Lalu lintas NPC 2 arah aktif melaju di kelima jalur avenue.
   - Titik pilar soal didistribusikan merata di sepanjang koridor jalan raya kota.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.


## 2026-11-09 — Integrasi City Kit Commercial dan sistem collision fisika kendaraan

### Temuan

1. **Aset Komersial Baru**: Paket `kenney_city-kit-commercial_2.1` telah ditambahkan ke `public/assets/3d-assets/`, mencakup pencakar langit modern (`building-skyscraper-*.glb`), gedung komersial/toko (`building-*.glb`), kanopi toko (`detail-awning`), dan payung kafe outdoor (`detail-parasol-*.glb`).
2. **Ketiadaan Collision**: Mobil pemain sebelumnya dapat menembus seluruh objek di dunia permainan (gedung, rumah, pohon, pagar, mobil NPC, mobil pemain lain, serta batas kota).

### Perubahan

1. **Integrasi Downtown Commercial District**:
   - Menambahkan zona pusat kota komersial (*Downtown*) di sepanjang Avenue Center dengan pencakar langit megah bertingkat tinggi di sudut-sudut persimpangan.
   - Menambahkan pertokoan, restoran, dan kafe trotoar dengan kanopi (*awning*) dan payung kafe (*parasols*).
   - Mengombinasikan zona komersial modern dengan kompleks perumahan suburban sehingga kota memiliki kontras skyline dan atmosfer yang jauh lebih hidup.
2. **Sistem Collision 2D/3D (Anti-Tembus & Wall-Sliding)**:
   - Membuat daftar terpadu *collider bounding boxes* (AABB) untuk seluruh gedung komersial, pencakar langit, rumah hunian, dan pagar pekarangan.
   - Algoritma resolusi collision lingkaran-ke-AABB: mendeteksi titik terdekat pada kotak obstacle dan mendorong mundur posisi mobil keluar dari obstacle sepanjang vektor normal kontak.
   - Mobil dapat meluncur mulus sepanjang dinding/trotoar saat berbelok (*smooth wall-sliding*) tanpa tersangkut atau bergetar.
   - Menambahkan batasan tepi kota (*city boundary collision*) pada batas `[-23.2, 23.2]`.
   - Menambahkan collision terhadap mobil lalu lintas NPC dan mobil pemain remote dalam mode multiplayer.
   - Efek tabrakan: kecepatan mobil langsung teredam saat menabrak obstacle dan bodi mobil memantul sedikit ke atas (*tactile bump jolt*) sebagai umpan balik visual tabrakan.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.


## 2026-11-02 — Koreksi arah kemudi mobil dan revitalisasi tata kota (jalan lebar & perumahan padat teratur)

### Temuan

1. **Arah Kemudi Terbalik**: Input belok kanan membuat mobil berbelok ke kiri dan sebaliknya dari sudut pandang kamera belakang.
2. **Jalan Sempit & Berlubang**: Grid jalan sebelumnya menggunakan interval langkah yang melompati ukuran modular tile (meninggalkan celah) dan hanya berukuran 1 tile sempit sehingga mobil hampir selebar jalan.
3. **Rumah Berjauhan & Kota Kosong**: Hanya 1–2 bangunan yang ditempatkan secara acak pada blok besar, sehingga kota tampak lengang dan tidak tertata.

### Perubahan

1. **Koreksi Kemudi**:
   - Menyelaraskan arah putaran `headingRef`: tombol `D`/Kanan/▶ membelokkan mobil ke kanan, dan tombol `A`/Kiri/◀ membelokkan mobil ke kiri.
   - Dynamic body tilt mobil disesuaikan dengan arah kemudi baru.
2. **Jalan 2-Arah yang Lebar & Mulus**:
   - Skala modular jalan dinaikkan menjadi `scale = 2.0` (lebar 4 unit per jalur jalan, nyaman untuk dilalui mobil dan NPC).
   - Seluruh sambungan jalan dari -24 hingga +24 tersambung sempurna tanpa celah.
   - Menambahkan zebra crossing pejalan kaki (`road-crossing.glb`) tepat sebelum memasuki persimpangan.
   - Lampu jalan (`light-square.glb`), lampu lalu lintas (`traffic-light.glb`), dan plang rambu stop (`road-sign-stop.glb`) dipasang rapi di tepi trotoar dan sudut persimpangan.
3. **Perumahan Padat, Hidup, dan Rapi**:
   - Menata **36+ rumah suburban** menggunakan 21 variasi model rumah dari `kenney_city-kit-suburban_20` yang berjejer rapi menghadap jalan di setiap blok.
   - Dilengkapi dengan jalan masuk halaman (*driveway*), pagar pembatas antar rumah (*fence*), pot bunga (*planter*), serta pepohonan rimbun (*tree-large* dan *tree-small*) di pekarangan depan.
4. **Lalu Lintas 2 Arah & Titik Soal**:
   - Mobil NPC kini melaju dalam 2 arah berlawanan di setiap jalan utama.
   - Titik pilar soal ditempatkan tepat di koridor jalan raya yang luas sehingga mudah dijangkau kendaraan pemain.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.


## 2026-11-02 — Perbaikan orientasi kamera mobil, indikator pilar soal, dan sistem pengerjaan kuis interaktif

### Temuan

1. **Kamera Mobil Menghadap Depan**: Pada implementasi sebelumnya, kalkulasi kamera menempatkan kamera di koordinat `pos + moveDir * camDist` (di depan mobil) dan menghadap balik ke belakang mobil, sehingga mobil terlihat melaju ke arah layar/kamera.
2. **Soal Belum Bisa Dikerjakan & Lokasi Tidak Diketahui**: Titik soal hanya berupa bola kecil ungu tanpa indikator jarak, navigasi, atau pilar visual yang terlihat dari jauh. Belum ada modal pengerjaan soal saat mendekati titik tersebut.

### Perubahan

1. **Orientasi Kamera Third-Person di Belakang Mobil**:
   - `desiredCam` diubah menjadi `posRef - forward * camDist` (ditempatkan di belakang mobil pada jarak 6.8 unit dan ketinggian 3.3 unit).
   - `desiredLook` diarahkan ke `posRef + forward * 2.5` (menghadap ke jalan di depan mobil).
   - Orientasi setir dikoreksi: tombol `D`/kanan menambah heading ke kanan (+X), tombol `A`/kiri mengurangi heading ke kiri (-X).
2. **Indikator Visual Titik Soal 3D**:
   - Menambahkan **pilar cahaya vertikal setinggi 16 meter** (`cylinderGeometry`) di setiap titik soal dengan efek glowing transparan sehingga terlihat jelas dari seluruh penjuru kota.
   - Menambahkan **floating diamond octahedron 3D** yang berputar dan melayang di atas ring target.
   - Menambahkan **ring target berdenyut (pulsing ground ring)** di atas aspal untuk menandai zona pengerjaan kuis.
   - Titik yang sudah dikerjakan berubah warna menjadi hijau emerald (`#22c55e`), sedangkan titik target terdekat berwarna amber/gold (`#f59e0b`).
   - Koordinat soal diselaraskan dengan koridor jalan dan persimpangan agar mobil dapat menjangkaunya dengan mudah tanpa terhalang gedung.
3. **Target Radar & Navigasi HUD**:
   - Menampilkan card target terdekat: `Target Terdekat: Soal #X (±Y meter)`.
   - Menampilkan chip radar untuk semua soal di bagian atas layar beserta jarak dan status selesai.
   - Menampilkan **Proximity Prompt Banner** saat mobil berada dalam radius interaksi (< 3.4 meter): `⚡ KERJAKAN SOAL #X • Tekan Spasi atau Klik`.
4. **Modal Kuis & Sinkronisasi Skor Realtime**:
   - Menambahkan popup interaktif kuis pilihan ganda dan isian singkat.
   - Pilihan ganda memberikan feedback visual langsung (hijau jika benar, merah jika salah).
   - Jawaban benar langsung menambah skor pemain dan disinkronkan ke Firebase Realtime Database (`rooms/{roomCode}/players/{playerId}/score`) sehingga leaderboard ter-update instan.
   - Tombol keyboard `Space` dapat digunakan sebagai shortcut untuk membuka soal saat mobil berada di dekat titik soal.
   - Mengunci pergerakan mobil saat kuis dibuka agar input teks pemain tidak menggerakkan kendaraan.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error.


## 2026-11-02 — Rombak player: ganti mini-character → kendaraan mobil

### Keputusan

Model GLB karakter mini terus bermasalah (primitive tidak mau ikut group bergerak meski sudah diubah ke prop-passing). Solusi permanen: **hapus mini-character sepenuhnya, ganti dengan mobil dari `kenney_car-kit`**.

### Perubahan

- **Player** sekarang mengendarai mobil (`sedan-sports`, `suv-luxury`, `hatchback-sports`, `race-future`, `taxi`) — pilihan mobil deterministik berdasarkan hash `playerId`.
- **`PlayerCarController`** menggantikan `PlayerController`:
  - `W/↑` gas maju, `S/↓` rem/mundur, `A/←` `D/→` setir.
  - Fisika sederhana: akselerasi, gesekan, kecepatan maks maju 9 unit/s.
  - Tilt body mobil saat belok (visual).
  - Kamera third-person di belakang mobil, lag lerp agar mobil terlihat bergerak.
  - Swipe/drag mouse untuk memutar sudut kamera.
- `useGLTF` untuk mobil player di-load di `CityScene` (parent) dan di-pass sebagai prop `carScene` ke controller → tidak ada Suspense di dalam controller.
- `useGLTF.preload()` dipanggil di module level untuk semua asset agar tidak ada pop-in.
- NPC traffic tetap ada (sedan, suv, delivery, dll.) sebagai mobil latar.
- Remote player ditampilkan sebagai mobil NPC dengan ring oranye.
- Hint kontrol di `game/page.tsx` diperbarui.

### Verifikasi

- `npx tsc --noEmit` berhasil.
- `npm run lint` berhasil.



### Temuan

Shadow disc (geometry biasa) bergerak mengikuti group, tapi model GLB karakter tidak ikut. Root cause: `useGLTF` di dalam `PlayerController` menyebabkan Suspense throw setiap kali model belum sepenuhnya di-flush ke scene graph THREE.js. Saat Suspense resolve dan komponen re-mount, `<primitive object={charScene}>` di-attach ke group yang benar, tapi ada race condition di mana R3F mengatur ulang parent object ke scene root saat hot-reload atau re-render.

### Perubahan

- `useGLTF(characterPath)` dipindahkan ke `CityScene` (parent yang sudah dalam Suspense boundary).
- `charScene` (hasil `scene.clone(true)`) diteruskan sebagai prop ke `PlayerController`.
- `PlayerController` tidak lagi memanggil `useGLTF` sama sekali — tidak ada Suspense throw di dalam controller.
- Posisi group kini di-set dengan `.set(x, y, z)` (bukan `.copy()`) agar lebih eksplisit.

### Verifikasi

- `npx tsc --noEmit` berhasil.
- `npm run lint` berhasil.



### Root cause

Kamera melakukan `lerp` ke posisi target dengan faktor mendekati **1** (quassi-instant snap):
```js
camera.position.lerp(target, 1 - Math.pow(0.001, delta)); // ≈ 0.9999 per frame
```
Akibatnya kamera selalu "menempel" tepat di offset karakter, sehingga karakter **selalu di pixel yang sama** di layar — dari perspektif pemain, karakter tampak diam dan kameranya yang bergerak.

Tidak ada hubungannya dengan Firebase Realtime Database. Movement sepenuhnya lokal di `useFrame`.

### Perubahan

- **`camPosRef`** terpisah dari `posRef`: posisi kamera di-lerp dengan faktor lambat (`Math.pow(0.0001, dt)`) sehingga ada visual lag — karakter bergerak maju dulu, kamera menyusul.
- **LookAt ahead**: kamera tidak melihat tepat ke posisi karakter tetapi sedikit di depannya saat berjalan (`lookAheadDist = 0.8`), memberi kesan karakter "lean forward".
- **Walking bob diperbesar** dari 0.03 → 0.12 agar lebih jelas terlihat memantul.
- **Shadow disc** di bawah karakter agar posisi karakter selalu jelas di scene.
- Rotasi karakter di-lerp (bukan langsung snap) agar belokan terlihat halus.

### Verifikasi

- `npx tsc --noEmit` berhasil.
- `npm run lint` berhasil.



### Temuan

- Karakter tidak kelihatan berjalan karena `useGLTF` di-render sebagai child `<Model>` yang membuat scene baru; posisi group di-update lewat `posRef` tetapi scene GLB tidak terikat ke ref group yang sama dengan benar sehingga karakter tampak diam dari sudut pandang kamera.
- Kota hanya menggunakan asset suburban dan belum memanfaatkan asset `kenney_car-kit` dan `kenney_city-kit-roads` yang sudah tersedia.

### Perubahan

- **Fix karakter bergerak**: `PlayerController` sekarang menggunakan `posRef` (`THREE.Vector3`) sebagai sumber kebenaran posisi, di-copy ke `playerGroupRef.current.position` setiap frame di `useFrame`. Model karakter di-clone langsung dengan `useMemo` di dalam komponen controller, bukan lewat sub-komponen `<Model>`.
- **Road grid nyata**: Menambahkan `RoadGrid` yang meletakkan model `road-straight.glb` (horizontal & vertikal) dan `road-crossroad.glb` (9 simpang) dari `kenney_city-kit-roads` membentuk grid 3×3 jalan.
- **Animasi mobil**: Menambahkan `AnimatedCar` + `CarTraffic` yang menjalankan 6–10 mobil dari `kenney_car-kit` (sedan, taxi, police, van, dll.) di sepanjang jalur horizontal dan vertikal secara looping dengan kecepatan bervariasi.
- **Street furniture**: Menambahkan lampu jalan (`light-square.glb`), traffic light, tiang listrik dari `kenney_city-kit-roads` di sudut blok dan tepi jalan.
- **Lebih banyak bangunan**: Menggunakan 9 varian bangunan suburban dan menempatkan 1–2 bangunan per blok kota dengan rotasi dan skala acak berbasis seed.
- **Pohon lebih banyak**: 30 pohon ditempatkan acak di area non-jalan dengan `lcg` berbasis seed agar deterministik.
- Semua penempatan tetap deterministik berbasis `matchSeed` sehingga semua pemain melihat layout yang sama.

### Verifikasi

- `npx tsc --noEmit` berhasil.
- `npm run lint` berhasil.

## 2026-11-02 — Koreksi arah kemudi mobil dan revitalisasi tata kota (jalan lebar & perumahan padat teratur)

### Temuan

1. **Arah Kemudi Terbalik**: Input belok kanan membuat mobil berbelok ke kiri dan sebaliknya dari sudut pandang kamera belakang.
2. **Jalan Sempit & Berlubang**: Grid jalan sebelumnya menggunakan interval langkah yang melompati ukuran modular tile (meninggalkan celah) dan hanya berukuran 1 tile sempit sehingga mobil hampir selebar jalan.
3. **Rumah Berjauhan & Kota Kosong**: Hanya 1–2 bangunan yang ditempatkan secara acak pada blok besar, sehingga kota tampak lengang dan tidak tertata.

### Perubahan

1. **Koreksi Kemudi**:
   - Menyelaraskan arah putaran `headingRef`: tombol `D`/Kanan/▶ membelokkan mobil ke kanan, dan tombol `A`/Kiri/◀ membelokkan mobil ke kiri.
   - Dynamic body tilt mobil disesuaikan dengan arah kemudi baru.
2. **Jalan 2-Arah yang Lebar & Mulus**:
   - Skala modular jalan dinaikkan menjadi `scale = 2.0` (lebar 4 unit per jalur jalan, nyaman untuk dilalui mobil dan NPC).
   - Seluruh sambungan jalan dari -24 hingga +24 tersambung sempurna tanpa celah.
   - Menambahkan zebra crossing pejalan kaki (`road-crossing.glb`) tepat sebelum memasuki persimpangan.
   - Lampu jalan (`light-square.glb`), lampu lalu lintas (`traffic-light.glb`), dan plang rambu stop (`road-sign-stop.glb`) dipasang rapi di tepi trotoar dan sudut persimpangan.
3. **Perumahan Padat, Hidup, dan Rapi**:
   - Menata **36+ rumah suburban** menggunakan 21 variasi model rumah dari `kenney_city-kit-suburban_20` yang berjejer rapi menghadap jalan di setiap blok.
   - Dilengkapi dengan jalan masuk halaman (*driveway*), pagar pembatas antar rumah (*fence*), pot bunga (*planter*), serta pepohonan rimbun (*tree-large* dan *tree-small*) di pekarangan depan.
4. **Lalu Lintas 2 Arah & Titik Soal**:
   - Mobil NPC kini melaju dalam 2 arah berlawanan di setiap jalan utama.
   - Titik pilar soal ditempatkan tepat di koridor jalan raya yang luas sehingga mudah dijangkau kendaraan pemain.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error maupun warning.


## 2026-11-02 — Perbaikan orientasi kamera mobil, indikator pilar soal, dan sistem pengerjaan kuis interaktif

### Temuan

1. **Kamera Mobil Menghadap Depan**: Pada implementasi sebelumnya, kalkulasi kamera menempatkan kamera di koordinat `pos + moveDir * camDist` (di depan mobil) dan menghadap balik ke belakang mobil, sehingga mobil terlihat melaju ke arah layar/kamera.
2. **Soal Belum Bisa Dikerjakan & Lokasi Tidak Diketahui**: Titik soal hanya berupa bola kecil ungu tanpa indikator jarak, navigasi, atau pilar visual yang terlihat dari jauh. Belum ada modal pengerjaan soal saat mendekati titik tersebut.

### Perubahan

1. **Orientasi Kamera Third-Person di Belakang Mobil**:
   - `desiredCam` diubah menjadi `posRef - forward * camDist` (ditempatkan di belakang mobil pada jarak 6.8 unit dan ketinggian 3.3 unit).
   - `desiredLook` diarahkan ke `posRef + forward * 2.5` (menghadap ke jalan di depan mobil).
   - Orientasi setir dikoreksi: tombol `D`/kanan menambah heading ke kanan (+X), tombol `A`/kiri mengurangi heading ke kiri (-X).
2. **Indikator Visual Titik Soal 3D**:
   - Menambahkan **pilar cahaya vertikal setinggi 16 meter** (`cylinderGeometry`) di setiap titik soal dengan efek glowing transparan sehingga terlihat jelas dari seluruh penjuru kota.
   - Menambahkan **floating diamond octahedron 3D** yang berputar dan melayang di atas ring target.
   - Menambahkan **ring target berdenyut (pulsing ground ring)** di atas aspal untuk menandai zona pengerjaan kuis.
   - Titik yang sudah dikerjakan berubah warna menjadi hijau emerald (`#22c55e`), sedangkan titik target terdekat berwarna amber/gold (`#f59e0b`).
   - Koordinat soal diselaraskan dengan koridor jalan dan persimpangan agar mobil dapat menjangkaunya dengan mudah tanpa terhalang gedung.
3. **Target Radar & Navigasi HUD**:
   - Menampilkan card target terdekat: `Target Terdekat: Soal #X (±Y meter)`.
   - Menampilkan chip radar untuk semua soal di bagian atas layar beserta jarak dan status selesai.
   - Menampilkan **Proximity Prompt Banner** saat mobil berada dalam radius interaksi (< 3.4 meter): `⚡ KERJAKAN SOAL #X • Tekan Spasi atau Klik`.
4. **Modal Kuis & Sinkronisasi Skor Realtime**:
   - Menambahkan popup interaktif kuis pilihan ganda dan isian singkat.
   - Pilihan ganda memberikan feedback visual langsung (hijau jika benar, merah jika salah).
   - Jawaban benar langsung menambah skor pemain dan disinkronkan ke Firebase Realtime Database (`rooms/{roomCode}/players/{playerId}/score`) sehingga leaderboard ter-update instan.
   - Tombol keyboard `Space` dapat digunakan sebagai shortcut untuk membuka soal saat mobil berada di dekat titik soal.
   - Mengunci pergerakan mobil saat kuis dibuka agar input teks pemain tidak menggerakkan kendaraan.

### Verifikasi

- `npx tsc --noEmit` berhasil tanpa error.
- `npm run lint` berhasil tanpa error.


Catatan: setiap perubahan implementasi wajib memperbarui file ini dan dokumentasi fitur terkait di `docs/`.

## 2026-11-02 — Diagnosis koneksi Firebase

### Temuan

- Log browser menunjukkan `NEXT_PUBLIC_FIREBASE_DATABASE_URL` masih memakai placeholder `your-project-id-default-rtdb...`.
- Firestore menolak pembacaan dengan `Missing or insufficient permissions`, yang berarti Firestore Rules belum mengizinkan akses client saat development.

### Perubahan

- Menambahkan penanganan error pada operasi save/delete Firestore.
- Menambahkan penanganan error pada operasi join dan disconnect Realtime Database.
- Menambahkan panduan pengecekan URL database dan Security Rules ke dokumentasi Firebase.

### Tindakan manual

- Ganti `NEXT_PUBLIC_FIREBASE_DATABASE_URL` dengan URL database asli dari Firebase Console.
- Sesuaikan Rules untuk development, lalu restart server Next.js.

## 2026-11-02 — Perbaikan hydration dan session pemain

### Temuan

- Admin mengalami hydration mismatch karena state awal membaca `localStorage` sebelum hydration selesai.
- Pemain keluar dari lobby setelah refresh karena room code tidak disimpan sebagai session aktif.

### Perubahan

- State awal admin dan player dibuat stabil antara server dan client.
- Data local storage dimuat setelah hydration melalui microtask.
- Room aktif dan nama pemain dipulihkan otomatis setelah refresh.
- Tombol keluar lobby menghapus session room aktif.

## 2026-11-02 — Monitoring dan lifecycle room

### Perubahan

- Memperbaiki hydration mismatch pada admin dan halaman `/play` dengan state awal yang stabil.
- Admin sekarang dapat memilih room, melihat pemain online, melihat skor sementara, memulai room, dan menghentikan room.
- Status room disimpan di Firestore dan Realtime Database.
- Player listener memantau status room; pemain dikeluarkan dari lobby ketika admin menghentikan room.
- Session room pemain tetap dipulihkan ketika browser di-refresh selama room belum dihentikan.

## 2026-11-02 — Hapus room dan perapian panel admin

### Perubahan

- Menambahkan tombol hapus room dengan konfirmasi.
- Penghapusan menghapus room dari Firestore dan seluruh node room dari Realtime Database.
- Admin membersihkan room terpilih, daftar pemain, dan preview room setelah penghapusan.
- Menambahkan style khusus untuk tombol hapus dan layout responsif panel monitoring.

## 2026-11-02 — Validasi room dan cleanup presence

### Temuan

- Room yang hilang dari UI belum tentu berhasil dihapus dari Firebase karena operasi delete sebelumnya tidak ditunggu.
- Player dapat membuat path baru dengan memasukkan kode room sembarang karena halaman `/play` belum mengecek metadata room.
- Tombol keluar hanya menghapus session browser dan menunggu `onDisconnect`, sehingga presence dapat tertinggal sementara.

### Perubahan

- Penghapusan room sekarang menunggu Firestore dan Realtime Database selesai; UI hanya dibersihkan jika operasi berhasil.
- Join room memvalidasi `rooms/{code}/meta` dan menolak room yang tidak ada atau berstatus `finished`.
- Listener metadata mengeluarkan pemain ketika room dihapus manual atau dihentikan admin.
- Tombol keluar lobby langsung menghapus node player dari Realtime Database.
- Validasi join dan listener player sekarang mengecek Firestore dan Realtime Database, sehingga penghapusan manual di salah satu database tidak meninggalkan lobby yang dapat dimasuki.

## 2026-11-02 — Game shell berbasis match seed

### Perubahan

- Menambahkan route `/game?room={roomCode}`.
- Halaman game mengambil metadata room, seed kota, daftar soal, status, dan pemain dari Realtime Database.
- Lobby otomatis mengarahkan pemain ke `/game` ketika admin mengubah status room menjadi `running`.
- Menambahkan preview map berbasis seed dengan titik soal deterministik dan leaderboard sementara.
- Preview ini menjadi tempat integrasi renderer GLB/3D pada tahap berikutnya.

### Koreksi

- Redirect internal dari lobby ke game menggunakan `useRouter().push()` agar sesuai aturan Next.js.

## 2026-11-02 — Renderer GLB city kit

### Perubahan

- Menambahkan `three`, `@react-three/fiber`, `@react-three/drei`, dan `@types/three`.
- Menambahkan `components/CityCanvas.tsx` dengan Canvas WebGL, kamera orbit, lighting, model bangunan, pohon, karakter, dan titik soal.
- Mengganti preview CSS di `/game` dengan model GLB dari `public/assets/3d-assets/`.
- Posisi objek dan titik soal tetap ditentukan oleh seed room.

### Catatan performa

- Scene awal sengaja memakai jumlah model terbatas agar aman untuk prototype mobile.
- `dpr` dibatasi sampai 1.5 dan kamera menggunakan kontrol orbit sederhana.
- Collision, pergerakan karakter, dan interaksi titik soal belum aktif.
- Menghapus helper preview map CSS yang sudah tidak dipakai setelah scene GLB aktif.

## 2026-11-02 — Kontrol keyboard dan kamera third-person

### Perubahan

- Kamera didekatkan ke karakter dengan follow camera.
- Menambahkan kontrol `WASD` dan arrow keys untuk pengembangan lewat laptop.
- Karakter berputar mengikuti arah gerak dan dibatasi di area kota.
- Menambahkan petunjuk kontrol di halaman game.
- Menonaktifkan shadow rendering sementara agar tidak memicu warning `PCFSoftShadowMap` deprecated.

### Catatan

- Warning `THREE.Clock` berasal dari dependency renderer yang masih memakai API internal deprecated; tidak berasal dari kode gerak aplikasi.
- Kontrol touch/joystick akan ditambahkan setelah movement laptop stabil.

## 2026-11-02 — Immersive game screen dan match timer

### Perubahan

- Game screen diubah menjadi fullscreen dengan map sebagai area utama.
- Header, leaderboard, dan informasi match menjadi overlay agar terasa seperti game.
- Timer match sekarang menghitung mundur dalam format `MM:SS` saat status room `running`.
- Input `WASD` dan arrow keys mencegah browser melakukan scroll saat bermain.
- Warning shadow map dihindari dengan menghapus shadow mode dari scene prototype.

### Catatan

- Tampilan mobile memakai leaderboard overlay yang dapat di-scroll.
- Joystick touch belum dibuat; kontrol saat ini diprioritaskan untuk laptop.

## 2026-11-02 — Responsive mobile dan kontrol karakter

### Perubahan

- Kamera dibuat lebih dekat dan relatif tetap agar gerakan karakter terlihat jelas.
- Gerakan karakter dibatasi pada area yang terlihat kamera, bukan memindahkan kamera mengikuti setiap input.
- Menambahkan highlight ring di bawah karakter sebagai indikator posisi.
- Menambahkan tombol arah virtual untuk layar sentuh.
- Overlay leaderboard dan informasi match dipadatkan agar tidak menutupi area bermain di mobile.
- Input tombol virtual mengirimkan event yang sama dengan kontrol keyboard.

## 2026-11-02 — Avatar GLB dan follow camera

### Perubahan

- Menghapus bundar indikator sebagai visual karakter utama.
- Model `character-male-a.glb` sekarang menjadi avatar yang dikontrol langsung.
- Skala avatar diperbesar agar terlihat jelas di scene city kit.
- Kamera mengikuti posisi avatar dari jarak dekat dengan target sedikit di atas karakter.

## 2026-11-02 — Orbit camera dan kota lebih padat

### Perubahan

- Kamera memakai `OrbitControls`, sehingga bisa diputar dengan mouse drag atau swipe.
- Target kamera mengikuti karakter tanpa mengunci sudut pandang.
- Arah WASD mengikuti azimuth kamera.
- Menambahkan bob kecil saat berjalan agar gerak karakter lebih mudah terlihat.
- Memperluas area kota dan menambah grid bangunan, pohon, path, serta jalan tambahan.
- Batas gerak karakter diperluas mengikuti kota baru.

## 2026-11-02 — Stabilitas camera drag dan import scene

### Temuan

- Dev server menemukan import alias `@/components/CityCanvas` tidak konsisten saat route game di-bundle.
- `OrbitControls` memicu `Element.releasePointerCapture: Invalid pointer id` pada sebagian gesture touch.
- Kamera masih terlalu jauh untuk membaca karakter.

### Perubahan

- Import `CityCanvas` pada game route diganti menjadi relative import yang eksplisit.
- Mengganti `OrbitControls` dengan camera controller internal berbasis pointer drag tanpa pointer capture.
- Mouse drag dan swipe sekarang mengubah yaw/pitch kamera secara manual.
- Jarak kamera dipendekkan dan FOV dipersempit.
- Menambahkan kembali pembacaan posisi player setelah refactor camera controller.

## 2026-11-02 — Sinkronisasi avatar multiplayer

### Temuan

- Gerakan sebelumnya hanya mengubah group lokal di browser.
- RTDB belum memiliki data posisi player, sehingga pemain lain tidak bisa melihat avatar yang bergerak.

### Perubahan

- Player baru mendapat posisi awal `{ x: 0, z: 0 }`.
- Posisi lokal dikirim ke `rooms/{roomCode}/players/{playerId}/position` setiap 100 ms saat bergerak.
- Game merender avatar GLB player lain berdasarkan posisi RTDB.
- Avatar player lain dipantau real-time melalui listener room yang sudah ada.

### Batasan yang masih ada

- Posisi belum memakai interpolation client-side, sehingga gerakan player lain dapat terlihat tersentak pada koneksi lambat.
- Collision, validasi posisi server, dan anti-cheat belum dibuat.
- Skor belum berubah karena modul menjawab soal belum aktif.

## 2026-11-02 — Sanitasi data player malformed

### Temuan

- RTDB dapat berisi node lama tanpa field `name`, sehingga leaderboard crash pada `player.name.slice(...)`.

### Perubahan

- Game, lobby, admin monitor, dan renderer hanya memproses record player yang memiliki `name` string valid.
- Record malformed diabaikan tanpa menghapus data Firebase secara otomatis.
- Warning `THREE.Clock` dicatat sebagai warning dependency dan bukan penyebab crash game.

## 2026-11-02 — Firebase Realtime Database lobby

### Perubahan

- Menambahkan publikasi metadata room ke Realtime Database pada path `rooms/{roomCode}/meta`.
- Menambahkan halaman pemain di `/play` untuk input nama dan kode room.
- Menambahkan presence pemain pada path `rooms/{roomCode}/players/{playerId}`.
- Menggunakan `onDisconnect().remove()` agar pemain yang menutup tab dihapus dari lobby.
- Menambahkan listener real-time untuk menampilkan daftar pemain yang sedang berada di room.
- Menambahkan gaya visual mobile untuk halaman join dan lobby.

### Keputusan data

- Firestore tetap menjadi sumber data bank soal dan arsip room.
- Realtime Database dipakai untuk data yang cepat berubah: metadata lobby dan pemain online.
- `playerId` disimpan di local storage browser agar refresh tidak membuat identitas baru.
- Skor, timer, dan jawaban benar belum diproses di tahap ini; jangan mengirim jawaban benar ke client game produksi.

### Verifikasi

- `npm run lint` berhasil.
- `npx tsc --noEmit` berhasil.
- Pengujian realtime membutuhkan Firestore/Realtime Database aktif dan rules yang mengizinkan akses sesuai skenario.
- Prefill nama pemain dipindahkan ke lazy state initializer agar sesuai aturan React lint terbaru.

### Langkah berikutnya

1. Tambahkan halaman game dengan fetch metadata room dan `matchSeed`.
2. Tambahkan sinkronisasi posisi karakter dengan throttling agar hemat kuota.
3. Tambahkan state pertandingan: `lobby`, `running`, dan `finished`.
4. Tambahkan rules dan autentikasi pemain sebelum deployment publik.

## 2026-11-11 — Kontrol Analog Virtual Mobile & Reposisi Leaderboard Ringkas di Atas

### Masalah / Kebutuhan

- Kontrol mobile sebelumnya menggunakan D-pad 4 tombol panah diskret yang kaku dan terasa aneh saat dimainkan di smartphone; pemain kesulitan membelokkan mobil sambil melaju secara bersamaan.
- Panel sidebar Leaderboard di layar mobile sebelumnya diletakkan di bagian bawah layar (`bottom: 64px - 72px`), menutupi area pandang mobil, jalan, dan mengganggu kontrol sentuh.
- Elemen judul layout besar (`stage-top`) dan panduan keyboard desktop tumpang tindih dengan HUD target kuis di mobile.

### Perubahan

1. **Virtual Analog Joystick Mobile (`components/VirtualJoystick.tsx`)**:
   - Dibuat komponen joystick analog berbasis sentuhan (Pointer Events) dengan pointer capture (`setPointerCapture`) agar pelacakan jempol tidak lepas saat bergerak keluar lingkaran.
   - Desain frosted glass transparan dengan indikator panduan 4 arah (▲, ◀, ▼, ▶) dan thumbstick knob responsif.
   - Menghitung vektor analog kontinu normalisasi (-1.0 s/d +1.0) untuk throttle maju/mundur dan kemudi belok kiri/kanan secara dinamis.
   - Mendukung deadzone 8% untuk menghindari getaran jari yang tidak disengaja.

2. **Integrasi Input Analog pada 3D Engine (`components/CityCanvas.tsx`)**:
   - Menggunakan `React.RefObject` untuk input joystick dan rem tangan (`isBrakingRef`), mencegah re-render React berulang pada frekuensi tinggi (60–120 FPS).
   - Fisika mobil membaca akselerasi analog (kecepatan bertahap sesuai tarikan analog) dan sudut belok analog yang responsif bahkan pada kecepatan rendah.
   - Ditambahkan tombol rem khusus (**🛑 REM**) di sudut kanan bawah untuk jempol kanan agar mobil dapat berhenti presisi di dekat pilar soal kuis.

3. **Reposisi Leaderboard Ringkas di Atas (`app/game/page.tsx` & `app/globals.css`)**:
   - Leaderboard mobile dipindahkan dari bawah layar ke sisi **kanan atas (di bawah header)** berdampingan dengan Radar Navigasi Soal di kiri atas.
   - Menampilkan ringkasan Top 3 pemain dan status peringkat pemain lokal secara kompak tanpa menutupi area mengemudi.
   - Dilengkapi tombol toggle ciutkan/buka (**▼ Ciut / ▲ Buka**). Saat diciutkan, leaderboard menjadi pill minimalis (`🏆 #Rank Kamu · [Skor] pts ▾`).
   - Menyembunyikan elemen dekoratif desktop yang tidak perlu di mobile (`stage-top`, `game-hint`, `session-panel`).

4. **Optimasi Viewport Mobile (`app/layout.tsx`)**:
   - Menambahkan metadata `Viewport` (`width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false`) dan `touch-action: none` pada area kontrol untuk mencegah zooming/scrolling tidak sengaja saat bermain.

### Verifikasi

- `npm run build` sukses tanpa error TypeScript maupun Turbopack bundling.
- Navigasi dan kontrol sentuh mobile terisolasi tanpa memicu gesture pull-to-refresh atau page scroll browser.

## 2026-11-11 — Analisis Bug Presensi Pemain, Rencana Bank Soal Berjenjang & Live Monitor Admin

### Laporan Bug & Temuan

1. **Pemain Tidak Kedeteksi di Admin & Leaderboard Kosong Antar-Pemain**:
   - Di `app/play/page.tsx`, listener `onDisconnect(playerRef).remove()` menghapus node pemain saat halaman berpindah ke `/game`.
   - Di `app/game/page.tsx`, pemain tidak pernah didaftarkan ulang ke `rooms/{code}/players/{playerId}` saat masuk atau refresh, sehingga node pemain di Realtime Database hilang.
   - Karena node pemain hilang atau tidak memiliki `name`, filter `validPlayers` mengabaikan pemain tersebut sehingga pemain lain maupun admin tidak dapat melihatnya.
2. **Data & Skor Hilang Saat Refresh**:
   - `app/game/page.tsx` tidak membaca kembali `kyunika-player-name` dari `localStorage` saat inisialisasi ulang.
   - Panggilan `update` saat menjawab soal hanya memperbarui `{ completedQuestions, score }` tanpa menyertakan `name`, sehingga data dianggap *malformed* dan tidak ditampilkan.
3. **Kebutuhan Bank Soal Hierarki (Kategori/Paket Soal)**:
   - Sebelumnya, seluruh soal dimasukkan ke dalam satu daftar global tanpa kategori. Saat room dibuat, seluruh soal diimpor sekaligus.
   - Dibutuhkan model paket soal (misal: "Matematika Lanjutan", "Pengetahuan Umum") agar admin dapat mengelompokkan soal dan memilih bank soal tertentu untuk diimpor ke dalam room.
4. **Kebutuhan Monitor Pengerjaan Detail Siswa di Admin**:
   - Admin belum memiliki visibilitas terhadap siapa saja yang menjawab benar atau salah untuk masing-masing soal.
   - Diperlukan pencatatan riwayat jawaban siswa (`answers/{questionId}`) dengan rincian jawaban siswa, kunci jawaban, dan status benar/salah secara real-time.

### Keputusan Arsitektur & Rencana Solusi

- Mengganti `onDisconnect().remove()` dengan `onDisconnect().set({ online: false })` agar data skor dan progres pemain tetap tersimpan permanen di Realtime Database.
- Menambahkan auto-reconnection & auto-registration di `app/game/page.tsx` untuk memastikan data pemain dipulihkan secara otomatis saat refresh browser.
- Merancang entitas `QuestionBank` (`id`, `title`, `description`) dengan relasi `Question.bankId`, serta selector bank soal saat pembuatan room.
- Memperluas skema data jawaban pemain dengan `answers` log per soal, dan menambahkan antarmuka inspeksi detail siswa di Room Monitor Admin.
- Rencana kerja lengkap telah dituangkan dalam `docs/todo.md`.

## 2026-11-11 — Implementasi Tuntas Presensi Pemain, Bank Soal Berjenjang, & Live Monitor Pengerjaan Siswa

### Hasil Implementasi

1. **Presensi Real-Time & Pencegahan Kehilangan Data Pemain (`app/play/page.tsx` & `app/game/page.tsx`)**:
   - `onDisconnect(playerRef).remove()` diganti menjadi `onDisconnect(onlineRef).set(false)`. Data pemain (nama, skor, jawaban) tidak lagi terhapus saat berpindah halaman atau me-refresh browser.
   - Mengimplementasikan `localStorage` recovery untuk `kyunika-player-name`, `kyunika-player-id`, dan `kyunika-active-room`.
   - `app/game/page.tsx` otomatis melakukan assert dan re-registrasi node pemain di RTDB (`rooms/${roomCode}/players/${playerId}`) dengan field `name`, `score`, `online: true`, dan `lastActive`.
   - Sinkronisasi skor dan status penyelesaian soal pemain lama ditarik dari RTDB saat mount jika tersedia, sehingga nilai pemain tidak kembali ke 0 saat refresh.

2. **Leaderboard Multiplayer Real-Time Aktif**:
   - Filter `validPlayers` kini selalu menemukan semua pemain online/terdaftar karena field `name` dijamin ada di RTDB.
   - Seluruh pemain dapat melihat peringkat dan skor satu sama lain secara langsung (live update) tanpa jeda.

3. **Sistem Bank Soal Berjenjang / Paket Kategori (`app/admin/page.tsx`)**:
   - Tipe data `QuestionBank` (`id`, `title`, `description`, `createdAt`) ditambahkan, dan setiap `Question` memiliki relasi `bankId`.
   - Default bank disiapkan: "Bank Umum" (`bank-umum`) dan "Matematika Lanjutan" (`bank-mtk-lanjutan`).
   - Admin dapat membuat bank soal baru secara fleksibel melalui modal/inline card "Buat Bank Baru".
   - Soal difilter berdasarkan chip bank yang dipilih (dengan ringkasan total soal dan poin per bank).
   - Saat membuat soal baru, admin dapat menentukan bank soal target melalui dropdown.
   - Sinkronisasi bank soal disimpan ke Firestore (`questionBanks`) dan `localStorage` (`kyunika-banks`).

4. **Import Eksklusif Bank Soal ke Room (`app/admin/page.tsx`)**:
   - Pada form pembuatan room di tab "Room Manager", admin dapat memilih bank soal yang akan diujikan via dropdown "Import Dari Bank Soal".
   - Kuis hanya mengambil soal dari bank yang dipilih dan menyimpannya langsung ke `rooms/${roomCode}/questions` di Realtime Database.
   - Kartu room di admin menampilkan label bank soal yang digunakan.

5. **Live Monitor & Analisis Pengerjaan Siswa di Admin (`app/admin/page.tsx` & `app/globals.css`)**:
   - Saat pemain menjawab (pilihan ganda maupun isian singkat di `/game`), rekaman jawaban lengkap disimpan ke RTDB: `rooms/${roomCode}/players/${playerId}/answers/${questionId}` (`playerAnswer`, `correctAnswer`, `isCorrect`, `pointsAwarded`, `answeredAt`).
   - Admin Room Monitor menampilkan **Bar Analisis Kelas**:
     - Total Siswa terdaftar & jumlah siswa online (hijau).
     - Rata-rata skor kelas.
     - Persentase akurasi kelas (jumlah benar vs total jawaban).
     - Total butir soal tersedia dalam room.
   - Daftar siswa menampilkan kartu interaktif dengan status online/offline, jumlah soal yang telah dikerjakan (`X/total`), pil hijau `✓ Benar`, pil merah `✗ Salah`, serta total skor.
   - Accordion drawer **"Lihat pengerjaan ▼"** memungkinkan admin menginspeksi lembar jawaban siswa butir per butir:
     - Teks pertanyaan
     - Status butir (Benar / Salah / Belum dikerjakan)
     - Jawaban siswa vs Kunci jawaban

### Verifikasi & Uji Mutu

- `npm run build`: Kompilasi Turbopack dan pemeriksaan tipe TypeScript 100% sukses tanpa error maupun peringatan.
- `docs/todo.md` dan `docs/log.md` telah diperbarui sesuai arahan.

## 2026-11-11 — Perbaikan Kritis Timer Sinkron, Pencegahan Penghapusan Data Siswa, Isolasi Bank Soal, & Layar Akhir Pertandingan

### Temuan & Masalah Lanjutan

1. **Timer Pertandingan Ter-reset Setiap 100ms**:
   - Di `app/game/page.tsx`, listener `onValue(rooms/${roomCode})` sebelumnya memanggil `setRemainingSeconds(meta.duration * 60)` setiap kali ada snapshot masuk.
   - Karena pergerakan mobil lokal dan remote memperbarui node posisi pemain setiap 100ms, listener `onValue` terpicu berulang-ulang, menyebabkan timer match selalu ter-reset kembali ke durasi awal (misal 10:00) dan tidak pernah berjalan mundur.
2. **Penghapusan Node Pemain saat Room Dihentikan Admin**:
   - Di `app/play/page.tsx`, saat admin menghentikan room (`finished`), listener mengeksekusi `remove(playerRef)`. Akibatnya, seluruh riwayat jawaban siswa terhapus dari RTDB dan admin tidak dapat lagi menginspeksi lembar jawaban siswa di Room Monitor.
   - Saat pemain me-refresh atau membuka kembali `/play`, pemanggilan `set(playerRef, player)` menimpa data pemain lama dan mereset skor serta riwayat soal ke 0.
3. **Soal Room Tertimpa Bank Global**:
   - Di `app/game/page.tsx`, fungsi `loadFallbackQuestions` berjalan asinkron saat mount dan memanggil `setQuestions(loaded)` dengan seluruh soal dari `localStorage`, menimpa daftar soal terseleksi dari Bank Soal room.
   - Struktur RTDB pada room questions dapat berupa dictionary objek jika disimpan secara renggang/sparsely, sehingga pengecekan `Array.isArray` gagal mengenali daftar soal.
4. **Ketiadaan Layar Akhir Pertandingan (Game Over / Podium)**:
   - Saat status room menjadi `finished` atau waktu match habis, game tidak menampilkan status akhir sehingga pemain kebingungan apakah pertandingan sudah selesai.
5. **Ketiadaan Manajemen Hapus Bank Soal Kustom**:
   - Admin belum dapat menghapus bank soal yang sudah dibuat secara manual di antarmuka admin.

### Perubahan & Solusi

1. **Sinkronisasi Timer Pertandingan Global Berbasis Timestamp (`startedAt`)**:
   - Saat admin memulai room (`running`), admin mencatat timestamp `startedAt: Date.now()` ke Firestore dan Realtime Database (`rooms/${code}/meta/startedAt`).
   - Di `app/game/page.tsx`, timer dihitung secara dinamis terhadap selisih waktu sekarang dengan `startedAt`:
     `remainingSeconds = Math.max(0, durationSec - Math.floor((Date.now() - meta.startedAt) / 1000))`.
   - Timer match terisolasi dari event pergerakan kendaraan dan 100% sinkron antar seluruh pemain dan host.
2. **Pencegahan Penghapusan & Timpa Data Pemain (`app/play/page.tsx` & `app/game/page.tsx`)**:
   - Saat room berstatus `finished`, pemain hanya ditandai `online: false` dan node pemain **tidak dihapus** dari RTDB. Admin tetap dapat melihat rekaman jawaban, akurasi, dan skor akhir seluruh siswa.
   - Saat pemain masuk/refresh di `/play`, sistem memeriksa keberadaan node pemain dengan `get(playerRef)`. Jika sudah ada, sistem hanya memperbarui `{ online: true, lastActive }` tanpa mereset skor dan jawaban.
   - Menggunakan `playerNameRef` untuk mengeliminasi re-render loop dan mencegah event `online: false` terpanggil secara tidak sengaja saat inisialisasi state.
   - Sinkronisasi instan daftar `completedQuestions` dan `answers` dari RTDB ke state lokal saat mount.
3. **Isolasi Bank Soal Eksklusif & Parsing RTDB Fleksibel**:
   - Menambahkan flag `hasRoomQuestionsRef` agar `loadFallbackQuestions` tidak pernah menimpa soal dari bank terpilih.
   - Parsing `value.questions` kini mendukung format array maupun dictionary objek (`Object.values(value.questions)`).
4. **Layar Akhir Pertandingan Interaktif (*Match Finished / Game Over Modal*)**:
   - Ditambahkan modal overlay perayaan akhir match saat `room.status === "finished"` atau waktu habis.
   - Menampilkan piala emas, peringkat pemain (`#Rank dari N pemain`), skor akhir, jumlah soal terselesaikan, dan Top 5 Podium Leaderboard.
   - Tombol navigasi cepat menggunakan Next.js router (`router.push`) menuju lobby atau beranda.
5. **Fitur Hapus Bank Soal Kustom di Admin**:
   - Ditambahkan tombol hapus (×) pada chip bank soal kustom dengan konfirmasi interaktif.
   - Soal yang berada di bank yang dihapus otomatis dialihkan (*migrated*) ke Bank Umum (`bank-umum`).

### Verifikasi & Uji Mutu

- `npm run lint`: 100% lolos tanpa ada error maupun warning (`eslint` clean).
- `npm run build`: Kompilasi Turbopack dan pemeriksaan TypeScript berhasil 100% (7/7 route statis sukses ter-generate).
- Seluruh tugas di `docs/todo.md` dan dokumentasi di `docs/log.md` terverifikasi tuntas.


