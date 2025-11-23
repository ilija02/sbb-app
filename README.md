# SBB Privacy-Enhanced Ticketing System

Privacy-preserving public transport ticketing system using token-based payment separation and offline validation.

## 🎯 Core Concept

**Token-Based Ticketing** with cryptographic fraud prevention and privacy enhancements.

**Problem**: Traditional ticketing systems create complete travel surveillance by linking payments directly to specific journeys.

**Solution**: Two-layer system that separates payment from travel:

1. **Buy Credits** → Pay with cash/card → Get anonymous credits on card
2. **Buy Ticket** → Use credits → Get cryptographically signed ticket  
3. **Validate** → Tap at platform → Offline signature verification → Board train
4. **Random Checks** → Conductor verifies → Or issues CHF 100+ fine

## ⚠️ Privacy Reality Check

**This is NOT full anonymity. Backend can track per-account travel history.**

### What IS Private:
- ✅ Payment method (credit card/cash) not linked to specific trips
- ✅ Conductors cannot track individuals across validations  
- ✅ Real-time location tracking reduced (delayed validator sync)
- ✅ Day passes hide validation frequency from conductors

### What is NOT Private:
- ❌ Backend knows: Account X bought ticket for route Y at time Z
- ❌ Backend knows: Ticket Y validated at location W  
- ❌ Backend can build complete per-account travel history

### Why Not Blind Signatures?
Backend must verify pricing to prevent fraud (user claiming cheap ticket, getting expensive route signed). True anonymity requires zero-knowledge proofs or accepting fraud risk.

**Trade-off**: We prioritize fraud prevention over perfect anonymity, achieving privacy through payment separation and conductor anonymity instead.

### 🔐 Clone-Proof DESFire Cards

**This system uses DESFire EV3 smart cards** with hardware-backed challenge-response authentication.

**How DESFire Prevents Cloning:**

| Feature                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| **Secure Microcontroller** | Onboard CPU with crypto coprocessor (AES/DES)   |
| **Hardware Key Storage**   | Private keys stored in tamper-resistant memory  |
| **Challenge-Response**     | Card proves it has the key without revealing it |
| **No Key Extraction**      | Keys cannot be read or copied from hardware     |
| **Tamper Detection**       | Physical attacks trigger automatic key erasure  |

**Why Cloning Fails:**
1. **Keys cannot be extracted**: No command exists to read keys from hardware
2. **Replay attacks blocked**: Random challenges make old responses invalid  
3. **Blank card cloning fails**: Each card has unique keys provisioned during setup
4. **Physical attacks detected**: Tamper circuits erase keys before extraction

**Real-World Examples:**
- London Oyster Card (Mifare DESFire)
- Netherlands OV-Chipkaart (Calypso)
- Washington DC Metro SmarTrip (DESFire)

**Alternative Options:**
- **HID Mobile/SEOS**: Smartphone credentials using Secure Element (iOS/Android)
- **Basic NFC cards**: Demo/development only (vulnerable to cloning)

---

## 🏗️ Architecture Overview

### High-Level Flow

```
1. User → Kiosk: Buy virtual tokens (generic credits)  
2. User → Kiosk: Generate ticket from tokens
3. Backend: Creates ticket, verifies pricing, signs ALL fields, writes to DESFire card
4. User stores: Ticket + signature on DESFire card with hardware-protected key
5. User → Validator: Tap card at platform entrance
6. Validator: Challenge-response authentication + signature verification + duplicate check
7. Backend: Logs validation (when validator syncs) to prevent reuse
```

### Key Innovation: Token-Based Privacy

```
Token Purchase (Generic):
  User pays → Backend records "Account X bought CHF 100 tokens"
  Backend does NOT know which routes will be used

Ticket Generation (Specific):  
  User selects route → Backend creates ticket structure
  Backend MUST see route to verify pricing (prevent fraud)
  Backend records "Account X bought ticket for Route Y"
  Backend signs entire ticket (route, class, validity, ticketId)
  
Validation (Semi-Anonymous):
  User → Validator: {ticket, signature}
  Validator: Checks signature, no cardId needed
  Backend learns: Ticket Y used at location Z (NOT who validated)
```

---

## 🔑 Key Components

### 1. Virtual Tokens

**Generic Credits** (not tied to specific routes):
```javascript
{
  accountId: 'user-123',
  balance: 5000,  // CHF 50.00 (stored in cents)
  transactions: [
    { type: 'purchase', amount: 5000, timestamp, paymentMethod: 'credit_card' }
  ]
}
```

### 2. Tickets

**Cryptographically Signed Tickets**:
```javascript
{
  ticketId: 'abc123',     // Unique identifier
  type: 'single',         // single, day_pass, multi_day
  route: 'ZH → BE',       // Origin → Destination
  class: 2,               // 1st or 2nd class
  validFrom: timestamp,
  validUntil: timestamp,
  price: 2500,            // CHF 25.00
  signature: 'RSA-2048'   // Backend HSM signature
}
```

