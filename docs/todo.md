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

---

## 6. Orbit Kamera Sentuh, Fisika Prop, Name Tag Pemain, Sebaran Soal Jauh, & Monitor Spectator Admin

- [x] **6.1. Swipe Layar → Rotasi Kamera Orbit (Pitch + Yaw)**
  - Memperbarui logika swipe pointer di `components/CityCanvas.tsx` agar sentuhan di area non-joystick merotasi kamera secara orbit mengelilingi mobil pemain.
  - Menyimpan `swipeYaw` dan `swipePitch` via `useRef`; `swipePitch` di-clamp antara 10°–65°.
  - Pivot kamera selalu ke posisi mobil pemain dengan offset `camYaw` + `swipeYaw` dan ketinggian berdasarkan pitch.
  - Membedakan sentuhan joystick (kuadran kanan bawah layar) vs sentuhan kamera agar tidak bertabrakan.

- [x] **6.2. Fisika Benturan Prop Kecil (Terlempar) vs Bangunan (Memantul)**
  - Menambahkan kategori collider: `ColliderBox & { kind: 'building' | 'prop' }`.
  - Prop kecil (planter, cone, bollard): saat ditabrak, benda terlempar (animasi `FlyingPropMesh` ~1.5 detik) dengan parabola fisika nyata (gravitasi, spin).
  - Bangunan: tetap rigid; saat tabrakan mobil memantul kecil (`speedRef *= -0.3`).
  - Implementasi `FlyingPropState` + `FlyingPropMesh` dengan animasi parabola per frame.
  - `handlePropHit` callback dari `PlayerCarController` → `CityScene` spawn flying prop.
  - Throttle spawn 400ms agar tidak spam, max 5 flying props sekaligus, auto-remove setelah 1.6 detik.

- [x] **6.3. Tag Nama Pemain Melayang di Atas Mobil**
  - Menggunakan `<Html>` dari `@react-three/drei` di atas group mobil pemain lokal dan avatar remote.
  - Menambahkan prop `playerName` ke `CityCanvasProps` → `CityScene` → `PlayerCarController`.
  - CSS `.player-nametag` di `app/globals.css`: pill gelap semi-transparan, teks putih kecil, backdrop-filter blur.
  - Versi diri sendiri pakai `.player-nametag--self` (biru muda).

- [x] **6.4. Sebaran Soal Tersebar Jauh (Minimum Gap 30 Unit)**
  - `seededPoints()` menerapkan seleksi greedy dengan jarak minimum 30 unit antar soal.
  - Soal tidak menumpuk di area tengah; prioritas sebaran ke seluruh penjuru grid 220×220.

- [x] **6.5. Admin Spectator / World Monitor Real-Time**
  - Menambahkan `WorldMonitorMap` di `app/admin/page.tsx` di dalam `RoomMonitor`.
  - SVG top-down 360×360px: grid jalan abu-abu sesuai koordinat avenue, titik soal (ungu/hijau), dot pemain berwarna + label nama.
  - Posisi pemain real-time dari RTDB `rooms/{code}/players/{id}/position`.
  - Mengimpor `AVENUES` & `seededPoints` dari `components/CityCanvas.tsx`.
  - CSS `.world-monitor-map-wrap` di globals.css.

- [x] **6.6. Perluasan Kota & Pemanfaatan Semua Aset**
  - Memanfaatkan fence variants (fence-1x2, fence-1x4, fence-2x2, fence-low), driveway-short, driveway-long, path-stones tiles dari `public/assets/`.
  - Meningkatkan kepadatan prop dari 45% → 55% slot dengan interval lebih rapat (18 → 14 unit).
  - Menambahkan `StreetProps` yang menempatkan pagar di suburban block perimeter, driveway di depan rumah, path-stone di plaza midtown.
  - Preload semua extra suburban assets.

- [x] **6.7. Pengujian Build & Pembaruan Log**
  - `npx tsc --noEmit` berhasil tanpa error TypeScript.
  - `npm run build` sukses 100% (5.8s compile, 7/7 static pages).
  - Memperbarui `docs/log.md` dengan ringkasan teknis semua perubahan di section 6.

---

## 7. Pembersihan & Whitelist Aset Git (.gitignore)

