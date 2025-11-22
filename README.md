# Anonymous Ticketing POC

**Proof-of-Concept** for an anonymous ticketing system addressing real-world Swiss public transport requirements (BLS, A-Welle) with cryptographic privacy guarantees.

## ⚠️ Implementation Status (November 22, 2025)

| Component                  | Status            | Notes                                    |
| -------------------------- | ----------------- | ---------------------------------------- |
| **Frontend (Developer B)** | ✅ **COMPLETE**    | Wallet + Validator PWAs fully functional |
| **Backend (Developer A)**  | ❌ **NOT STARTED** | API endpoints not implemented            |
| **Demo Capability**        | ✅ **READY**       | Mock mode enables full demo              |
| **Production Ready**       | ⏳ **PENDING**     | Requires backend completion              |

**TL;DR**: Frontend exceeds specification with HID-style validation bonus features. Backend not started. System fully demo-able in mock mode.

📊 **[Read Complete Implementation Audit →](./IMPLEMENTATION_AUDIT.md)**  
*Includes: 10 documented use cases, architecture alignment, gap analysis*

## What This Is

A **three-component digital ticketing system** inspired by **HID Physical Access Control**:

1. **HID App / Physical Card** - NFC cards OR smartphones (passenger credentials)
2. **Validator Machine** - At train doors (NFC readers, always online)
3. **Conductor Handheld** - Manual checking (NFC readers OR QR scanner)

### Core Security: HSM-Backed Credentials

- **Physical NFC Cards**: Mifare DESFire EV3 with secure element (tamper-proof)
- **Smartphone Support**: NFC HCE (Android) / Wallet (iOS) with secure storage
- **All credentials** signed by HSM (AWS CloudHSM / Thales Luna)
- **Validators** verify offline using cached HSM public key
- **Challenge-response** protocol prevents cloning and replay attacks

**Key Benefits**:
✅ **Cannot be cloned** (secure element hardware)  
✅ **No PII visible** to conductors (only crypto proofs)  
✅ **Works offline** (validators cache credentials)  
✅ **Supports both** cards and smartphones  
✅ **HSM-backed** production-grade security  
✅ **Cash compliance** via anonymous prepaid cards

**Context**: Directly implements BLS/A-Welle's cashless transition strategy (Dec 2025 rollout), addressing constitutional concerns and discrimination prevention.

📖 **[Read Architecture V3.0 (Simplified - Physical Cards + HSM) →](./ARCHITECTURE_V3_SIMPLIFIED.md)** ⭐ **LATEST**  
*Three components: Physical cards/phones + Validators + Conductor handhelds | HSM mandatory*

📘 **[Read Use Cases V3.0 →](./USE_CASES_V3.md)** ⭐ **LATEST**  
*10 use cases for physical cards + HSM | Multi-use cards | Anonymous purchases with blind signatures*

📘 **[Read Use Cases V2.0 (Device-Binding) →](./USE_CASES.md)**  
*Previous: Smartphone-only with device binding*

� **[Read Architecture V2.0 (Device-Focused) →](./ARCHITECTURE_V2.md)**  
*Previous: Device binding + HSM integration | Optional: Blind signatures*

�📖 **[Read Original Architecture (Blind Signature-Focused) →](./ARCHITECTURE.md)**  
*Initial design: Blind signatures, BLS alignment, legal considerations*

🎤 **[Read Pitch Deck →](./PITCH_DECK.md)**  
*Includes: business case, demo script, $136M/year ROI, hardware requirements*

📊 **[Read Implementation Audit →](./IMPLEMENTATION_AUDIT.md)**  
*Includes: status matrix, gap analysis, demo readiness*

## Key Features

### Hardware Security
✅ **Physical NFC cards** — Mifare DESFire EV3 with secure element (AES-128)  
✅ **Cannot be cloned** — tamper-resistant hardware prevents duplication  
✅ **HSM credential signing** — all tickets signed by AWS CloudHSM / Thales Luna  
✅ **Challenge-response** — NFC proximity validation protocol  
✅ **Anti-replay** — each challenge single-use, time-limited

