# System Architecture

Complete technical specification of the privacy-preserving ticketing system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Token-Based Flow](#token-based-flow)
4. [Signature Protocol](#signature-protocol)
5. [Validator Operations](#validator-operations)
6. [Privacy Model](#privacy-model)
7. [Storage Schema](#storage-schema)
8. [Security Considerations](#security-considerations)

---

## System Overview

### Architecture Principles

1. **Clone-Proof Hardware**: DESFire EV3 smart cards with challenge-response authentication
2. **Privacy-Enhanced Design**: Payment method separated from travel, conductor anonymity
3. **Offline-First**: Validators work without network
4. **Fraud Prevention**: Hardware-backed keys + duplicate detection + cryptographic signatures
5. **Automatic Expiration**: Signed expiration timestamps checked during validation
6. **Scalability**: O(1) validation lookup, automatic cleanup

### Privacy Reality
**⚠️ This is NOT full anonymity. Backend can track per-account travel history.**

**What IS private:**
- ✅ Payment method not linked to specific trips (token layer)
- ✅ Conductors cannot track individuals (no cardId transmitted)
- ✅ Delayed location tracking (validator sync)

**What is NOT private:**
- ❌ Backend knows: Account X bought ticket for route Y
- ❌ Backend can correlate: Ticket Y validated at location Z
- ❌ Backend builds per-account travel history

### System Actors

```
┌─────────────┐
│   Kiosk     │  → Token sales + ticket generation
└─────────────┘
       │
       ↓
┌─────────────┐
│ User Device │  → Card/phone with tickets
└─────────────┘
       │
       ↓
┌─────────────┐
│  Validator  │  → Platform entrance/conductor scanner
└─────────────┘
       │
       ↓
┌─────────────┐
│   Backend   │  → Central server (HSM, database)
└─────────────┘
```

### Technology Stack

**Frontend (Demo):**
- React 18 + Vite 5 + Tailwind CSS
- IndexedDB (Dexie.js)
- BroadcastChannel API (cross-tab sync)

**Backend (Production):**
- Node.js / Java / Go
- HSM (AWS CloudHSM / Azure Key Vault)
- PostgreSQL + Redis
- REST API + WebSocket

**Cryptography:**
- DESFire EV3: AES-128 challenge-response (hardware-protected keys)
- Backend: RSA-2048 digital signatures (NOT blind signatures)
- Hashing: SHA-256
- Transport: TLS 1.3 with certificate pinning

---

## Core Components

### 1. Virtual Token System

**Purpose**: Separate payment from journey selection

```javascript
// Token balance (generic credits)
{
  accountId: 'uuid',
  balance: 5000,  // CHF 50.00 (cents)
  transactions: [
    {
      type: 'purchase',
      amount: 5000,
      timestamp: 1234567890,
      paymentMethod: 'credit_card'
    }
  ]
}
```

**Properties:**
- Tokens are fungible (not tied to specific routes)
- Backend knows: "Account X has CHF 50" (NOT where they'll travel)
- Purchase decoupled from ticket generation

### 2. Ticket Structure

```javascript
{
  // Identity
  ticketId: 'uuid',           // Unique identifier
  
  // Journey details
  type: 'single',             // single, day_pass, multi_day
  route: 'ZH → BE',           // Origin → Destination
  class: 2,                   // 1st or 2nd class
  zones: ['110', '111'],      // Zone-based pricing
  
  // Validity
  validFrom: 1700000000,      // Unix timestamp
  validUntil: 1700086400,     // Unix timestamp
  
  // Pricing
  price: 2500,                // CHF 25.00 (cents)
  
  // Cryptography (Backend)
  signature: 'base64...',     // RSA-2048 backend signature
  publicKeyId: 'key_2024_11_23',  // Which backend key signed this
  
  // Cryptography (DESFire)
  cardKeyId: 'hash_of_aes_key'  // Reference to card's hardware-protected key
}
```

**Important**: 
- Backend signs ALL fields (not blind signature) to verify pricing
- DESFire card has hardware-protected AES key for challenge-response
- Card key provisioned once during onboarding, never leaves hardware

### 3. DESFire Card Provisioning

**Key Provisioning (During Onboarding)**:

```javascript
// Backend generates unique AES key for this card
const cardKey = crypto.randomBytes(16);  // AES-128
const cardKeyId = SHA256(cardKey);  // Store only hash

// Write key to DESFire card (ONE TIME)
await desfire.authenticate(masterKey);
await desfire.changeKey(keySlot: 1, newKey: cardKey);

// Store reference in database
await db.cards.insert({
  cardKeyId: cardKeyId,  // Hash only, not actual key
  accountId: user.accountId,
  provisionedAt: now()
});

// Key now exists in exactly ONE place: card's secure element
// Backend cannot retrieve or use this key anymore
```

### 4. Digital Signatures

**Backend Signing (Ticket Creation)**:

```javascript
// 1. Create ticket structure
const ticket = {
  ticketId: generateUUID(),
  type: userSelection.type,
  route: userSelection.route,
  class: userSelection.class,
  validFrom: now(),
  validUntil: now() + validity,
  price: calculatePrice(route, class),
  cardKeyId: user.cardKeyId,  // Reference to card's key (hash)
  publicKeyId: currentKey.id
};

// 2. Serialize deterministically
const message = JSON.stringify(ticket, Object.keys(ticket).sort());

// 3. Hash and sign
const hash = SHA256(message);
const signature = RSA_SIGN(hash, privateKey);

// 4. Attach signature
ticket.signature = base64(signature);

// 5. Write ticket to DESFire card
await desfire.writeFile(ticketFile, ticket);
```

**Validator Verification (Multi-Layer)**:

```javascript
// LAYER 1: Backend signature verification
const { signature, ...ticketData } = ticket;
const message = JSON.stringify(ticketData, Object.keys(ticketData).sort());
const hash = SHA256(message);
const backendValid = RSA_VERIFY(hash, signature, publicKey);

if (!backendValid) {
  return { valid: false, reason: 'Invalid backend signature' };
}

// LAYER 2: DESFire challenge-response
const challenge = crypto.randomBytes(16);  // Random 16-byte challenge
const response = await desfire.authenticate(keySlot: 1, challenge);

// Expected response: AES-CMAC(challenge, cardKey)
// Card computes MAC using hardware-protected key
// Validator verifies MAC matches expected value for this cardKeyId

const expectedMAC = computeExpectedMAC(challenge, ticket.cardKeyId);
if (response !== expectedMAC) {
  return { valid: false, reason: 'Card authentication failed - possible clone' };
}

// Both layers passed: ticket is authentic AND card is genuine
return { valid: true };
```

### 5. Duplicate Detection

**Validator Cache**:

```javascript
// In-memory Set for O(1) lookups
const usedTickets = new Set([
  'ticket-uuid-1',
  'ticket-uuid-2',
  // ...
]);

// Complete validation check
async function validate(card) {
  // Step 1: Read ticket from DESFire card
  const ticket = await desfire.readFile(ticketFile);
  
  // Step 2: Backend signature verification
  if (!verifyBackendSignature(ticket)) {
    return { valid: false, reason: 'Invalid backend signature' };
  }
  
  // Step 3: Expiration check
  if (ticket.validUntil < now()) {
    return { valid: false, reason: 'Ticket expired' };
  }
  
  // Step 4: DESFire challenge-response
  const authResult = await authenticateCard(card, ticket.cardKeyId);
  if (!authResult.success) {
    return { valid: false, reason: 'Card authentication failed - clone detected' };
  }
  
  // Step 5: Duplicate detection
  if (usedTickets.has(ticket.ticketId)) {
    return { valid: false, reason: 'Already used' };
  }
  
  // Accept and cache
  usedTickets.add(ticket.ticketId);
  return { valid: true };
}
```

**Synchronization**:

```javascript
// Validator syncs to backend
async function syncValidations() {
  const pending = getPendingValidations();
  
  await POST('/api/validations/batch', {
    validations: pending.map(v => ({
      ticketId: v.ticketId,
      timestamp: v.timestamp,
      validatorId: VALIDATOR_ID,
      location: VALIDATOR_LOCATION
    }))
  });
  
  // Download global used ticket list
  const globalUsed = await GET('/api/validations/used-tickets');
  usedTickets.clear();
  globalUsed.forEach(id => usedTickets.add(id));
}
```

---

## Token-Based Flow

### Phase 1: Token Purchase

```
User → Kiosk:
  "I want CHF 50 in tokens"

Kiosk → Payment Gateway:
  Process credit card / cash

Kiosk → Backend:
  POST /api/tokens/purchase
  { accountId, amount: 5000, paymentMethod }

Backend:
  - Records: "Account X purchased CHF 50"
  - Does NOT know future travel plans
  - Updates account balance

Backend → User:
  { balance: 5000, transactionId }
```

### Phase 2: Ticket Generation

```
User → Kiosk:
  "I want ticket: Zürich → Bern, 2nd class"

Kiosk → Backend:
  POST /api/tickets/generate
  {
    accountId,
    route: 'ZH → BE',
    class: 2,
    type: 'single'
  }

Backend:
  - Checks: balance >= price
  - Creates ticket structure
  - Signs ticket (RSA-2048)
  - Deducts from token balance
  - Records: "Account X bought ticket for ZH → BE"

Backend → User:
  { ticket, signature, newBalance }
```

### Phase 3: Validation

```
User → Validator:
  Tap card/phone (NFC) → Transmits ticket data

Validator (Offline):
  - Verifies signature (public key)
  - Checks expiration
  - Checks duplicate (local cache)
  - Caches ticketId

Validator → User:
  "Valid" or "Invalid" (immediate)

Validator → Backend (Later):
  POST /api/validations
  { ticketId, timestamp, validatorId, location }

Backend:
  - Records: "Ticket Y validated at location Z"
  - Can correlate: Account X bought ticket Y
  - Builds travel history per account
```

**Privacy Impact**:
- Conductor sees: Ticket valid/invalid (NOT who you are)
- Backend sees: Account travel history (NOT real-time tracking)
- Payment provider sees: CHF 50 purchase (NOT which routes)

---

## Signature Protocol

### Why NOT Blind Signatures?

**Blind signatures** provide perfect anonymity but create fraud risk:

```
With Blind Signatures:
  User: "Sign this blinded ticket"
  Backend: Signs without seeing content
  User: Unblinds → Could claim expensive route, pay for cheap ticket
  Result: Backend cannot verify pricing → fraud ❌
```

**Our Trade-off: Standard RSA**:

```
Standard Signatures:
  User: "Generate ticket for ZH → BE, 2nd class"
  Backend: Sees request, verifies pricing, signs ticket
  User: Gets signed ticket
  Result: Backend knows purchase, prevents pricing fraud ✅
```

**Privacy achieved through**:
- Token layer (payment separation)
- No cardId transmission (conductor anonymity)
- Delayed sync (reduced real-time tracking)

### Signature Implementation

```javascript
// Backend signing (HSM-protected)
function signTicket(ticket) {
  const message = canonicalize(ticket);  // Deterministic JSON
  const hash = crypto.createHash('sha256').update(message).digest();
  const signature = hsm.sign(hash, currentPrivateKey);
  return base64.encode(signature);
}

// Validator verification
function verifyTicket(ticket) {
  const { signature, publicKeyId, ...data } = ticket;
  const message = canonicalize(data);
  const hash = crypto.createHash('sha256').update(message).digest();
  const publicKey = keyStore.get(publicKeyId);
  return crypto.verify('RSA-SHA256', hash, publicKey, base64.decode(signature));
}
```

---

## Validator Operations

### Validation Algorithm

```javascript
class Validator {
  async validateTicket(card) {
    // Step 1: Read ticket from DESFire card
    const ticket = await this.desfire.readFile(card, 'ticket');
    
    // Step 2: Backend signature verification
    const signatureValid = verifyBackendSignature(ticket);
    if (!signatureValid) {
      return {
        valid: false,
        reason: 'INVALID_BACKEND_SIGNATURE',
        canRetry: false
      };
    }
    
    // Step 3: Expiration check
    const now = Date.now();
    if (ticket.validFrom > now) {
      return {
        valid: false,
        reason: 'NOT_YET_VALID',
        canRetry: true
      };
    }
    if (ticket.validUntil < now) {
      return {
        valid: false,
        reason: 'EXPIRED',
        canRetry: false
      };
    }
    
    // Step 4: DESFire challenge-response authentication
    const challenge = crypto.randomBytes(16);
    const response = await this.desfire.authenticate(card, keySlot: 1, challenge);
    
    const authValid = await this.verifyCardAuthentication(
      response, 
      challenge, 
      ticket.cardKeyId
    );
    
    if (!authValid) {
      return {
        valid: false,
        reason: 'CARD_AUTH_FAILED_CLONE_DETECTED',
        canRetry: false,
        fraudAlert: true
      };
    }
    
    // Step 5: Duplicate detection
    if (this.usedTickets.has(ticket.ticketId)) {
      return {
        valid: false,
        reason: 'ALREADY_USED',
        canRetry: false,
        fraudAlert: true
      };
    }
    
    // Step 6: Accept and cache
    this.usedTickets.add(ticket.ticketId);
    this.pendingSync.push({
      ticketId: ticket.ticketId,
      cardKeyId: ticket.cardKeyId,
      timestamp: now,
      validatorId: this.id,
      location: this.location
    });
    
    return {
      valid: true,
      reason: 'OK'
    };
  }
}
```

### Offline Mode

```javascript
class OfflineValidator {
  constructor() {
    this.gracePeriod = 10 * 60 * 1000;  // 10 minutes
    this.lastSync = Date.now();
  }
  
  validate(ticket) {
    const timeSinceSync = Date.now() - this.lastSync;
    
    // Signature check (always works offline)
    if (!verifySignature(ticket)) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    // Duplicate check (may be incomplete)
    if (this.usedTickets.has(ticket.ticketId)) {
      return { valid: false, reason: 'Already used' };
    }
    
    // Grace period logic
    if (timeSinceSync < this.gracePeriod) {
      // Full enforcement
      this.usedTickets.add(ticket.ticketId);
      return { valid: true };
    } else {
      // Warn but accept (can't guarantee no global duplicates)
      this.usedTickets.add(ticket.ticketId);
      return {
        valid: true,
        warning: 'Validator out of sync - duplicate check incomplete'
      };
    }
  }
}
```

### Synchronization Strategy

```javascript
class ValidatorSync {
  async sync() {
    try {
      // Upload pending validations
      await this.uploadValidations();
      
      // Download global used ticket list
      await this.downloadUsedTickets();
      
      // Update public keys
      await this.updateKeys();
      
      this.lastSync = Date.now();
    } catch (error) {
      console.error('Sync failed:', error);
      // Continue operating offline
    }
  }
  
  async uploadValidations() {
    if (this.pendingSync.length === 0) return;
    
    await POST('/api/validations/batch', {
      validations: this.pendingSync
    });
    
    this.pendingSync = [];
  }
  
  async downloadUsedTickets() {
    const response = await GET('/api/validations/used-tickets');
    
    this.usedTickets.clear();
    response.ticketIds.forEach(id => this.usedTickets.add(id));
  }
}
```

---

## Privacy Model

### Data Visibility Matrix

| Actor         | Can See                         | Cannot See                          |
| ------------- | ------------------------------- | ----------------------------------- |
| **User**      | Own tickets, balance            | Other users' data                   |
| **Kiosk**     | Transaction being processed     | User history, other users           |
| **Conductor** | Ticket validity (valid/invalid) | Who owns ticket, other tickets      |
| **Validator** | Ticket data, validity           | Account ID, purchase history        |
| **Backend**   | Account purchases, validations  | Real-time location, payment details |
| **Payment**   | Amount paid, payment method     | Which routes purchased              |

### Privacy Boundaries

**Token Purchase:**
```
✅ Private: Payment provider sees "CHF 50 purchase"
❌ Tracked: Backend sees "Account X bought CHF 50"
```

**Ticket Generation:**
```
✅ Private: Payment method NOT linked to route
❌ Tracked: Backend sees "Account X bought ZH → BE ticket"
```

**Validation:**
```
✅ Private: Conductor sees "Valid ticket" (NOT cardId)
❌ Tracked: Backend sees "Ticket Y validated at location Z"
```

**Correlation:**
```
❌ Backend CAN correlate: Account X → Ticket Y → Validation Z
✅ Backend CANNOT see: Real-time location (delayed sync)
✅ Conductor CANNOT correlate: Multiple validations to same user
```

### Anonymity Limitations

**Not Truly Anonymous:**
- Backend can build per-account travel history
- Validators sync to backend (correlation possible)
- Day passes regenerate but backend knows account owns pass

**Why Not Fully Anonymous:**
- Fraud prevention requires backend to see pricing
- Duplicate detection requires global coordination
- True anonymity needs zero-knowledge proofs (future research)

---

## Storage Schema

### Backend Database (PostgreSQL)

```sql
-- Accounts and token balances
CREATE TABLE accounts (
  account_id UUID PRIMARY KEY,
  balance INTEGER NOT NULL,  -- Cents
  created_at TIMESTAMP DEFAULT NOW()
);

-- Token purchase history
CREATE TABLE token_transactions (
  transaction_id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(account_id),
  amount INTEGER NOT NULL,
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ticket purchases
CREATE TABLE ticket_purchases (
  ticket_id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(account_id),
  route VARCHAR(100),
  class INTEGER,
  type VARCHAR(20),
  price INTEGER,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  signature TEXT,
  public_key_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Validations (synced from validators)
CREATE TABLE validations (
  validation_id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES ticket_purchases(ticket_id),
  validated_at TIMESTAMP,
  validator_id VARCHAR(50),
  location VARCHAR(100),
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Cryptographic keys
CREATE TABLE signing_keys (
  key_id VARCHAR(50) PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key_ref VARCHAR(100),  -- HSM reference
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_validations_ticket ON validations(ticket_id);
CREATE INDEX idx_purchases_account ON ticket_purchases(account_id);
CREATE INDEX idx_validations_timestamp ON validations(validated_at);
```

### User Device (IndexedDB)

```javascript
// Dexie.js schema
const db = new Dexie('SBB_Ticketing');

db.version(1).stores({
  tokens: 'accountId, balance',
  tickets: 'ticketId, accountId, validFrom, validUntil',
  qrCodes: 'ticketId, lastRotation'
});
```

### Validator (In-Memory + Disk Cache)

```javascript
// In-memory for performance
{
  publicKeys: Map<string, PublicKey>,
  usedTickets: Set<string>,
  pendingSync: Array<Validation>,
  lastSync: number
}

// Disk cache for persistence
localStorage: {
  'validator_used_tickets': string[],
  'validator_pending_sync': Validation[],
  'validator_last_sync': number
}
```

---

## Security Considerations

### Threat Model

**In Scope:**
1. Ticket forgery (invalid signatures)
2. Ticket duplication (use same ticket multiple times)
3. Price manipulation (modify route/class after signing)
4. Replay attacks (reuse validated tickets)
5. Cloning (copy ticket to multiple devices)

**Out of Scope (for this design):**
1. Device theft (physical security)
2. Backend compromise (HSM protects keys)
3. Zero-day exploits in crypto libraries
4. Social engineering

### Attack Scenarios & Mitigations

**Attack 1: Forge Ticket**
```
Threat: Attacker creates fake ticket without backend signature
Mitigation: Validator verifies RSA signature with public key
Result: Forgery detected, ticket rejected ✅
```

**Attack 2: Duplicate Ticket**
```
Threat: Use same ticket on multiple validators
Mitigation: Global duplicate detection via ticketId cache
Result: First use accepted, subsequent uses rejected ✅
```

**Attack 3: Modify Ticket**
```
Threat: Change route from "ZH → BE" to "ZH → GE" after signing
Mitigation: Signature covers all fields, any change invalidates signature
Result: Modified ticket rejected ✅
```

**Attack 4: Clone Basic Card**
```
Threat: Copy ticket data to another card
Mitigation (Current): Duplicate detection (reactive)
Mitigation (Future): DESFire challenge-response (proactive) ✅
```

**Attack 5: Replay Old Validation**
```
Threat: Intercept and replay old NFC transaction
Mitigation: Each validation creates new cache entry
Result: Duplicate detection triggers ✅
```

### Cryptographic Security

**Signature Strength:**
- RSA-2048: ~112 bits security (sufficient until 2030)
- SHA-256: 128 bits security (collision-resistant)
- Expiration timestamps: Signed by backend, cannot be modified

**Key Protection:**
- Private keys: HSM-protected (AWS CloudHSM / Azure Key Vault)
- Public keys: Distributed to validators via HTTPS
- Backend can rotate keys for security without affecting old tickets

### Privacy Risks

**Risk 1: Backend Travel Profiling**
```
Risk: Backend correlates account → purchases → validations
Impact: Complete travel history per account
Mitigation: Token layer reduces payment linkage, but not eliminated
```

**Risk 2: Validator Correlation**
```
Risk: Validators cache cardId (if transmitted)
Impact: Cross-validation tracking
Mitigation: No cardId transmitted, tickets regenerate (day passes) ✅
```

**Risk 3: Offline Window**
```
Risk: Duplicate detection incomplete during offline period
Impact: Temporary cloning vulnerability
Mitigation: Grace period + eventual consistency ⚠️
```

---

## Production Deployment Considerations

### HSM Integration

```javascript
// AWS CloudHSM example
const hsm = new CloudHSM({
  clusterId: 'cluster-abc123',
  partition: 'sbb-signing'
});

async function signTicket(ticket) {
  const message = canonicalize(ticket);
  const hash = crypto.createHash('sha256').update(message).digest();
  
  // Sign with HSM-protected key
  const signature = await hsm.sign({
    keyHandle: currentKeyHandle,
    mechanism: 'RSA_PKCS',
    data: hash
  });
  
  return signature;
}
```

### Scalability

**Backend:**
- Horizontal scaling: Load-balanced API servers
- Database: Read replicas for validation queries
- Caching: Redis for public keys and used tickets

**Validators:**
- O(1) duplicate checks (Set data structure)
- Batch sync (reduce network overhead)
- Local cache persistence (survive restarts)

### Monitoring

```javascript
// Key metrics
metrics = {
  'tickets.generated': counter,
  'tickets.validated': counter,
  'tickets.rejected.signature': counter,
  'tickets.rejected.duplicate': counter,
  'validators.sync.latency': histogram,
  'validators.offline.duration': gauge
};
```

---

## Conclusion

This architecture balances **privacy**, **fraud prevention**, and **practicality**:

✅ **Clone-Proof**: DESFire EV3 smart cards with hardware-protected keys  
✅ **Privacy**: Token layer separates payment from travel  
✅ **Security**: Multi-layer verification (backend signature + challenge-response)  
✅ **Scalability**: Offline validators with eventual consistency  
✅ **Usability**: Automatic expiration via signed timestamps  

⚠️ **Trade-offs**: 
- Not fully anonymous (backend tracks per-account history)
- Requires DESFire card readers at all validators
- Higher card cost (~$2-5 vs $0.20 for basic NFC)

🔮 **Future**: HID Mobile/SEOS for smartphone credentials, zero-knowledge proofs for true anonymity
