# Anonymous Ticketing POC

This repository contains a Proof-of-Concept (POC) for an anonymous ticketing system where a **laptop acts as the validator/scanner** in the train and passengers use a **PWA wallet** (no native mobile app). The POC uses **RSA blind signatures** for unlinkable tokens and is designed to run locally with **Docker Compose**.

## Overview

- **Conductor/inspector must not see any personal identifier (PID)**
- **Support card payments** (mediated) and cash/voucher options for privacy
- **No physical gates** — enforce single-use via onboard validators + reconciliation
- **Laptop-based validator** using webcam QR scanning
- **PWA wallet** for passengers (works in phone browser)
- **Two-developer implementation** with clear task separation
- **Anti-sharing mechanism** — day tickets use rotating cryptographic proofs (QR codes refresh every 30-60s)

📖 **[Read the full architecture specification →](./ARCHITECTURE.md)**

### Key Features

- **RSA Blind Signatures** — unlinkable anonymous tokens (conductor never sees purchase details)
- **Rotating QR Codes** — prevents ticket sharing via screenshot (dynamic proofs change every 30-60s)
- **Offline-capable validator** — works without network using Bloom filters
- **No PII exposure** — conductor only sees "VALID" or "INVALID" status

---

## Repository Structure

```
/ (repo root)
  docker-compose.yml        # Docker Compose orchestration
  README.md                 # This file (Developer B guide)
  ARCHITECTURE.md           # Full architecture spec
  /backend                  # FastAPI Token Issuer (Developer A)
    /app
      main.py
      /routes
      /services
      /crypto
      /db
      /models
    Dockerfile
    requirements.txt
    gen_keys.py            # RSA key generator
  /frontend                 # React + Vite PWA (Developer B)
    /src
      main.jsx
      App.jsx
      /pages
        Wallet.jsx
        Validator.jsx
      /components
      /lib
        crypto.js          # Blind/unblind utilities
        storage.js         # IndexedDB wrapper
    Dockerfile
    package.json
    vite.config.js
    tailwind.config.cjs
  /payment-adapter          # Payment stub (Developer A)
    /app
      main.py
    Dockerfile
  /nginx                    # Reverse proxy
    nginx.conf
  /dev-scripts              # Development utilities
```

---

## Developer B — Frontend & Validator PWA (Your Tasks)

### Core Responsibilities

You will own the **frontend** — both the **Wallet PWA** (passenger app) and **Validator PWA** (conductor/laptop scanner app). This includes:

1. **Wallet PWA**:
   - Generate random token `T` client-side
   - Implement RSA blinding/unblinding (using issuer public key)
   - Store tokens in IndexedDB
   - Display QR code for redemption
   - Handle purchase flow (send blinded token to backend via payment adapter)

2. **Validator PWA**:
   - Webcam-based QR scanning (using `zxing-js` or `jsQR`)
   - Client-side signature verification
   - Bloom filter checks for offline operation
   - Online redemption via `POST /v1/redeem`
   - Offline log storage and sync (`POST /v1/sync_offline`)
   - Large Accept/Reject UI for conductors

3. **PWA Infrastructure**:
   - Service worker for offline app shell
   - PWA manifests for both apps
   - IndexedDB wrappers for token/log storage

4. **UI/UX**:
   - React + Tailwind CSS
   - React Router for `/wallet` and `/validator` routes
   - Responsive, conductor-friendly design

---

## Quick Start (Developer B — Local Dev)

### Prerequisites

- Node.js 18+ and npm
- (Optional) Docker Desktop if you want to run full stack

### 1. Install Frontend Dependencies

```powershell
cd "c:\Users\ikaik\Documents\Code\SBB app\frontend"
npm install
```

### 2. Start Development Server

```powershell
npm run dev
```

The dev server runs on `http://localhost:5173`:
- Wallet: `http://localhost:5173/wallet`
- Validator: `http://localhost:5173/validator`

### 3. (Optional) Run Full Docker Stack

When backend services are ready from Developer A:

```powershell
# From repo root
docker-compose up --build
```

Then access:
- Frontend: `http://localhost` (via nginx)
- Backend API: `http://localhost/api`
- Direct backend: `http://localhost:8000`

---

## Your Task List (Developer B)

### Phase 1: Setup & Skeleton ✅
- [x] React + Vite project with Tailwind CSS
- [x] React Router setup (`/wallet`, `/validator`)
- [x] Basic page components
- [x] PWA manifests