**No blind signatures**: Backend sees and signs all fields to verify pricing.

### 3. Offline Validators

**Two-Level Verification**:

**Level 1: Cryptographic** (Always Works)
```javascript
verify(ticket.signature, ticket, publicKey) → true/false
```

**Level 2: Duplicate Detection** (Requires Sync)
```javascript
if (ticketId in usedTickets) {
  reject("Already validated")
}
```

**Grace Period**: 10-minute offline window before strict enforcement.

### 4. Duplicate Detection

**How It Works**:
1. First validation → Accepted, ticketId cached locally
2. Second validation → Rejected (duplicate detected)
3. Validator syncs → Backend records invalidation
4. Future validators download → Block duplicate everywhere

**Trade-off**: Offline validators have temporary blindspot until sync.

---

## 💾 Data Storage Model

### Backend (PostgreSQL)

**Token Balances:**
```sql
CREATE TABLE accounts (
  accountId UUID PRIMARY KEY,
  balance INTEGER NOT NULL,  -- Cents
  created_at TIMESTAMP
);
```

**Ticket Purchases:**
```sql
CREATE TABLE ticketPurchases (
  ticketId UUID PRIMARY KEY,
  accountId UUID,  -- Who bought it
  route TEXT,
  class INTEGER,
  price INTEGER,
  validFrom TIMESTAMP,
  validUntil TIMESTAMP,
  signature TEXT,
  created_at TIMESTAMP
);
```

**Validations (After Sync):**
```sql
CREATE TABLE invalidatedTickets (
  ticketId UUID PRIMARY KEY,
  validatedAt TIMESTAMP,
  validatorId TEXT,
  location TEXT
);
```

### User Device (IndexedDB)

```javascript
db.tokens: { accountId, balance }
db.tickets: { ticketId, route, class, signature, validFrom, validUntil }
db.qrCodes: { ticketId, qrDataUrl, rotationInterval }
```

### Validator (Local Cache)

```javascript
validator.publicKeys: { keyId, publicKey, validFrom, validUntil }
validator.usedTickets: Set(ticketId)  // Duplicate detection
validator.pendingSync: Queue({ ticketId, timestamp, location })
```

---

## 🔒 Security Features

### Privacy Guarantees

**What Backend CANNOT Track:**
- ❌ Real-time location (validators sync later)
- ❌ Payment method linked to specific trips (tokens layer)
- ❌ Which cardId owns validated tickets (not transmitted)

**What Backend CAN Track:**
- ✅ Account X bought ticket for route Y at time Z
- ✅ Ticket Y validated at location W
- ✅ Complete per-account travel history

**What Conductors CANNOT Track:**
- ❌ Card identifier (no cardId transmitted)
- ❌ User's other tickets or token balance
- ❌ Multiple validations correlated to same user

### Fraud Prevention

**1. Duplicate Detection:**
```
Validator checks: Has this ticketId been seen before?
First use: Accept
Second use: Reject + Flag as fraud
```

**2. Signature Verification:**
```
Backend signs ticket → Validator verifies with public key
Invalid signature → Reject
Modified ticket → Signature mismatch → Reject
```

**3. Expiration Check:**
```
Validator checks validUntil field (signed by backend)
Expired tickets rejected automatically
No manual revocation needed
```

**4. DESFire Challenge-Response:**
```
Validator → Card: Random challenge (16 bytes)
Card → Validator: Signed response (using hardware-protected key)
Validator: Verifies signature matches expected response
Clone fails: Attacker cannot reproduce signature without private key
```

**Benefits:**
- ✅ Proactive clone prevention (not reactive detection)
- ✅ No offline vulnerability window
- ✅ Original holder never loses access
- ✅ Physical attacks trigger key erasure

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ / npm 9+
- Modern browser (Chrome/Firefox/Safari)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/sbb-ticketing.git
cd sbb-ticketing

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Demo Access

Open http://localhost:5173 and switch between tabs:
- **Kiosk**: Buy tokens and tickets
- **User Device**: Store and display tickets
- **Validator**: Scan and verify tickets
- **Backend**: View system state (demo only)

---

## 🎮 Demo Usage

### 1. Purchase Tokens (Kiosk)

```
1. Go to "Kiosk" tab
2. Enter amount (e.g., CHF 50)
3. Select payment method
4. Click "Buy Tokens"
```

### 2. Generate Ticket (Kiosk)

```
1. Select route (e.g., "Zürich HB → Bern")
2. Select class (1st or 2nd)
3. Select type (Single or Day Pass)
4. Click "Generate Ticket"
```

### 3. Store on Device (User Device)

```
1. Go to "User Device" tab
2. Ticket appears automatically (demo sync)
3. Rotating QR code displays
```

### 4. Validate (Validator)

```
1. Go to "Validator" tab
2. Click "Scan QR Code"
3. Camera opens → Point at User Device tab
4. Validator checks signature + duplicates
5. Result: "Valid" or "Already Used"
```