- [x] **7.1. Audit & Ekstraksi Model 3D Aktif**
  - Mengidentifikasi 88 model GLB yang aktif digunakan dalam runtime 3D game (kendaraan, gedung komersial, perumahan, infrastruktur jalan, prop jalan).
  - Mengidentifikasi 1.400+ file aset mentah yang tidak digunakan (FBX, OBJ, Previews, HTML, URL, textur cadangan, kit industrial yang tidak aktif, dan mini-characters).
- [x] **7.2. Konfigurasi Whitelist di `.gitignore`**
  - Menerapkan aturan default ignore untuk `public/assets/3d-assets/**`.
  - Memberikan pengecualian unignore (`!`) secara ketat hanya untuk file `License.txt` dan 88 file GLB aktif.
- [x] **7.3. Pemulihan Tracking Seluruh Model & Texture Aset**
  - Mengembalikan file `.gitignore` agar tidak memblokir texture (`colormap.png`, variations) dan model GLB.
  - Menjalankan `git add public/assets/3d-assets` untuk memastikan seluruh texture dan model siap di-push ke Git repository tanpa ada texture yang hilang/rusak.
- [x] **7.4. Verifikasi Build & Status Git**
  - Menjalankan `npm run build` untuk memastikan tidak ada aset penting yang hilang (hasil kompilasi sukses 100%).

---

## 8. Fitur Import Bank Soal dari Markdown (.md)

- [x] **8.1. Parser Soal Markdown Fleksibel (`parseMarkdownQuestions`)**
  - Mendeteksi judul kategori bank baru dari header `# Judul Bank Soal`.
  - Mendukung format Pilihan Ganda:
    - Huruf pilihan `A.`, `- A.`, `A)`, `(A)`.
    - Task list `- [x]` (otomatis kunci) dan `- [ ]`.
    - Penanda inline pada opsi `(kunci)`, `(benar)`, `(correct)`, `*`.
    - Baris kunci eksplisit `Kunci: B`, `Jawaban: B`, `Answer: B`.
  - Mendukung format Isian Singkat:
    - Deteksi otomatis jika tidak ada pilihan ganda atau baris `Tipe: isian` / `Type: short-answer`.
    - Kunci jawaban dari baris `Jawaban: ...` / `Kunci: ...`.
  - Mendukung nilai poin kustom: `Poin: 150`, `Points: 100`, `Nilai: 80` (default 100 pts).
- [x] **8.2. Antarmuka Modal Import Markdown di Admin (`app/admin/page.tsx`)**
  - Tombol aksi `📥 Import Markdown` pada bar pilihan Bank Soal.
  - Textarea input markdown luas dengan font monospace dan placeholder panduan format.
  - Tombol `📋 Muat Contoh Format` yang langsung mengisi template contoh kuis siap coba.
  - Dukungan upload file langsung dari komputer (`.md` dan `.txt`).
  - Kolom Live Preview interaktif: menampilkan jumlah soal valid, total akumulasi poin, tipe soal (badge warna), butir pertanyaan, opsi jawaban, dan kunci jawaban ter-highlight.
  - Pilihan penyimpanan ke Bank Soal yang sudah ada atau otomatis membuat Bank Soal baru berdasarkan judul markdown.
- [x] **8.3. Persistensi & Notifikasi**
  - Menyimpan batch soal baru ke state dan Firestore (`questions` dan `questionBanks`).
  - Banner konfirmasi sukses hijau tosca setelah soal berhasil tersimpan.
  - Auto-switch tampilan ke Bank Soal tujuan.
- [x] **8.4. Verifikasi & Build**
  - `npx tsc --noEmit` lolos 100% tanpa error TypeScript.
  - `npm run build` sukses 100% (7/7 static pages terkompilasi).

---

## 9. Sistem Pemilihan Map (Map Selection), Integrasi Aset 3D Baru, Ekspansi Dunia 260x260, & Kendali Mobil Buttery Smooth

