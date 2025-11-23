# SBB Digital Ticketing System

**Fully digital, privacy-preserving ticketing for public transport.**

Replace paper tickets with clone-proof digital tickets on smartphones or refillable DESFire cards.

## 🎯 Core Concept

**Problem**: Paper tickets are costly, forgeable, and require expensive infrastructure.

**Solution**: Digital tickets on two platforms:

### 📱 Smartphone App (Free)
- Buy tickets online instantly
- Store in phone's Secure Element (iOS/Android)
- Validate with NFC tap or QR code
- Transfer tickets to friends/family

### 💳 DESFire Card (€5 refillable)
- For users without smartphones
- Hardware-secured, clone-proof
- Load credits at kiosk or via Android app NFC
- Transferable between users

### ✅ Conductor Validation (Low Cost)
- **All conductor needs: Smartphone + Our App**
- No expensive platform barriers required
- Offline validation (< 1 second)
- Works anywhere on the train

## ⚠️ Privacy Reality Check

**This is NOT full anonymity. Backend can track per-account travel history.**

### What Conductor Sees:
- ✅ Route (Zürich → Bern)
- ✅ Class (1st or 2nd)
- ✅ Validity period
- ✅ Ticket status (Valid/Invalid)

### What Conductor CANNOT See:
- ❌ Passenger name or ID
- ❌ Payment method used
- ❌ Account balance
- ❌ Purchase history
- ❌ Other tickets owned

### Backend Privacy:
Backend knows account travel history (for fraud prevention), but conductors remain anonymous to passengers.

**Trade-off**: We prioritize conductor anonymity and fraud prevention over full backend anonymity.

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

## 🏗️ How It Works

### Buying Tickets

**Option 1: Smartphone App**
```
1. Download app (iOS/Android) → Create account
2. Select route + class → Pay online
3. Ticket stored in Secure Element
4. Validate: Tap phone (NFC) or show QR to conductor
```

**Option 2: DESFire Card**
```
1. Buy €5 card at kiosk or online
2. Load credits at kiosk OR via Android app (phone-to-card NFC)
3. Generate ticket at kiosk or in app
4. Validate: Tap card to conductor's phone
```

**Option 3: Hybrid (Low-Cost Deployment)**
```
1. Buy ticket in Android app
2. Tap phone to DESFire card → Transfer credits via NFC
3. Use card for validation
```

### Validating Tickets

**Conductor uses: Smartphone + Our App**

```
1. Passenger presents card/phone
2. Conductor taps with smartphone (< 1 second)
3. App checks:
   ✓ Backend signature (proves authenticity)
   ✓ Challenge-response (proves genuine card, not clone)
   ✓ Duplicate detection (prevents simultaneous use)
   ✓ Expiration
4. Result: GREEN (valid) or RED (invalid) with reason
```

### Ticket Transferability

**How transfers work:**
- User A buys ticket → Transfers to User B (via app or card tap)
- User B validates ticket → Binds to their device
- User A can no longer use it (duplicate detection prevents sharing)

**Use cases:**
- Parent buys ticket for child
- Friend transfers unused ticket
- Corporate bulk tickets for employees

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

## 🔒 Security & Fraud Prevention

### Multi-Layer Security

**Layer 1: Hardware Security (DESFire/Secure Element)**
- Private keys stored in tamper-resistant hardware
- Challenge-response authentication
- Keys cannot be extracted or cloned
- Physical attacks trigger automatic erasure

**Layer 2: Cryptographic Signatures**
- Backend signs all tickets (RSA-2048)
- Forgery impossible without backend's private key
- Any modification invalidates signature

**Layer 3: Duplicate Detection**
- First validation: ✅ Accepted, cached locally
- Second validation: ❌ Rejected (same ticketId)
- Backend sync prevents global duplicates

**Layer 4: Expiration Timestamps**
- Signed by backend, cannot be modified
- Automatic rejection of expired tickets
- No manual revocation needed

### Fraud Scenarios Prevented

| Attack                 | How We Prevent It                            |
| ---------------------- | -------------------------------------------- |
| **Clone card**         | Challenge-response fails (no private key)    |
| **Screenshot ticket**  | QR codes rotate every 30s with timestamp     |
| **Forge ticket**       | Signature verification fails                 |
| **Share ticket**       | Duplicate detection rejects second use       |
| **Modify route**       | Signature mismatch (ticket tampered)         |
| **Replay old session** | Random challenges make old responses invalid |

### Why Conductors Don't Need Personal Info

**Traditional approach:**
- Check ID → Match to ticket → Verify validity

**Our approach:**
- Cryptographic proof of ticket authenticity
- Hardware proof card/phone is genuine
- No personal information needed for security

---

## 🚀 Deployment Options

### Phase 1: Android-Only (€50K)

**What's needed:**
- Android smartphone app (free download for users)
- DESFire card provisioning station
- Conductor smartphones with validation app
- Backend server (AWS/Azure)

**How it works:**
1. Users download Android app or buy pre-provisioned DESFire card (€5)
2. Android users can load credits onto their own cards via phone NFC
3. Conductors validate using smartphones (no platform barriers needed)

**Cost breakdown:**
- Software development: €30K
- DESFire cards (1,000 units @ €5): €5K
- Backend infrastructure (1st year): €10K
- Training materials: €5K

### Phase 2: iOS + Kiosks (€200K)

**Additional components:**
- iOS smartphone app
- Self-service kiosks at major stations
- Expanded card inventory

