// api/_lib/firebaseAdmin.js
//
// Firebase Admin SDK'yı sadece FCM (bildirim gönderme) için başlatıyoruz.
// Token depolama Redis'te (Vercel KV / Upstash) yapılıyor, Firestore kullanılmıyor.
// _lib klasöründeki dosyalar Vercel tarafından fonksiyon olarak sayılmaz.
//
// GEREKLİ VERCEL ENVIRONMENT VARIABLES:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export { admin };
