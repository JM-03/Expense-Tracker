# 🔥 Panduan Setup Firebase

Ikuti langkah-langkah di bawah agar aplikasi Holiday Tracker bisa sinkron di semua perangkat.

---

## Step 1 — Buat Project Firebase

1. Buka **https://console.firebase.google.com**
2. Login dengan akun Google
3. Klik **"Create a project"** (atau "Add project")
4. Isi nama project: `holiday-tracker` (atau nama bebas)
5. **Disable** Google Analytics (tidak perlu) → klik **Create Project**
6. Tunggu hingga selesai → klik **Continue**

---

## Step 2 — Tambahkan Web App

1. Di halaman utama project, klik icon **Web** (`</>`)
2. Isi nama app: `Holiday Tracker`
3. **Jangan** centang Firebase Hosting
4. Klik **Register app**
5. Kamu akan melihat kode konfigurasi seperti ini:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB.....................",
  authDomain: "holiday-tracker-xxxxx.firebaseapp.com",
  projectId: "holiday-tracker-xxxxx",
  storageBucket: "holiday-tracker-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

6. **Copy** semua nilai di atas

---

## Step 3 — Isi Konfigurasi

1. Buka file **`firebase-config.js`** di repository kamu
2. Ganti isi file dengan konfigurasi dari Step 2:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyB.....................",
    authDomain: "holiday-tracker-xxxxx.firebaseapp.com",
    projectId: "holiday-tracker-xxxxx",
    storageBucket: "holiday-tracker-xxxxx.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

3. **Commit** perubahan di GitHub

---

## Step 4 — Buat Firestore Database

1. Di Firebase Console, klik **Build** → **Firestore Database** (di sidebar kiri)
2. Klik **Create database**
3. Pilih lokasi server: **asia-southeast1 (Singapore)** ← terdekat dari Indonesia
4. Pilih **Start in test mode** → klik **Create**

---

## Step 5 — Set Security Rules

1. Di Firestore, klik tab **Rules**
2. Ganti isinya dengan:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripCode} {
      allow read, write: if true;
      match /expenses/{expenseId} {
        allow read, write: if true;
      }
    }
  }
}
```

3. Klik **Publish**

> ⚠️ Rules ini mengizinkan semua orang yang punya kode trip untuk membaca/menulis data.
> Ini aman untuk penggunaan pribadi karena kode trip berfungsi sebagai "password".

---

## ✅ Selesai!

Sekarang buka **https://jm-03.github.io/Expense-Tracker/** dan:

1. **Buat Trip Baru** → kamu akan mendapat **kode 6 digit**
2. **Bagikan kode** ke HP lain atau teman
3. Di perangkat lain, buka link yang sama → pilih **Gabung** → masukkan kode
4. Semua data akan **sinkron secara real-time!** 🎉

---

## 💡 Tips

- Kode trip berfungsi seperti "password" — hanya orang yang punya kode bisa akses
- Data tersinkron otomatis, termasuk saat offline (akan sync saat online lagi)
- Kamu bisa buat banyak trip terpisah, masing-masing dengan kode berbeda
- Klik tombol **Share** (🔗) di app untuk melihat dan menyalin kode trip
