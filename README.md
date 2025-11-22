# Anonymous Ticketing POC

**Proof-of-Concept** for an anonymous ticketing system addressing real-world Swiss public transport requirements (BLS, A-Welle) with cryptographic privacy guarantees.

## What This Is

A complete ticketing system POC where:
- **Passengers** use a PWA wallet (browser-based, no app download)
- **Conductors** use a laptop scanner (webcam QR scanning)
- **Anonymity** is cryptographically guaranteed (blind signatures)
- **Sharing prevention** via rotating QR codes (refresh every 30-60s)
- **Cash compliance** via anonymous prepaid voucher system

**Context**: Directly implements BLS/A-Welle's cashless transition strategy (Dec 2025 rollout), addressing constitutional concerns and discrimination prevention.

📖 **[Read Complete Architecture Specification →](./ARCHITECTURE.md)**  
*Includes: technical design, BLS alignment, legal considerations, implementation guide*

## Key Features

✅ **Complete anonymity** — conductor never sees PII  
✅ **Anti-screenshot sharing** — rotating cryptographic proofs  
✅ **Offline operation** — validators work without network  
✅ **Legal compliance** — prepaid system addresses cash payment requirements  
✅ **Anti-discrimination** — accessible to elderly, children, non-digital users  
✅ **Production-aligned** — solves real controversy in Swiss public transport

## Technology Stack

- **Crypto**: RSA blind signatures (Chaum-style) + HMAC rotating proofs
- **Frontend**: React 18 + Vite + Tailwind CSS + PWA (wallet + validator)
- **Backend**: FastAPI + PostgreSQL + Redis + Bloom filters
- **Deployment**: Docker Compose (full-stack local development)

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

## For Developer B — Frontend & Validator PWA

**You are Developer B.** You own all frontend code.

### Your Responsibilities

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

**Clear separation**:
- **Developer A** → Backend API, database, Docker Compose, payment adapter, crypto implementation
- **You (Developer B)** → All frontend code (wallet + validator PWAs)

**Integration**: API contract fully specified in ARCHITECTURE.md

---

## Documentation Structure

This repository has **two core documents**:

1. **README.md** (this file) — Quick start, developer tasks, practical guide
2. **ARCHITECTURE.md** — Complete specification:
   - Technical architecture & API contracts
   - Cryptographic approach (blind signatures, rotating proofs)
   - BLS real-world alignment & legal considerations
   - Database schema, deployment, testing plan
   - Developer task split (A vs B)

**Start here** → then refer to ARCHITECTURE.md for details.

---

## Getting Started

See "Quick Start" section above, then check your task list and begin implementing wallet/validator pages.

For questions or clarifications:
- ✅ Check ARCHITECTURE.md for API specs
- ✅ Coordinate with Developer A on backend endpoints
- ✅ Use `/test/verify` stub for frontend-only development

Happy coding! 🎟️