- [x] **9.1. Antarmuka Pemilihan Map & Tema Dunia di Modal Room Baru (`/admin`)**
  - Mengganti kotak preview statis dengan selector tema map interaktif:
    - 🌐 **Mega Gabungan (4 Distrik)**: Metropolis + Industri + Suburbia + Lembah Alam.
    - 🏙️ **Metropolis Sentral**: Gedung pencakar langit & commercial boulevard.
    - 🌲 **Lembah Hijau & Camping**: Hutan pinus, tebing batu, tenda camping & api unggun.
    - 🏭 **Kawasan Industri & Cargo**: Pabrik, kontainer kargo, cerobong & tangki.
    - 🏡 **Kota Suburbia Asri**: Kompleks hunian rumah, pagar rapi, taman & jalan setapak.
    - 🎲 **Acak Otomatis (Surprise Random)**: Randomisasi otomatis per room.
  - Menampilkan kartu pratinjau tema dinamis dengan ikon visual, nama peta, dan ringkasan fitur.
  - Chip informatif: Nama tema terpilih, Skala 260×260 (100 Blok), Seed baru, dan Nama Bank Soal.
  - Menyimpan `cityTheme` dan `mapTheme` ke Firestore dan Realtime Database (`rooms/{code}/meta`).
  - Menampilkan ikon tema map pada kartu Room Aktif dan Room Monitor.

- [x] **9.2. Integrasi Aset 3D Baru (Nature Kit & Industrial Kit)**
  - Mengintegrasikan aset 3D baru dari `public/assets/3d-assets/kenney_nature-kit`:
    - Pohon pinus dan oak (`tree_pineDefaultA`, `tree_pineTallA`, `tree_pineRoundA`, `tree_oak`, `tree_detailed`).
    - Formasi tebing batu & boulder (`cliff_block_rock`, `cliff_block_stone`, `rock_largeA`, `rock_tallA`, `rock_smallA`).
    - Area perkemahan (`tent_detailedOpen`, `tent_smallClosed`, `campfire_stones`, `log_stack`, `bridge_wood`, `plant_bush`).
  - Mengintegrasikan aset 3D dari `public/assets/3d-assets/kenney_city-kit-industrial_2.0`:
    - Bangunan pabrik & gudang (`building-a` s/d `building-f`).
    - Kontainer kargo pelabuhan (`shipping-container-a/b/c`).
    - Infrastruktur industri: cerobong (`chimney-basic`, `chimney-large`), tangki kimia/air (`detail-tank`, `detail-tank-large`), menara air (`water-tower`), dan panel surya (`solar-panel-portrait`).
  - Menambahkan preload seluruh aset baru via `useGLTF.preload` untuk mencegah stuttering.

- [x] **9.3. Ekspansi Skala Dunia Menjadi 260×260 Unit (11 Avenue, 100 Blok)**
  - Menambah 2 avenue besar sehingga jaringan jalan memiliki 11 avenue utama:
    `AVENUES = [-100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100]` dengan rentang jalan dari `-112` hingga `+112`.
  - Memperluas bidang tanah ground plane menjadi `260×260` unit dengan palet warna dinamis sesuai tema.
  - Menambah batas tabrakan dunia menjadi `limit = 108.0`.
  - Memperluas generator blok kota menjadi 10×10 = **100 blok perkotaan** terstruktur (+56% lebih luas).
  - Memperbanyak titik kandidat sebaran soal (`candidateSpots`) hingga 100+ titik mencakup ring terluar ±100 dengan seleksi greedy jarak minimum 30 unit.
  - Memperbarui `WorldMonitorMap` di Admin agar menggunakan `WORLD_RANGE = WORLD_HALF_SIZE (130)` sehingga spectator map 2D mencakup seluruh 11 avenue secara presisi 1:1.

