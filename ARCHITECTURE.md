# Anonymous Ticketing System — Complete Architecture Specification

**Version**: 1.0  
**Date**: November 22, 2025  
**Context**: LauzHack 2025 / BLS Cashless Transition (Dec 2025)

---

## Executive Summary

This document specifies a **Proof-of-Concept (POC)** for an anonymous ticketing system that addresses real-world requirements from Swiss public transport operators (BLS, A-Welle/Aargau) transitioning to cashless operations while maintaining:

✅ **Complete passenger anonymity** (no PII visible to conductors)  
✅ **Legal compliance** (constitutional cash payment via prepaid cards)  
✅ **Anti-discrimination** (accessible to elderly, children, non-digital users)  
✅ **Anti-sharing** (rotating QR codes prevent screenshot fraud)  
✅ **Offline operation** (validators work without network)  
✅ **Cost efficiency** (no cash handling in ticket machines)

### Real-World Context (2025)

**BLS & A-Welle cashless transition** (Dec 2025 - Mid 2026):
- Ticket machines no longer accept cash (cost savings: CHF 400k/year for BLS)
- **Controversy**: Public outcry about discrimination, constitutional challenges threatened
- **Solution**: Anonymous prepaid cards purchasable with cash at counters
- This POC implements exactly this solution using cryptographic blind signatures

### Core Technologies

- **Cryptography**: RSA blind signatures (Chaum-style) for unlinkable tokens
- **Anti-sharing**: Time-based rotating proofs (HMAC) — QR codes refresh every 30-60s
- **Frontend**: React PWA (wallet + validator) with IndexedDB + service workers
- **Backend**: FastAPI with PostgreSQL, Redis, Bloom filters
- **Deployment**: Docker Compose for full-stack local development

### Key Innovations

1. **Blind signatures** — Issuer never sees raw token, conductor never sees purchase details
2. **Rotating cryptographic proofs (RCP)** — Prevents screenshot-based ticket sharing
3. **Prepaid voucher system** — Legal/social solution to cashless discrimination concerns
4. **Offline validator** — Bloom filters + local signature verification + sync reconciliation

---

## Table of Contents

