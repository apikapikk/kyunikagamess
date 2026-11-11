# Firebase Environment Setup

## Menyiapkan environment lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Buka Firebase Console → **Project settings** → **Your apps** → pilih Firebase Web App.
3. Salin nilai dari object `firebaseConfig` ke variabel `NEXT_PUBLIC_FIREBASE_*` yang sesuai.
4. Isi `NEXT_PUBLIC_FIREBASE_DATABASE_URL` hanya jika Realtime Database diaktifkan.
5. Jalankan ulang server development setelah mengubah `.env.local`.

Halaman admin saat ini otomatis membaca koleksi `questions` dan `rooms` dari Cloud Firestore. Jika koleksi belum ada atau Firebase gagal diakses, halaman memakai data lokal sebagai fallback. Pembuatan dan penghapusan soal serta pembuatan room akan disimpan ke Firestore ketika konfigurasi berhasil.

Aktifkan **Cloud Firestore** di Firebase Console sebelum menguji penyimpanan. Untuk tahap multiplayer berikutnya, aktifkan juga **Realtime Database** dan gunakan `NEXT_PUBLIC_FIREBASE_DATABASE_URL` yang diberikan Firebase.

Jika log menampilkan URL `your-project-id-default-rtdb...`, nilai `NEXT_PUBLIC_FIREBASE_DATABASE_URL` masih placeholder. Salin URL asli dari halaman Realtime Database, lalu restart `npm run dev`.

Jika muncul `Missing or insufficient permissions`, buka tab **Rules** pada Firestore/Realtime Database. Rules default yang terkunci memang akan menolak operasi client. Untuk development lokal, gunakan rules sementara yang sesuai kebutuhan pengujian dan segera ganti dengan rules berbasis Authentication sebelum dipublikasikan.

Contoh pemetaan:

```ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};
```

## Keamanan

Firebase Web `apiKey`, `authDomain`, `projectId`, dan `appId` memang dirancang untuk ikut terkirim ke browser. Nilai tersebut bukan pengganti security rules. Keamanan tetap ditentukan oleh Firebase Authentication, Firestore/Realtime Database Rules, dan App Check.

Jangan pernah memasukkan service-account JSON, `private_key`, atau credential Admin SDK ke variabel `NEXT_PUBLIC_*` atau ke kode client. Credential server harus tetap berada di backend/serverless environment.

Catatan game: koleksi yang di-fetch oleh pemain sebaiknya tidak berisi field `answer`. Jawaban benar perlu dipisahkan atau divalidasi oleh mekanisme server agar pemain tidak dapat melihatnya dari browser.

`.env.local` sudah tercakup oleh `.gitignore` dan tidak boleh di-commit. File yang boleh masuk repository hanya `.env.example` dengan placeholder.