- [x] **9.4. Perombakan Kendali Mobil Menjadi Super Smooth (Fisika & Kamera Damping)**
  - **Steering Input Smoothing (`steerAngleRef`)**: Menghilangkan belokan kaku/snap instan keyboard & joystick dengan interpolasi sudut kemudi lerp (`steerLerpSpeed = 9.5 rad/s`).
  - **Dynamic Speed-Adaptive Turning Curve**: Kurva belok adaptif terhadap kecepatan jelajah (`speedFactor 0.28 - 1.0`) sehingga mobil stabil di kecepatan tinggi dan lincah bermanuver di tikungan.
  - **Natural Rolling Coasting (`coastDrag = 2.4`)**: Menghilangkan pengereman mendadak saat melepas gas, mobil meluncur (*coast/glide*) halus alami.
  - **Smooth Progressive Braking & Reverse Transition**: Menekan tombol mundur saat melaju ke depan berfungsi sebagai rem progresif halus hingga kecepatan 0 sebelum bertransisi mundur, menghindari sentakan balik mendadak.
  - **Buttery Damped Follow Camera (`smoothCamYawRef`)**: Rotasi kamera di-smooth dengan lag teredam (~6.5 rad/s) dan lead dinamis ke depan arah laju, mengeliminasi kamera snapping/jittering saat berbelok tajam.
  - **Smooth Wall-Sliding Collision**: Menghilangkan bouncing kasar negatif saat menyerempet trotoar/bangunan, mobil meluncur mulus sepanjang dinding pembatas.

- [x] **9.5. Sinkronisasi Tema Map ke Gameplay HUD (`/game`)**
  - Meneruskan `mapTheme` dari meta room ke `CityCanvas`.
  - Banner HUD game di pojok kiri bawah menampilkan nama tema map aktif (misal: `LEMBAH HIJAU & CAMPING · SEED 123456`).
  - Pencahayaan (ambient & directional light) dan warna ground otomatis menyesuaikan atmosfer tema map yang dipilih.

---

## 10. Penggantian Mobil Pemain dengan Karakter Hewan Cube Pets (Local & Remote Multiplayer)

- [x] **10.1. Integrasi Koleksi 3D Cube Pets (`kenney_cube-pets_1.0`)**
  - Menyiapkan daftar 18 varian hewan kubus lucu format GLB dari `public/assets/3d-assets/kenney_cube-pets_1.0/Models/GLB format/`:
    - `alpaca.glb`, `bear.glb`, `cat.glb`, `chicken.glb`, `cow.glb`, `deer.glb`, `dog.glb`, `duck.glb`, `elephant.glb`, `fox.glb`, `giraffe.glb`, `horse.glb`, `llama.glb`, `monkey.glb`, `panda.glb`, `pig.glb`, `sheep.glb`, `zebra.glb`.
  - Menjalankan `useGLTF.preload` untuk seluruh varian Cube Pets di awal runtime demi mencegah frame drop.
- [x] **10.2. Penggantian Controller Pemain Lokal (`PlayerPetController`)**
  - Menggantikan model mobil lokal dengan model Cube Pets berskala proporsional (`scale = 1.15`) yang pas dengan trotoar dan jalan raya.
  - Model menghadap natural ke arah depan (+Z) tanpa rotasi offset artifisial.
  - Implementasi animasi lompat berlari lucu (*cute hopping bounce* via `hopRef` dan fungsi sinusoidal `Math.sin(hopRef) * 0.16`) yang aktif saat hewan bergerak maju/mundur.
  - Implementasi efek goyang waddle miring (*tilt waddle* `Math.sin(hopRef * 0.5) * 0.08`) saat berlari dan belok.
  - Menambahkan bayangan dinamis lembut (*soft shadow disk*) di bawah telapak hewan (`[0, 0.02, 0]`).
  - Menempatkan nametag pemain di atas kepala hewan (`[0, 2.3, 0]`) dengan warna cerah dan keterbacaan tinggi.
- [x] **10.3. Penggantian Avatar Pemain Lain (`RemotePetAvatar`)**
  - Menggantikan kendaraan remote multiplayer dengan avatar Cube Pets.
  - Setiap remote player mendapatkan varian hewan unik berdasarkan hash ID pemain secara konsisten.
  - Interpolasi posisi (`lerp`) dan rotasi (`slerp`) halus dengan nametag melayang di atas kepala.
- [x] **10.4. Pengujian Build & Verifikasi Kompilasi**
  - `npx tsc --noEmit` bersih tanpa error TypeScript.
  - `npm run build` sukses 100% (7/7 static routes terkompilasi dengan Turbopack).

- [x] **9.6. Verifikasi, Uji Build & Pembaruan Dokumentasi**
  - `npx tsc --noEmit` lolos 100% tanpa error TypeScript.
  - `npm run build` sukses 100% (7/7 static pages terkompilasi dalam 1.6s).
  - Memperbarui `docs/todo.md` dan `docs/log.md` secara terperinci.
