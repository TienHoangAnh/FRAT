# FRAT — AI Face Attendance MVP

## Quick Start

1. **Firebase project**
   - Create project at [Firebase Console](https://console.firebase.google.com)
   - Enable **Firestore** (production mode) and **Storage**
   - Register a **Web app** and copy config

2. **Config**
   ```bash
   cp js/firebase-config.example.js js/firebase-config.js
   ```
   Fill in `apiKey`, `projectId`, `storageBucket`, etc.

3. **Firestore index** (required for history query)
   - Collection: `attendance_logs`
   - Fields: `dateString` Asc, `checkinTime` Desc
   - Create via Firebase Console when prompted by first query error

4. **Deploy rules**
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

5. **Run locally**
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
   Open `http://localhost:8080` — **HTTPS or localhost required for camera**.

6. **Deploy hosting**
   ```bash
   firebase deploy --only hosting
   ```
   Or connect repo to **Vercel** (static site, root `.`).

## Firestore Collections

- `employees` — face descriptors + profile
- `attendance_logs` — check-in records with snapshot URLs

## Security Note

Demo rules allow open read/write. For production, add **Firebase Auth** and restrict rules.