---

## 🧪 Testing Scenarios

### Scenario 1: Successful Validation
```
1. Buy tokens → Generate ticket → Validate
2. Expected: "Valid Ticket" ✅
```

### Scenario 2: Duplicate Detection
```
1. Validate ticket once ✅
2. Try to validate same ticket again
3. Expected: "Ticket Already Used" ❌
```

### Scenario 3: Expired Ticket
```
1. Generate ticket
2. Advance time > validity period
3. Expected: "Ticket Expired" ❌
```

### Scenario 4: Day Pass Regeneration
```
1. Generate day pass
2. Validate → QR code changes
3. Old QR code no longer works
4. New QR code validates ✅
```

### Scenario 5: Insufficient Balance
```
1. Set balance < ticket price
2. Try to generate ticket
3. Expected: "Insufficient Balance" ❌
```

---

## 📊 Performance Considerations

### Validator Optimization

**O(1) Lookups**:
```javascript
// Duplicate check
if (usedTickets.has(ticketId)) { /* O(1) Set lookup */ }

// Expiration check
if (ticket.validUntil < now) { /* O(1) timestamp comparison */ }
```

**Offline Sync Queue**:
```javascript
// Batch validations
pendingSync.push({ ticketId, timestamp })
if (online) { syncBatch(pendingSync) }
```

### Storage Limits

- **User Device**: 500 MB IndexedDB (thousands of tickets)
- **Validator Cache**: 50 MB (keys + used tickets)
- **Backend**: Unlimited (PostgreSQL)

### Network Requirements

- **Kiosk**: Always online (ticket generation)
- **User Device**: Offline-capable (stored tickets)
- **Validator**: Intermittent (hourly sync recommended)

---

## 🔮 Future Enhancements

### Production Features

1. **Backend HSM Integration**
   - AWS CloudHSM or Azure Key Vault
   - Hardware-backed signing
   - Audit logging

2. **HID Mobile/SEOS Credentials**
   - Smartphone Secure Element integration (alternative to DESFire cards)
   - Android Keystore / iOS Secure Enclave
   - Wallet integration (Apple Pay/Google Pay)

3. **Account System**
   - User registration/authentication
   - Purchase history
   - Refund processing

4. **Multi-Region Support**
   - Different validation rules per country
   - Currency conversion
   - Localized pricing

### Research Directions

1. **Zero-Knowledge Proofs**
   - Truly anonymous ticketing
   - Fraud prevention without revealing identity
   - Research: zk-SNARKs for ticket pricing proofs

2. **Decentralized Validation**
   - Blockchain-based key distribution
   - Validator trust networks
   - Research: Practical Byzantine Fault Tolerance

---

## 📁 Project Structure

```
sbb-ticketing/
├── frontend/               # React demo app
│   ├── src/
│   │   ├── components/     # Kiosk, UserDevice, Validator tabs
│   │   ├── lib/
│   │   │   ├── crypto.js   # RSA signing/verification
│   │   │   ├── storage.js  # IndexedDB operations
│   │   │   └── seedData.js # Demo data
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/                # Future backend implementation
│   └── README.md           # Backend architecture spec
├── ARCHITECTURE.md         # Detailed technical spec
└── README.md               # This file
```

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Complete technical specification
- **[backend/README.md](./backend/README.md)**: Backend implementation guide
- **Demo**: Interactive browser-based demonstration

---

## ⚠️ Implementation Status

### ✅ Core Architecture

- **DESFire EV3 smart cards**: Challenge-response authentication with hardware-protected keys
- **Virtual token system**: Payment separation via generic credits
- **Ticket generation**: RSA signatures with signed expiration timestamps
- **Offline validators**: Local signature verification and duplicate detection
- **Token-based privacy**: Backend cannot link payments to specific journeys

### 🚧 Implementation Status

**Demo (Browser-based):**
- ✅ Token purchasing and ticket generation
- ✅ RSA signature verification
- ✅ Duplicate detection (in-memory cache)
- ✅ Multi-tab synchronization
- ⚠️ Basic NFC simulation (no real DESFire)

**Production (Planned):**
- Backend API with HSM integration
- Real DESFire card readers/writers
- PostgreSQL database
- HID Mobile/SEOS smartphone credentials
- Multi-region support

### 🔬 Research

- Zero-knowledge proof integration
- Decentralized validator networks
- Formal verification of privacy properties

---

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Your Name** - Initial work - [GitHub Profile](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Swiss Federal Railways (SBB) for domain inspiration
- NXP for DESFire documentation
- HID Global for mobile credential references
- Privacy research community

---

## 📞 Contact

- **Project Repository**: [github.com/yourusername/sbb-ticketing](https://github.com/yourusername/sbb-ticketing)
- **Issues**: [github.com/yourusername/sbb-ticketing/issues](https://github.com/yourusername/sbb-ticketing/issues)
- **Email**: your.email@example.com
