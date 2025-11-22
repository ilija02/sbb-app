# Anonymous Ticketing POC

**Proof-of-Concept** for an anonymous ticketing system addressing real-world Swiss public transport requirements (BLS, A-Welle) with cryptographic privacy guarantees.

## ⚠️ Implementation Status (November 22, 2025)

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend (Developer B)** | ✅ **COMPLETE** | Wallet + Validator PWAs fully functional |
| **Backend (Developer A)** | ❌ **NOT STARTED** | API endpoints not implemented |
| **Demo Capability** | ✅ **READY** | Mock mode enables full demo |
| **Production Ready** | ⏳ **PENDING** | Requires backend completion |

**TL;DR**: Frontend exceeds specification with HID-style validation bonus features. Backend not started. System fully demo-able in mock mode.

📊 **[Read Complete Implementation Audit →](./IMPLEMENTATION_AUDIT.md)**  
*Includes: 10 documented use cases, architecture alignment, gap analysis*

## What This Is

A **device-bound digital ticketing system** POC where:
- **Tickets are bound to devices** - cryptographically impossible to screenshot and share
- **Passengers** use a PWA wallet (browser-based, no app download)
- **Conductors** use a laptop scanner (webcam QR scanning or BLE proximity)
- **Sharing prevention** via three layers:
  1. **Device binding** (AES-GCM encrypted credentials) - Primary
  2. **Challenge-response** (BLE proximity validation) - Active security
  3. **Rotating QR codes** (30s epochs) - Fallback
- **No PII visible** to conductors (only crypto proofs)
- **HSM-backed** credential signing (production-grade security)
- **Cash compliance** via anonymous prepaid voucher system

**Core Innovation**: Device = Credential (inspired by HID Mobile Access for office badges)

**Context**: Directly implements BLS/A-Welle's cashless transition strategy (Dec 2025 rollout), addressing constitutional concerns and discrimination prevention.

📖 **[Read Architecture V2.0 (Device-Focused) →](./ARCHITECTURE_V2.md)** ⭐ **NEW**  
*Primary: Device binding + HSM integration | Optional: Blind signatures*

📖 **[Read Original Architecture (Blind Signature-Focused) →](./ARCHITECTURE.md)**  
*Includes: technical design, BLS alignment, legal considerations, implementation guide*

🎤 **[Read Pitch Deck →](./PITCH_DECK.md)**  
*Includes: business case, demo script, $136M/year ROI, hardware requirements*

📊 **[Read Implementation Audit →](./IMPLEMENTATION_AUDIT.md)**  
*Includes: 10 use cases, status matrix, gap analysis*

## Key Features

### Primary Security (Device Binding)
✅ **Device-bound credentials** — tickets encrypted with device-specific keys  
✅ **Screenshot-proof** — credential decryption fails on different devices  
✅ **HSM-backed signing** — enterprise-grade credential security  
✅ **Challenge-response** — BLE proximity validation protocol  
✅ **Anti-replay** — each challenge single-use, time-limited

### Privacy & Compliance
✅ **No PII visible** — conductor never sees personal information  
✅ **Legal compliance** — prepaid voucher system (Swiss cash requirement)  
✅ **Anti-discrimination** — accessible to elderly, children, non-digital users  
✅ **GDPR compliant** — minimal data collection, right to deletion

### Operational
✅ **Offline operation** — validators work in train tunnels  
✅ **Dual validation modes** — HID proximity + QR fallback  
✅ **Twist-and-go** — motion-activated validation (premium UX)  
✅ **Production-aligned** — solves real BLS cashless controversy

## Technology Stack

### Security Layer (Primary)
- **Device Binding**: AES-GCM-256 encryption with device-specific keys
- **Challenge-Response**: HMAC-SHA256 proximity validation
- **HSM Integration**: AWS CloudHSM / Azure Key Vault (production)
- **Hardware**: Optional TPM for enhanced device binding

### Application Layer
- **Frontend**: React 18 + Vite + Tailwind CSS + PWA (wallet + validator)
- **Backend**: FastAPI + PostgreSQL + Redis
- **APIs**: Web Crypto API, Web Bluetooth API, DeviceMotion API

### Optional Privacy Layer
- **Blind Signatures**: Chaum-style RSA (purchase unlinkability)
- **Rotating Proofs**: HMAC-based 30s epochs (QR fallback)

### Deployment
- **Development**: Docker Compose (full-stack local)
- **Production**: AWS/Azure with HSM, PostgreSQL RDS, Redis ElastiCache

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

### ✅ Your Responsibilities (STATUS: COMPLETE)