### Phase 2: Wallet PWA
- [ ] Token generation (256-bit random via Web Crypto API)
- [ ] RSA blinding/unblinding utilities (`src/lib/crypto.js`)
- [ ] IndexedDB storage for tokens (`src/lib/storage.js`)
- [ ] QR code generation (using `qrcode.react`)
- [ ] Purchase flow UI (simulate payment → receive signed blinded token → unblind → store)
- [ ] Token list view with expiry status

### Phase 3: Validator PWA
- [ ] Webcam QR scanner component (using `zxing-js`)
- [ ] Client-side signature verification (using issuer public key from `/keys/public`)
- [ ] Bloom filter download and check logic
- [ ] Online redemption flow (`POST /v1/redeem`)
- [ ] Offline log storage (IndexedDB)
- [ ] Sync UI with manual trigger (`POST /v1/sync_offline`)
- [ ] Large Accept/Reject status display

### Phase 4: PWA Features
- [ ] Service worker for offline app shell
- [ ] Install prompts for PWA
- [ ] Offline detection and UI indicators

### Phase 5: Testing & Demo
- [ ] Unit tests for crypto utilities (blind/unblind)
- [ ] E2E demo script (wallet purchase → validator scan)
- [ ] Documentation for frontend usage

---

## Key Dependencies

Already included in `package.json`:

- **React 18** + **React DOM**
- **React Router DOM** — client-side routing
- **Vite** — dev server and build tool
- **Tailwind CSS** — utility-first styling
- **idb** — IndexedDB wrapper
- **qrcode.react** — QR code generation

You may want to add:
- `@zxing/library` or `jsqr` — QR scanning
- `crypto-js` or native Web Crypto API — RSA blinding (see ARCHITECTURE.md for crypto approach)

---

## API Endpoints (Backend — Developer A)

Your frontend will interact with these endpoints:

### Wallet Purchase Flow
1. `POST /v1/verify_receipt` — verify payment with payment adapter
2. `POST /v1/sign_blinded` — get signed blinded token from issuer
3. `GET /keys/public` — fetch issuer public key for unblinding

### Validator Redemption Flow
1. `GET /keys/public` — fetch public key for signature verification
2. `GET /v1/bloom` — download Bloom filter for offline checks
3. `POST /v1/redeem` — redeem token (online)
4. `POST /v1/sync_offline` — sync offline accepted tokens

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for full API specification.

---

## Development Tips

### Hot Reload

Vite provides instant HMR. Edit files in `src/` and see changes immediately.

### Tailwind CSS

Use utility classes directly in JSX:

```jsx
<div className="flex items-center justify-center min-h-screen bg-gray-100">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
    Generate Token
  </button>
</div>
```

### IndexedDB Example

Use the `idb` library for cleaner IndexedDB operations:

```javascript
import { openDB } from 'idb';

const db = await openDB('wallet-db', 1, {
  upgrade(db) {
    db.createObjectStore('tokens', { keyPath: 'id' });
  },
});

await db.add('tokens', { id: '123', token: 'abc...', signature: 'xyz...' });
const tokens = await db.getAll('tokens');
```

### QR Scanning

For validator, use `@zxing/library`:

```javascript
import { BrowserQRCodeReader } from '@zxing/library';

const codeReader = new BrowserQRCodeReader();
const result = await codeReader.decodeOnceFromVideoDevice(undefined, 'video');
console.log(result.text); // QR payload
```

---

## Build for Production

```powershell
npm run build
```

Output goes to `dist/` and can be served statically or via the Docker container.

---

## Collaboration with Developer A

- **Developer A** owns backend, payment adapter, database, and Docker Compose orchestration
- **You (Developer B)** own frontend PWAs and all client-side logic
- **Integration point**: API contract defined in ARCHITECTURE.md

When Developer A has backend endpoints running:
1. Update your `.env` or `vite.config.js` to proxy API calls
2. Test wallet purchase flow end-to-end
3. Test validator redemption flow

---

## Questions or Blocked?

- Check **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed specs
- Coordinate API contracts with Developer A
- Use test mode endpoints (`/test/verify`) for frontend development without real payment integration

---

## Next Steps

1. ✅ Repository skeleton created
2. ✅ Frontend scaffold with Vite + React + Tailwind
3. 🚀 **Start implementing Wallet page** (`src/pages/Wallet.jsx`)
4. 🚀 **Start implementing Validator page** (`src/pages/Validator.jsx`)

Happy coding! 🎟️
