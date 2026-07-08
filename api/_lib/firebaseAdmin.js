// api/_lib/firebaseAdmin.js
//
// Firebase Admin SDK'yı sadece FCM (bildirim gönderme) için başlatıyoruz.
// Token depolama Redis'te (Upstash) yapılıyor, Firestore kullanılmıyor.
// _lib klasöründeki dosyalar Vercel tarafından fonksiyon olarak sayılmaz.
//
// GEREKLİ VERCEL ENVIRONMENT VARIABLES:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = { admin };