**Advantages:**
- iPhone users can buy tickets in-app
- Non-smartphone users can use kiosks
- Wider accessibility

### Phase 3: Platform Validators (€500K, Optional)

**Additional infrastructure:**
- Platform-based NFC readers at station entrances
- Real-time validation monitoring
- Automated fare enforcement

**Note:** Only recommended for high-traffic stations. Phase 1-2 conductor validation sufficient for most routes.

---

## 🛠️ Developer Setup (Browser Demo)

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
- **Kiosk**: Simulates ticket kiosk/app purchase flow
- **User Device**: Shows how tickets display on user's device
- **Validator**: Demonstrates conductor validation process
- **Backend**: System state visualization (demo only)

**Note:** This is a browser-based proof-of-concept. Real deployment uses native mobile apps with Secure Element, actual DESFire cards, and backend API.

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

### Near-Term (Phase 2-3)

1. **Backend HSM Integration**
   - AWS CloudHSM or Azure Key Vault for secure key storage
   - Hardware-backed ticket signing
   - Comprehensive audit logging for compliance

2. **Account System** (Optional)
   - User registration for in-app purchases
   - Purchase history and receipt management
   - Refund processing for cancelled journeys
   - **Note:** Not required for anonymous card-based ticketing

3. **Multi-Region Support**
   - Different validation rules per transit authority
   - Currency conversion and localized pricing
   - Cross-border interoperability (EU transit systems)

4. **Platform Validators** (High-traffic stations only)
   - Automated entrance/exit gates
   - Real-time monitoring dashboards
   - Fare enforcement integration

### Long-Term Research

1. **HID Mobile/SEOS Alternative**
   - Replace DESFire cards with smartphone Secure Element
   - Android Keystore / iOS Secure Enclave integration
   - Wallet integration (Apple Pay/Google Pay)
   - **Note:** Higher development cost than DESFire (Phase 4+)

2. **Zero-Knowledge Proofs** (Academic partnership)
   - Truly anonymous ticketing with cryptographic guarantees
   - Fraud prevention without revealing any user data
   - Research: zk-SNARKs for fare pricing proofs

3. **Decentralized Validation** (Experimental)
   - Blockchain-based key distribution
   - Validator trust networks without central authority
   - Research: Practical Byzantine Fault Tolerance

---

## � Cost Comparison

### Traditional Platform Barriers vs Conductor Validation

| Component             | Traditional System                  | Our Solution                   |
| --------------------- | ----------------------------------- | ------------------------------ |
| **Platform hardware** | €3,000-5,000 per gate × 100 gates   | None needed                    |
| **Installation**      | €200,000+ (construction, cabling)   | None needed                    |
| **Maintenance**       | €50,000/year (repairs, calibration) | None needed                    |
| **Validator devices** | Fixed platform readers              | Conductor smartphones (€300)   |
| **User devices**      | Must buy cards (€5-20)              | Free app or €5 card (optional) |
| **Total (1st year)**  | **€500,000+**                       | **€50,000** (Phase 1)          |
| **Annual savings**    | -                                   | **€450,000+**                  |

### Infrastructure Requirements

| Deployment Phase | Cost   | What You Get                                              |
| ---------------- | ------ | --------------------------------------------------------- |
| **Phase 1**      | €50K   | Android app + DESFire cards + conductor validation        |
| **Phase 2**      | €200K  | + iOS app + self-service kiosks at major stations         |
| **Phase 3**      | €500K  | + Platform validators (only if needed for high traffic)   |
| **Traditional**  | €500K+ | Platform barriers required upfront (no phased deployment) |

**Key advantage:** Start small with Phase 1, validate market fit, expand based on actual demand.

---

## �📁 Project Structure

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
├── PITCH.md                # Investor pitch document
└── README.md               # This file
```

---

## 📚 Documentation

- **[PITCH.md](./PITCH.md)**: Investor pitch and business case
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Complete technical specification with diagrams
- **[backend/README.md](./backend/README.md)**: Backend implementation guide
- **Demo**: Interactive browser-based demonstration in `frontend/`

---

## ⚠️ Implementation Status

### ✅ Proven Technology

- **DESFire EV3 cards**: Widely deployed (London Oyster, Netherlands OV-Chipkaart, Hong Kong Octopus)
- **Challenge-response authentication**: Industry-standard AES-128, hardware-protected keys
- **RSA signatures**: Used by banking systems worldwide for transaction verification
- **Offline validation**: Proven in metro systems with intermittent connectivity

### 🚧 Current Status

**Demo (This Repository):**
- ✅ Browser-based proof-of-concept demonstrating core flows
- ✅ Token purchasing and ticket generation logic
- ✅ RSA signature creation and verification
- ✅ Duplicate detection algorithm
- ⚠️ Simulated NFC (no real hardware integration)

**Production Readiness:**
- 📋 **Phase 1 (€50K)**: Ready to implement - Android app + DESFire cards + conductor validation
- 📋 **Phase 2 (€200K)**: iOS app development + kiosk deployment
- 📋 **Phase 3 (€500K)**: Optional platform validators for high-traffic stations

### 🔬 Future Research

- **Zero-knowledge proofs**: Exploring zk-SNARKs for enhanced privacy (academic research phase)
- **Decentralized validation**: Blockchain-based key distribution (experimental)
- **Formal verification**: Mathematical proof of privacy properties (partnership with university)

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