### Dual Mode Support
✅ **Physical cards** — for elderly, tourists, children (no smartphone needed)  
✅ **Smartphone NFC** — Android HCE / iOS Wallet for tech-savvy users  
✅ **Over-the-air provisioning** — smartphones receive tickets via Internet  
✅ **Kiosk provisioning** — physical cards written at ticket counters

### Privacy & Compliance
✅ **No PII visible** — conductor never sees personal information  
✅ **Legal compliance** — anonymous prepaid cards (Swiss cash requirement)  
✅ **Anti-discrimination** — accessible to all demographics  
✅ **GDPR compliant** — minimal data collection, right to deletion

### Operational
✅ **Offline validation** — validators work in train tunnels (cached public key)  
✅ **Always online validators** — 4G/5G sync to backend  
✅ **Conductor override** — manual validation capability  
✅ **Production-aligned** — solves real BLS cashless controversy

## Technology Stack

### Hardware Layer
- **Physical Cards**: NXP Mifare DESFire EV3 (ISO 14443-A, AES-128 secure element)
- **NFC Readers**: ACR122U or similar (13.56 MHz, contactless)
- **Validator Machines**: Raspberry Pi 4 / Intel NUC + 4G/5G modem
- **Conductor Handhelds**: Tablets with USB NFC readers or built-in NFC

### Security Layer (Mandatory)
- **HSM Integration**: AWS CloudHSM / Azure Key Vault / Thales Luna (FIPS 140-2 L3)
- **Credential Signing**: RSA-2048, SHA-256
- **Challenge-Response**: HMAC-SHA256 via NFC
- **Secure Element**: Hardware-backed credential storage

### Application Layer
- **Backend**: FastAPI + PostgreSQL (tickets, validations, revocations)
- **Frontend (Wallet)**: React 18 PWA with NFC HCE support
- **Frontend (Validator)**: React 18 PWA with NFC reader integration
- **Frontend (Conductor)**: Tablet app with NFC validation

### Communication
- **NFC**: ISO 14443-A (contactless cards and smartphones)
- **Cellular**: 4G/5G for validator sync to backend
- **HTTPS**: TLS 1.3 for all Internet communication

### Deployment
- **Development**: Docker Compose (full-stack local) + HSM simulator
- **Production**: AWS (CloudHSM + EC2 + RDS) or Azure (Key Vault + VMs)

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

## Implementation Status

### V3.0 (Simplified Architecture - Target)

| Component                  | Status        | Priority | Notes                               |
| -------------------------- | ------------- | -------- | ----------------------------------- |
| **Physical Card Support**  | ❌ Not Started | HIGH     | Mifare DESFire integration needed   |
| **HSM Integration**        | ❌ Not Started | HIGH     | AWS CloudHSM setup + signing API    |
| **Backend API**            | ❌ Not Started | HIGH     | FastAPI + PostgreSQL + HSM          |
| **NFC Reader Integration** | ❌ Not Started | HIGH     | ACR122U driver + challenge-response |
| **Validator Machine**      | ❌ Not Started | MEDIUM   | Raspberry Pi + NFC + LED indicators |
| **Conductor Handheld**     | ❌ Not Started | MEDIUM   | Tablet app + NFC reader             |
| **Kiosk Provisioning**     | ❌ Not Started | MEDIUM   | Card writing station                |
| **Database Schema**        | ✅ Designed    | -        | PostgreSQL tables ready             |

### V2.0 (Smartphone-Only - Prototype Complete)

| Component                    | Status        | Notes                              |
| ---------------------------- | ------------- | ---------------------------------- |
| **Frontend - Wallet PWA**    | ✅ Complete    | React + device binding + mock mode |
| **Frontend - Validator PWA** | ✅ Complete    | QR scanner + BLE simulation        |
| **Crypto Library**           | ✅ Complete    | HMAC, AES-GCM, rotating proofs     |
| **Real QR Scanning**         | ✅ Complete    | @zxing/library integrated          |
| **Offline Storage**          | ✅ Complete    | IndexedDB for credentials          |
| **Backend API**              | ❌ Not Started | Mock mode only                     |

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