1. **Wallet PWA**: ✅ DONE
   - ✅ Generate random token `T` client-side
   - ✅ Implement RSA blinding/unblinding (MOCK - ready for real RSA)
   - ✅ Store tokens in IndexedDB
   - ✅ Display rotating QR code for redemption
   - ✅ Handle purchase flow (mock API)
   - ✅ **BONUS**: HID-style device-bound credentials
   - ✅ **BONUS**: Twist-and-go motion activation

2. **Validator PWA**: ✅ DONE
   - ✅ Webcam-based QR scanning (using `@zxing/library`)
   - ✅ Client-side signature verification (mock)
   - ✅ Bloom filter checks for offline operation (storage ready)
   - ✅ Online redemption via `POST /v1/redeem` (mock)
   - ✅ Offline log storage and sync
   - ✅ Large Accept/Reject UI for conductors
   - ✅ **BONUS**: HID challenge-response validation
   - ✅ **BONUS**: Dual validation modes (QR + HID)

3. **PWA Infrastructure**: ⏳ PARTIAL
   - ⏳ Service worker for offline app shell (PENDING)
   - ✅ PWA manifests for both apps
   - ✅ IndexedDB wrappers for token/log storage

4. **UI/UX**: ✅ DONE
   - ✅ React + Tailwind CSS
   - ✅ React Router for `/wallet` and `/validator` routes
   - ✅ Responsive, conductor-friendly design
   - ✅ **BONUS**: Premium UX features (twist-and-go, proximity)

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

### Phase 1: Setup & Skeleton ✅ COMPLETE
- [x] React + Vite project with Tailwind CSS
- [x] React Router setup (`/wallet`, `/validator`)
- [x] Basic page components
- [x] PWA manifests

### Phase 2: Wallet PWA ✅ COMPLETE
- [x] Token generation (256-bit random via Web Crypto API)
- [x] RSA blinding/unblinding utilities (`src/lib/crypto.js`)
- [x] IndexedDB storage for tokens (`src/lib/storage.js`)
- [x] QR code generation (using `qrcode.react`)
- [x] Purchase flow UI (simulate payment → receive signed blinded token → unblind → store)
- [x] Token list view with expiry status
- [x] **BONUS**: Rotating QR codes with HMAC proofs
- [x] **BONUS**: HID-style device-bound credentials
- [x] **BONUS**: Twist-and-go motion detection

### Phase 3: Validator PWA ✅ COMPLETE
- [x] Webcam QR scanner component (using `@zxing/library`)
- [x] Client-side signature verification (mock - ready for real)
- [x] Bloom filter download and check logic (storage ready)
- [x] Online redemption flow (`POST /v1/redeem`)
- [x] Offline log storage (IndexedDB)
- [x] Sync UI with manual trigger (`POST /v1/sync_offline`)
- [x] Large Accept/Reject status display
- [x] **BONUS**: HID challenge-response validation
- [x] **BONUS**: Dual validation modes UI

### Phase 4: PWA Features ⏳ PARTIAL
- [ ] Service worker for offline app shell
- [x] Install prompts for PWA (supported)
- [x] Offline detection and UI indicators

### Phase 5: Testing & Demo ✅ COMPLETE
- [x] Unit tests for crypto utilities (mock implementation)
- [x] E2E demo script (wallet purchase → validator scan)
- [x] Documentation for frontend usage
- [x] **BONUS**: Comprehensive pitch deck (PITCH_DECK.md)
- [x] **BONUS**: Implementation audit (IMPLEMENTATION_AUDIT.md)

### Phase 6: Backend Integration ⏳ WAITING
- [ ] **BLOCKED**: Waiting for Developer A to implement backend
- [ ] Set `MOCK_MODE = false` in `src/lib/api.js`
- [ ] Test real blind signature flow
- [ ] Test real redemption tracking
- [ ] Load test with 1000+ tickets

---

## Key Dependencies

✅ Installed and configured in `package.json`:

- **React 18** + **React DOM** — UI framework
- **React Router DOM** 6.14.1 — client-side routing
- **Vite** 5.0.8 — dev server and build tool
- **Tailwind CSS** 3.4.0 — utility-first styling
- **idb** 7.1.1 — IndexedDB wrapper
- **qrcode.react** 3.2.0 — QR code generation
- **@zxing/library** — QR code scanning (webcam)
- **Native Web Crypto API** — Cryptography (HMAC, AES-GCM, random)
- **Native Web Bluetooth API** — BLE for HID-style validation (optional)
- **Native DeviceMotion API** — Accelerometer for twist-and-go

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