1. [Goals (Requirements)](#goals-requirements)
2. [High-Level Components](#high-level-components)
3. [Crypto Approach (Blind Signatures)](#crypto-approach-core-idea)
4. [Anti-Sharing Mechanism (Rotating Proofs)](#anti-sharing-mechanism-for-day-tickets-rotating-cryptographic-proofs)
5. [Data Model (Database Schema)](#data-model-db-tables)
6. [API Specification](#api-specification-httpjson)
7. [Validator Behavior](#validator-behavior-laptop-scanner-pwa)
8. [Wallet Behavior (PWA)](#wallet-pwa-behavior-passenger)
9. [Payment Approaches](#payment-approaches-for-poc)
10. [Offline Strategy](#offline-strategy--double-spend-detection)
11. [Docker Compose](#docker-compose-poc-example)
12. [Repository Layout](#repos--file-layout-recommended)
13. [API Examples](#api-contract-examples-curl)
14. [Developer Task Split](#developer-split-two-developers--ownership--tasks)
15. [Testing Plan](#testing-plan-poc)
16. [Security & Privacy](#security--privacy-considerations)
17. [Real-World Alignment (BLS)](#real-world-alignment-bls-cashless-transition-2025)
18. [Extras & Extensions](#extras--nice-to-haves-optional-poc-extensions)
19. [Deliverables Checklist](#deliverable-checklist-what-to-push-to-repo-right-away)
20. [Sequence Diagrams](#example-minimal-sequence-diagrams-ascii)

---

## Goals (requirements)

* **Conductor / inspector must not see any personal identifier (PID).**
* **Support card payments** (mediated) and **anonymous prepaid cards** (BLS-style) for privacy and legal compliance.
* **No physical gates** — enforce single-use via onboard validators + reconciliation.
* **Laptop acts as scanner/validator** (POC) using webcam-based QR scanning or USB NFC reader (optional).
* **No native mobile app** — use a PWA as the passenger wallet (works in phone browser or laptop).
* **Two devs can implement** the prototype; tasks split clearly.
* Use **Docker Compose** for local deployment of services.
* **Address cashless controversy** — prepaid system must solve discrimination concerns.

---

# High-level components

1. **Token Issuer API (Backend)** — issues blind-signed tokens after verifying payment; central authority.
2. **Payment Gateway Adapter** — adapter service integrating with a test payment gateway (stub for POC). Provides `verify_receipt`.
3. **PWA Wallet (Frontend)** — browser-based wallet for passengers that:
   * generates tokens locally,
   * creates blinded tokens,
   * stores signed tokens,
   * presents QR when boarding.
4. **Validator App (Frontend PWA running on laptop/scanner)** — conductor's app for scanning QR, validating signature, and marking tokens spent. Operates in online + offline mode.
5. **Central DB (Postgres)** — stores token metadata, spent ledger, receipts (only minimal metadata), revocations, audit logs.
6. **Redis** — fast cache + atomic mark operations (optional) and distributed lock for atomic spent marking.
7. **Bloom filter service / endpoint** — provides regularly updated Bloom filter of spent tokens to offline validators.
8. **Optional: Scratch voucher service** — generate prepaid codes sold physically (for cash anonymity).
9. **Reverse proxy / Nginx** — serve frontend and route APIs.
10. **Local dev tooling** — scripts to issue test receipts and sample wallets.

All services run in Docker Compose for POC.

---

# Crypto approach (core idea)

* Use **Chaum-style blind signatures** (RSA blind signatures) for unlinkable tokens:
  * Wallet generates random token `T` (256-bit random number) and blinds it `B(T)` using issuer public key.
  * Kiosk/PaymentAdapter sends `B(T)` and a proof-of-payment (receipt ID) to Token Issuer.
  * Token Issuer verifies payment, signs `B(T)` producing `Sig(B(T))`.
  * Kiosk forwards `Sig(B(T))` to wallet; wallet unblinds → `Sig(T)`.
  * Wallet stores `{T, Sig(T), expiry}` in local storage (IndexedDB).
* On redemption, wallet shows QR containing `{T, Sig(T), optional HMAC proof-of-possession if enabled}`.
* Validator verifies `Sig(T)` and atomically writes `T` to spent ledger.

**Notes**

* RSA blind signatures are easy to implement for a POC. For production, consult crypto experts (consider more modern blind-sign variants and side-channel resistance).
* Optionally include a per-token secret `S` (generated by wallet) so validator can challenge with a nonce to prevent static QR replays. Use HMAC(S, nonce) as proof-of-possession.

---

# Anti-sharing mechanism for day tickets (Rotating Cryptographic Proofs)

## Problem

A user buying a "day ticket" must not be able to share the ticket with another person (e.g., taking a screenshot of the QR code and sending it to a friend).

### Constraints

- **No gates / turnstiles** — validation happens onboard by conductor
- **Conductor validation only** — human-in-the-loop verification
- **No mobile app** (preferably PWA) — works in browser
- **No personal data (PII) visible to conductor** — maintain anonymity
- **Anonymous tickets must still be possible** — privacy-preserving
- **Ticket must not be reusable by multiple people** — prevent sharing

## Solution: Rotating Cryptographic Proofs (RCP)

Use **time-based rotating QR codes** that change every N seconds (e.g., 30-60 seconds) and are cryptographically bound to the ticket.

### Mechanism

1. **Master Ticket Token (MTT) issuance**:
   - When a daily ticket is purchased, the server issues a **Master Ticket Token (MTT)** using blind signatures (as described above).
   - MTT includes: `{ticket_id, validity_period, master_secret}`.
   - The MTT is stored in the PWA's IndexedDB (never leaves the device).

2. **Time-based Rotating Proof generation** (client-side in PWA):
   ```
   current_epoch = floor(current_timestamp / rotation_interval)
   rotating_proof = HMAC(master_secret, current_epoch || ticket_id)
   ```
   - The PWA generates a new `rotating_proof` every N seconds (e.g., 30s).
   - The QR code contains: `{ticket_id, rotating_proof, current_epoch, signature}`.

3. **Validator verification** (conductor's laptop):
   - Validator scans the QR code and extracts `{ticket_id, rotating_proof, current_epoch}`.
   - Validator fetches the `master_secret` from the backend (or uses cached Bloom filter + signature verification).
   - Validator recomputes: `expected_proof = HMAC(master_secret, current_epoch || ticket_id)`.
   - If `rotating_proof == expected_proof` **and** the epoch is recent (within ±1 epoch window for clock skew), accept.
   - Validator marks this `(ticket_id, current_epoch)` as used (to prevent replay within the same epoch).

4. **Anti-sharing enforcement**:
   - If Alice takes a screenshot of the QR code at `epoch=100` and sends it to Bob:
     - By the time Bob tries to use it at `epoch=101` (30s later), the QR is expired.
     - Even if Bob tries immediately at `epoch=100`, the validator will reject it because `(ticket_id, epoch=100)` was already used by Alice.
   - The only way to generate valid rotating proofs is to have the `master_secret`, which remains locked in Alice's PWA IndexedDB.

### Server-side validation flow

```
POST /v1/redeem_rotating
Request: {
  "ticket_id": "uuid",
  "rotating_proof": "<base64>",
  "current_epoch": 123456,
  "validator_id": "laptop-01"
}

Server checks:
1. Is ticket_id valid and not expired?
2. Recompute expected_proof = HMAC(master_secret_for_ticket, epoch || ticket_id)
3. Does rotating_proof match expected_proof?
4. Is current_epoch within acceptable range (current ± 1 epoch)?
5. Has (ticket_id, current_epoch) already been used? (check spent_epochs table)
6. If all pass → mark (ticket_id, current_epoch) as used and return "accepted"
```

### Database additions

```sql
-- Store master secrets for issued day tickets (server-side, encrypted)
master_tickets:
  ticket_id uuid primary key,
  master_secret bytea,  -- encrypted with server key
  validity_start timestamptz,
  validity_end timestamptz,
  ticket_type text,     -- 'single-use' | 'day' | 'monthly'
  created_at timestamptz

-- Track used epochs to prevent replay within same epoch
spent_epochs:
  ticket_id uuid,
  epoch bigint,
  redeemed_at timestamptz,
  validator_id text,
  PRIMARY KEY (ticket_id, epoch)
```

### PWA implementation notes

- Use `setInterval()` to regenerate QR code every 30 seconds.
- Display countdown timer: "QR refreshes in 25s...".
- Store MTT in IndexedDB with encryption (use device-bound key if available).
- Never expose `master_secret` in DevTools or network traffic.

### Security properties

✅ **Screenshot-proof**: Static QR codes expire after rotation interval
✅ **Sharing-proof**: Master secret never leaves original device
✅ **Replay-proof**: Each (ticket_id, epoch) can only be used once
✅ **Anonymous**: No PII in QR or validator logs
✅ **Offline-capable**: Validator can cache master secrets or use Bloom filters

### Trade-offs

- **Rotation interval**: Shorter = more secure but requires tighter clock sync. Recommended: 30-60 seconds.
- **Clock skew tolerance**: Allow ±1 epoch window (±30-60s) for validator/wallet clock differences.
- **Offline validators**: Must sync spent_epochs periodically; risk of double-spend in offline mode (mitigated by Bloom filters).

### Example QR payload (rotating)

```json
{
  "ticket_id": "a1b2c3d4-...",
  "rotating_proof": "5f8a3b2c9d1e...",
  "epoch": 1732291200,
  "exp": "2025-11-22T23:59:59Z",
  "sig": "<base64 signature>"
}
```

---

# Data model (DB tables)

Postgres schema (POC):

```sql
users:  (NOT used for anonymous tickets; only admin users)
  id (uuid), email, password_hash, role, created_at

receipts:
  id (uuid), payment_provider, provider_receipt_id, amount_cents, currency, status, created_at

issued_tokens:
  id uuid primary key,
  token_hash bytea,    -- H(token T) stored for privacy (store only hash)
  signature bytea,
  expiry timestamptz,
  created_at timestamptz,
  issuer_meta jsonb,   -- optional minimal metadata
  receipt_id uuid REFERENCES receipts(id)  -- link to receipt only for auditing; contain no PID in app DB

spent_tokens:
  token_hash bytea primary key,
  redeemed_at timestamptz,
  validator_id text,
  validator_meta jsonb

revoked_tokens:
  token_hash bytea primary key,
  reason text,
  created_at timestamptz

audit_logs:
  id uuid, event_type text, payload jsonb, created_at timestamptz
```

**Privacy note:** store only `H(T)` (SHA-256) in DB to avoid storing raw token values. `T` remains with wallet only. Signatures must be verifiable against public key.

---

# API specification (HTTP/JSON)

Use **FastAPI** (Python) or similar. All endpoints authenticated by API keys for services (kiosk/validator). Minimal endpoints:

## Public (unauthenticated or with public key use)

* `GET  /health` — simple health check.

## Token Issuance / Payment flow

* `POST /v1/verify_receipt`
  - Request: `{ "payment_provider": "TEST", "provider_receipt_id": "abc-123" }`
  - Response: `{ "receipt_id": "uuid", "status": "verified" }`

* `POST /v1/sign_blinded`
  - Request: `{ "receipt_id": "uuid", "blinded_token": "<base64>" }`
  - Response: `{ "signed_blinded": "<base64>" }`
  - Behavior: Token Issuer verifies `receipt_id` -> if ok, returns signature; DOES NOT receive or store `T`.

## Token Redemption

* `POST /v1/redeem`
  - Request: `{ "token": "<base64 T>", "signature": "<base64 Sig(T)>", "validator_id": "laptop-01" }`
  - Response: `{ "status": "accepted" }` or `{ "status": "rejected", "reason": "spent|invalid|expired" }`
  - Behavior: Server validates signature, checks expiry, atomically inserts `H(T)` into `spent_tokens`. Return accepted or rejected.

## Admin / Bloom filter

* `GET /v1/bloom`
  - Returns the current Bloom filter (base64) and metadata (valid_until). Validators download this periodically for offline checks.

## Sync offline logs

* `POST /v1/sync_offline`
  - Request: `{ "validator_id": "...", "accepted_tokens": [ {"token_hash": "...", "t": "...", "local_id": "..." } ] }`
  - Response: summary of conflicts/detected duplicates.

## Voucher / Prepaid Card service

* `POST /v1/create_voucher` (admin/staff) — create prepaid voucher codes with balance (simulates BLS prepaid card purchase at counter).
  - Request: `{ "balance_cents": 5000, "currency": "CHF", "staff_id": "..." }`
  - Response: `{ "voucher_code": "ABC-123-XYZ", "balance": 5000, "expires": "2026-12-31" }`
* `POST /v1/redeem_voucher` — kiosk/wallet redeems voucher to produce blind-signing (simulates anonymous prepaid card payment).
  - Request: `{ "voucher_code": "ABC-123-XYZ", "amount_cents": 500, "blinded_token": "<base64>" }`
  - Response: `{ "signed_blinded": "<base64>", "remaining_balance": 4500 }`
* `GET /v1/voucher_balance` — check prepaid voucher balance (optional for POC).

## Keys

* `GET /keys/public` — publish issuer public key (for wallets to blind/unblind/verify).

---

# Validator behavior (laptop-scanner PWA)

**Primary mode**: PWA served over HTTPS (use `localhost` with self-signed for POC or use ngrok). The validator app runs in browser in kiosk mode or regular browser window on laptop.

## Capabilities

* Use webcam for QR scanning (library: `zxing-js` or `jsQR`).
* Accepts QR payloads in compact JSON or CBOR. Example QR payload:
  ```json
  {
    "t": "<base64 token>",
    "sig": "<base64 signature>",
    "exp": "2025-11-23T12:00:00Z",
    "proof": "<optional base64 HMAC>"
  }
  ```
* Immediately verify the signature using issuer public key (client-side) for faster feedback (recommended).
* Check local Bloom filter: if token is likely spent (Bloom says maybe) — do online verify. If Bloom indicates not spent, proceed to optimistic accept.
* On accept: attempt online `POST /v1/redeem` to atomically mark spent. If online succeeds → accept.
* If offline: store in local offline log (IndexedDB) with timestamp and display accepted. Sync to server (`POST /v1/sync_offline`) when online.

## UI

* Scan view with large Accept / Reject indicators.
* Show only: `Ticket VALID — expires in N min` or `INVALID / SPENT`.
* Do not show purchase method, name, card, or other PID.
* Button for manual sync & diagnostics (for conductor).

## Anti-replay (optional)

* On each scan, validator generates nonce; wallet recomputes HMAC with token secret. Validator verifies HMAC (requires token secret never transmitted — only HMAC). This prevents static image replay from copied QR images if secrets remain with wallet.

## Operational mode

* The laptop runs the PWA in full-screen, docked to webcam. Use `--app` mode in Chrome if desired.

---

# Wallet (PWA) behavior (passenger)

* Lightweight PWA (React/Vite) that:
  * Generates random token `T` client-side.
  * Blinds token `B(T)` using issuer public key (blinding factor only on client).
  * Sends `B(T)` to kiosk/payment adapter on purchase.
  * Receives signed blinded token, unblinds to get `Sig(T)`.
  * Stores `{T, Sig(T), expiry}` in IndexedDB.
  * Shows QR on demand for validator or NFC if supported.
  * Optionally supports offline use; wallet must keep token secret `T` safe.

**No account required.** PWA can be installed to home-screen; service-worker for offline app shell.

---

# Payment approaches for POC

* **Card payments (mediated)**: Kiosk collects card via local terminal. Kiosk receives `provider_receipt_id` from PaymentAdapter and sends it to Token Issuer with `B(T)`. Token Issuer verifies via PaymentAdapter API and signs blinded token.
* **Anonymous prepaid card (BLS-style)**: Passenger purchases a reloadable prepaid card at BLS sales counter with cash. Card is loaded with credit and can be used anonymously at ticket machines. In our POC, this is equivalent to voucher system:
  - Admin/sales staff creates prepaid voucher codes with balance
  - Passenger uses prepaid code at kiosk to purchase tokens
  - Kiosk redeems voucher code → issues blind-signed token
  - No PII collected (completely anonymous purchase path)
* **Voucher / scratch codes**: Admin or cash partner creates voucher codes; user redeems at kiosk to receive `Sig(T)`.
* **Test mode**: For POC, PaymentAdapter is a stub that returns `verified` for receipts posted to `/test/verify`.

**Real-world mapping (BLS scenario)**:
- **Cashless machines** → Your kiosk component (accepts cards + prepaid codes)
- **Prepaid card purchase at counter** → `/v1/create_voucher` (staff generates code, passenger pays cash)
- **Anonymous ticket purchase** → Passenger uses prepaid code → blind signature issuance
- **Validator on train** → Your laptop-based validator PWA

**Important**: Token Issuer should never receive raw PAN or cardholder name — only `provider_receipt_id` or `voucher_code`. Payment adapter & kiosk manage card details and keep them out of ticketing DB.

---

# Offline strategy & double-spend detection

1. **Bloom filter distribution**:
   * Token Issuer generates a Bloom filter of `spent_tokens` daily/hourly (configurable).
   * Validators download Bloom filter (small size; tuned to your expected daily token volume).
   * Example sizing for POC: assume 100k tokens/day, false positive 1% → Bloom ~12MB (tune down for POC).

2. **Offline acceptance policy**:
   * Accept offline but mark as `pending` in local log.
   * Require validators to sync before route end or within X hours (configurable).

3. **Conflict resolution**:
   * Server resolves by choosing earliest `redeemed_at` timestamp and flags duplicates for review.

4. **Heuristics**:
   * If a token is redeemed in widely separated locations at overlapping times, mark as fraud and produce forensic logs.

---

# Docker Compose (POC example)

Below is a minimal `docker-compose.yml` you can use as base for POC:

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: ticket
      POSTGRES_PASSWORD: ticketpass
      POSTGRES_DB: ticketdb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  payment-adapter:
    build: ./payment-adapter
    env_file: ./payment-adapter/.env
    ports:
      - "8010:8010"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    env_file: ./frontend/.env
    ports:
      - "3000:3000"

  nginx:
    image: nginx:stable
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - api

volumes:
  pgdata:
```

* `backend` (api) runs FastAPI + Uvicorn.
* `frontend` serves both Wallet PWA and Validator PWA (or split into two frontends).
* `payment-adapter` is a stub; in production integrate with payment provider.

---

# Repos & file layout (recommended)

```
/ticketing-poc
  /backend
    /app
      main.py
      routes/
      services/
      crypto/
      db/
      models/
    Dockerfile
  /frontend
    /src
      /pages
        Wallet.jsx
        Validator.jsx
      App.jsx
      main.jsx
    Dockerfile
  /payment-adapter
    Dockerfile
  /nginx
    nginx.conf
  docker-compose.yml
  README.md
  ARCHITECTURE.md
  dev-scripts/
    gen_keys.py
    gen_test_receipts.py
```

`gen_keys.py` will create RSA keys and example blinded-sign helper for the POC.

---

# API contract examples (curl)

**Request blind sign**

```bash
curl -X POST https://api.local/v1/sign_blinded \
  -H "Authorization: ApiKey token_XXXX" \
  -H "Content-Type: application/json" \
  -d '{"receipt_id":"uuid...", "blinded_token":"BASE64"}'
```

**Redeem**

```bash
curl -X POST https://api.local/v1/redeem \
  -H "Authorization: ApiKey validator_key" \
  -d '{"token":"BASE64_T","signature":"BASE64_SIG","validator_id":"laptop-01"}'
```

---

# Developer split (Two developers) — ownership & tasks

I split tasks into **Developer A (Backend & Infra)** and **Developer B (Frontend & Validator)**. Each developer has independent tasks with minimal overlap. Where overlap exists, include unit/integration test responsibilities.

## Developer A — Backend / Infra (Token Issuer owner)

### Core responsibilities

* Implement Token Issuer API (FastAPI). Endpoints: `sign_blinded`, `verify_receipt`, `redeem`, `bloom`, `sync_offline`.
* Implement database schema migrations (Alembic).
* Implement blind signature logic & key management (RSA keys, key rotation stub).
* Implement receipt verification stub and `payment-adapter` integration.
* Implement spent-token atomic insert using Postgres `INSERT ... ON CONFLICT` + Redis lock if needed.
* Implement Bloom filter generator (periodic job).
* Provide Dockerfile and CI tasks to run unit tests.
* Provide `gen_keys.py` and dev scripts for producing test tokens & receipts.
* API documentation (OpenAPI) and sample Postman / curl flows.
* Provide sample env and deployment via Docker Compose.

### Concrete tasks

1. Project skeleton and Dockerfile for backend.
2. Postgres models & migrations.
3. Implement `sign_blinded` endpoint (cryptography + safe checks).
4. Implement `redeem` endpoint with atomic spent insertion.
5. Implement `bloom` generator job & endpoint.
6. Implement `sync_offline` reconciliation logic (earliest timestamp wins, mark duplicates).
7. Add logging & audit events.
8. Add unit tests for crypto flows and DB operations.
9. Document API and create curl examples.

### Deliverables

* `backend/` directory with running API on `localhost:8000`.
* RSA key pair and `gen_keys.py`.
* README for backend usage.

---

## Developer B — Frontend & Validator (PWA owner)

### Core responsibilities

* Implement Wallet PWA (generate `T`, blind/unblind flow, store tokens, show QR).
* Implement Validator PWA (scan QR via webcam, local signature verification, local Bloom check, redeem flow to API, offline log sync).
* Implement service-worker and IndexedDB logic for offline logs.
* Implement QR scanning (zxing-js), QR payload parsing, and compact payload encoding.
* Implement UI for both Wallet and Validator (simple, big fonts for conductor).
* Provide Dockerfile for frontend build and nginx config.
* Write e2e POC demo script (how to produce a valid token using backend and present to validator).
* Implement unit tests for wallet functions (blinding/unblinding) and validator scanning.

### Concrete tasks

1. Set up React/Vite skeleton and PWA manifest.
2. Implement wallet: token generation, blinding/unblinding (JS crypto), IndexedDB storage.
3. Implement validator: camera-based QR scanning, signature verification (JS), Bloom filter download, offline log storage.
4. Implement fetch logic to `POST /v1/redeem` and handle responses.
5. Implement sync UI & diagnostics (manual sync button).
6. Integrate with backend public key endpoint, test flows.
7. Provide README and demo instructions.

### Deliverables

* `frontend/wallet` PWA running at `http://localhost:5173/wallet` (dev) or `http://localhost:3000/wallet` (prod build).
* `frontend/validator` PWA running at `http://localhost:5173/validator` (dev) or `http://localhost:3000/validator` (prod build).
* Demo script showing purchase, issuance, scan, redeem.

---

# Testing plan (POC)

* **Unit tests**: crypto primitives (blind/unblind), signature verification, DB operations.
* **Integration tests**:
  * Wallet → PaymentAdapter (test receipt) → Sign blinded → Wallet unblinds → Validator redeems.
  * Offline accept: Validator offline accepts → sync_offline → validate conflict detection.
* **Manual flows** (checklist for demo):
  1. Start `docker-compose up`.
  2. Run `gen_keys.py` to create issuer keys.
  3. Backend exposes public key at `/keys/public`.
  4. Wallet creates `T`, blinds, and posts `B(T)` to backend via `payment-adapter` test endpoint.
  5. Backend returns `Sig(B(T))`, wallet unblinds to `Sig(T)` and stores it.
  6. Validator scans QR; verifies signature locally; posts to `/v1/redeem`; server marks spent; validator shows ACCEPT.
  7. Re-scan same QR → REJECT as spent.

---

# Security & privacy considerations

* **Never store raw token `T` in server DB**; store `H(T)` only. If the server stores `receipt_id`, keep it minimal and do not store any cardholder data.
* **Transport**: all APIs use HTTPS (for POC you can use local TLS or run behind nginx with self-signed cert).
* **Key management**: protect issuer private key. For POC store in mounted volume; for production use HSM or cloud KMS.
* **Replay prevention**: Use token expiry and optional challenge-response with per-token secrets stored only on wallet.
* **Audit**: write `audit_logs` for all issuance and redemption events.
* **Rate limiting**: limit issuance per `receipt_id` to prevent bulk issuance.
* **Legal**: card transactions will be logged by banks. Communicate this to stakeholders. See "Real-World Alignment" section for legal/social considerations in Swiss context.

---

# Example minimal sequence diagrams (ASCII)

**Issuance (card at kiosk)**

```
Wallet -> Kiosk: send B(T)
Kiosk -> PaymentAdapter: charge card
PaymentAdapter -> Kiosk: receipt_id
Kiosk -> TokenIssuer: sign_blinded(B(T), receipt_id)
TokenIssuer -> Kiosk: Sig(B(T))
Kiosk -> Wallet: Sig(B(T))
Wallet: unblind -> Sig(T) (store)
```

**Redemption (validator online)**

```
Wallet -> Validator (QR scan)
Validator -> TokenIssuer: /redeem {T, Sig(T)}
TokenIssuer: verify Sig(T), insert H(T) into spent_tokens atomically -> accepted
Validator: show ACCEPT
```

**Redemption (validator offline)**

```
Wallet -> Validator (QR scan)
Validator: verify Sig(T) locally & check Bloom -> likely not spent -> accept & log locally
Validator (later) -> TokenIssuer: /sync_offline {accepted_tokens}
TokenIssuer: insert earliest wins; flag duplicates
```

---

# Deliverable checklist (what to push to repo right away)

* `docker-compose.yml`
* `backend/` with FastAPI skeleton + `sign_blinded`, `redeem`, `bloom` endpoints + `gen_keys.py`.
* `payment-adapter/` stub for POC.
* `frontend/` with wallet and validator PWA skeleton (React + service worker).
* `README.md` with run instructions and demo script (no time estimates).
* `ARCHITECTURE.md` with full spec.
* `tests/` with unit tests for blind-sign and redeem flows.

---

# Real-World Alignment: BLS Cashless Transition (2025)

## Context: Swiss Public Transport Cashless Controversy

### Timeline & Key Events

**November 2025** — BLS announces:
- Cashless ticket machine rollout (Dec 2025 - Mid 2026)
- Cost savings: CHF 400k/year (no cash handling)
- Anonymous prepaid cards available at sales counters
- Cantonal support: Bern backs the transition

**September 2025** — A-Welle (Aargau) controversy:
- 20min article: "Diskriminierung: Billettautomaten nehmen bald kein Bargeld mehr"
- 386 public comments (major engagement)
- Constitutional challenge threatened by cash initiative advocates

### Legal & Social Concerns Raised

#### 1. Discrimination Accusations
- **Elderly people** without smartphones or bank cards
- **Children** without payment methods
- **Privacy-conscious travelers** who prefer cash
- **Socially disadvantaged** without bank accounts

**Public reactions** (from 20min article):
> "What about older people? This is nonsense." — News-Scout Reto Buchs
>
> "This is an outrageous infringement and unconstitutional." — News-Scout Pesche

#### 2. Constitutional Challenge
**Richard Koller** (Freiheitliche Bewegung Schweiz / Cash Initiative):
> "The abolition of cash at ticket machines is not only antisocial but also unconstitutional. Cash is legal tender in Switzerland — and public transport as state infrastructure must comply with the Federal Constitution."

Threatens **legal action** against state transport operators.

#### 3. Industry Response: Prepaid Card Solution

**BLS & A-Welle official position**:
> "Prepaid cards can be purchased at sales counters with cash and then used anonymously at ticket machines."

**Christine Neuhaus** (A-Welle CEO):
> "The prepaid payment card is a sensible solution for children, people without smartphones, and travelers who wish to remain anonymous."

**Key statistics** (A-Welle):
- 75% of passengers buy tickets digitally
- Only 18% still use ticket machines
- Cash usage at machines declining rapidly

### How This POC Addresses Real-World Requirements

| BLS/A-Welle Requirement  | POC Implementation                           | Status |
| ------------------------ | -------------------------------------------- | ------ |
| Cashless ticket machines | Payment adapter + card support               | ✅      |
| Anonymous prepaid option | `/v1/create_voucher` + `/v1/redeem_voucher`  | ✅      |
| No PII required          | Blind signatures + H(T) storage              | ✅      |
| Cash acceptance (legal)  | Prepaid cards sold at counters with cash     | ✅      |
| Elderly accessibility    | Physical prepaid card (no smartphone needed) | ✅      |
| Privacy protection       | Unlinkable tokens, no purchase history       | ✅      |
| Anti-discrimination      | Equal access via prepaid system              | ✅      |
| Cost efficiency          | No cash handling in machines                 | ✅      |

### Technical Equivalence: BLS Prepaid Card ↔ POC Voucher System

```
BLS Real-World                     POC Implementation
──────────────────────────────────────────────────────────────
Physical prepaid card              Voucher code (e.g., "ABC-123-XYZ")
Purchase at BLS counter with cash  POST /v1/create_voucher (staff endpoint)
Card balance tracking              vouchers table with balance_cents
Use card at cashless machine       POST /v1/redeem_voucher (wallet → backend)
Anonymous ticket issuance          Blind signature returned
On-train validation                Validator PWA (laptop scanner)
QR code verification               Signature verification + spent check
```

### Workflow Mapping: Real-World vs POC

#### Real-World (BLS):
1. Passenger brings cash to BLS counter
2. Staff sells prepaid card, loads CHF 50 balance
3. Passenger uses prepaid card at cashless ticket machine
4. Machine issues anonymous ticket (no PII collected)
5. Conductor validates ticket on train (sees only "VALID/INVALID")

#### POC Simulation:
1. Admin/staff uses `POST /v1/create_voucher` → generates code with balance
2. Passenger receives voucher code (simulates prepaid card)
3. Passenger enters code in wallet PWA → sends `POST /v1/redeem_voucher` with blinded token
4. Backend verifies voucher, deducts amount, returns blind signature
5. Wallet unblinds → stores anonymous token → displays QR code
6. Validator scans QR → verifies signature → marks spent

### Why Prepaid/Voucher System is Critical

**Not just a feature** — it's the **legal and social compliance mechanism**:

1. ✅ **Constitutional compliance** — Cash still accepted (at counters, not machines)
2. ✅ **Discrimination prevention** — Accessible to all passenger groups
3. ✅ **Digital divide mitigation** — No smartphone/bank account required
4. ✅ **Privacy rights protection** — Anonymous payment option maintained
5. ✅ **Cost optimization** — Machines remain cashless (lower maintenance)
6. ✅ **Legal defensibility** — Documented alternative payment path

### Production Deployment Considerations

If implementing this system in real Swiss public transport:

#### Legal Documentation
- ✅ Document that cash is accepted (via prepaid card purchase)
- ✅ Show non-discriminatory access path for all passenger groups
- ✅ Maintain audit trail of prepaid card issuance
- ✅ Prepare response to constitutional challenges

#### Accessibility Strategy
- Clear signage: "No cash at machines? Buy prepaid card at counter"
- Multiple sales points (not just BLS counters)
- Partnership with Kiosks, Post offices (under discussion per BLS)
- Training programs for elderly passengers (BLS collaboration with Pro Senectute)
- Multilingual instructions at sales counters

#### Monitoring & Compliance
- Track prepaid card adoption rates
- Monitor complaints about accessibility
- Regular audits of alternative payment path availability
- Prepare for potential legal challenges from cash initiative

### Reference Materials

**Press Releases & Articles**:
- BLS: "Laufende Erneuerung der BLS-Billettautomaten ab Dezember" (November 2025)
- 20min: "Diskriminierung: Billettautomaten nehmen bald kein Bargeld mehr" (September 2025)
- Cash Initiative: "Volksinitiative 'Münz und Noten für immer'" (pending)

**Key Organizations**:
- BLS AG (Bern-Lötschberg-Simplon railway)
- A-Welle Tarifverbund (Aargau tariff zone: Olten-Aarau-Baden)
- Freiheitliche Bewegung Schweiz (FBS) — Cash initiative
- Pro Senectute — Elderly advocacy organization

---

# Extras / Nice-to-haves (optional POC extensions)

* Add **USB NFC reader support** in validator (Node/Chromium WebUSB) for card-based NFC wallets.
* Add **PDF / printable QR** generation for single-use tokens (for passengers without phone).
* Add **analytics dashboard** (aggregate only: #tokens issued, #redeemed) without PID.
* Add **device attestation** for optional non-anonymous passes.
* **BLS prepaid card simulation**: Create a simple "card number + PIN" system instead of voucher codes to simulate physical prepaid cards more realistically.

---

# What you can hand to GitHub Copilot

A good prompt to place in your repo (top-level `README.md` or `copilot-prompt.txt`):

> "Build a POC for an anonymous ticketing system using Docker Compose. Implement a Token Issuer (FastAPI), a Payment Adapter (stub), and two PWAs (wallet, validator) in React. Use RSA blind signatures for unlinkable tokens. Provide API endpoints: sign_blinded, verify_receipt, redeem, bloom, sync_offline. Postgres stores H(token) and spent tokens. Validator runs in browser on a laptop using webcam QR scanning. Wallet generates token, blinds/unblinds, stores in IndexedDB. Provide gen_keys.py to generate issuer key pair. Include a Docker Compose file that runs: postgres, redis, api, payment-adapter, frontend, nginx. Create unit tests for blind-sign and redeem flows."
