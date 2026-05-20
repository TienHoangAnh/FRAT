# FRAT — AI Face Attendance MVP

## Quick Start

1. **Firebase project**
   - Create project at [Firebase Console](https://console.firebase.google.com)
   - Enable **Firestore** (production mode)
   - Register a **Web app** and copy config

2. **Config**
   ```bash
   cp js/firebase-config.example.js js/firebase-config.js
   ```
   Or use `.env` + `npm run env:build`

3. **Firestore index** (required for history query)
   - Collection: `attendance_logs`
   - Fields: `dateString` Asc, `checkinTime` Desc
   - Create via Firebase Console when prompted by first query error

4. **Deploy rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Run locally**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3456` (or `npx serve .`) — **localhost / HTTPS required** for camera and ES modules. **Do not open `file://`**.

6. **AI models (face-api)**
   - Weights load from **jsdelivr + unpkg** (`@vladmandic/face-api@1.7.14/model/`).
   - Needs working internet; adblock / corporate firewall can block CDN — allow `cdn.jsdelivr.net`, `unpkg.com`, `www.gstatic.com`.

7. **Deploy hosting**
   ```bash
   firebase deploy --only hosting
   ```
   Or connect repo to **Vercel** (static site, root `.`).

## Firestore Collections

- `employees` — face descriptors + profile
- `attendance_logs` — check-in records

## Security Note

Demo rules allow open read/write. For production, add **Firebase Auth** and restrict rules.
