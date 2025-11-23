# SBB Digital Ticketing System - Pitch

## The Problem

Paper tickets are:
- Costly to print and distribute
- Easy to forge or photocopy
- Require physical infrastructure (ticket machines at every station)
- Generate waste
- Cannot be easily transferred between users

## Our Solution

**Fully digital tickets on two platforms:**

1. **Smartphone App** (iOS/Android) - Free, instant setup
2. **Refillable DESFire Card** (€5 deposit) - No smartphone needed

## Key Benefits

### For Passengers
- ✅ **Privacy-Preserving**: Conductors cannot see personal information, only ticket validity
- ✅ **Transferable**: Send tickets to friends/family
- ✅ **Fraud-Proof**: Cannot use same ticket simultaneously (duplicate detection)
- ✅ **Convenient**: No queuing at ticket machines
- ✅ **Flexible**: Buy online (app) or at kiosks (card)

### For Railway
- ✅ **Cost Savings**: No printing, reduced kiosk maintenance
- ✅ **Conductor-Only Validation**: No expensive platform barriers needed
- ✅ **Clone-Proof**: DESFire hardware security prevents counterfeiting
- ✅ **Offline Capable**: Validators work without internet

### For Environment
- ✅ **Zero Paper Waste**: Fully digital
- ✅ **Reduced Hardware**: Fewer ticket machines needed

## How It Works

### Buying Tickets

**Option 1: Smartphone App**
1. User downloads free app (iOS/Android)
2. Creates account and adds payment method
3. Buys ticket online → Stored in phone's Secure Element
4. Tap phone to validate (NFC) or show QR code to conductor

**Option 2: Physical DESFire Card**
1. User buys €5 refillable card at kiosk or online
2. Loads credits at kiosk or via Android app (NFC phone-to-card transfer)
3. Generates ticket at kiosk or via app
4. Tap card to validate

**Option 3: Hybrid (Low-Cost Initial Deployment)**
1. Buy ticket on Android app
2. Tap phone to card to transfer credits/ticket (peer-to-peer NFC)
3. Use card for validation

### Validating Tickets

**All conductor needs: Smartphone + Our App**

1. Passenger presents card/phone
2. Conductor taps with their smartphone
3. App performs:
   - Signature verification (proves ticket authenticity)
   - Challenge-response (proves card/phone is genuine, not cloned)
   - Duplicate detection (prevents simultaneous use)
   - Expiration check
4. Result: **VALID** (green) or **INVALID** (red) with reason

**Validation Time: < 1 second**

### Privacy Protection

Conductor sees ONLY:
- ✅ Route (Zürich → Bern)
- ✅ Class (1st/2nd)
- ✅ Validity period
- ✅ Ticket status (Valid/Invalid)

Conductor CANNOT see:
- ❌ Passenger name
- ❌ Payment method
- ❌ Account balance
- ❌ Purchase history
- ❌ Other tickets owned

### Fraud Prevention

**How we prevent ticket sharing/cloning:**

1. **DESFire Card Security**
   - Hardware chip with secret key (cannot be copied)
   - Challenge-response authentication
   - Physical attacks trigger key erasure

2. **Smartphone Security**
   - Secure Element (iOS Keychain / Android Keystore)
   - Biometric protection
   - Hardware-backed cryptography

3. **Duplicate Detection**
   - First validation: ✅ Accepted
   - Second validation (same ticket): ❌ Rejected
   - Backend sync prevents global duplicates

4. **Digital Signatures**
   - Backend signs all tickets (RSA-2048)
   - Forgery impossible without backend's private key

### Ticket Transferability

**How transfers work:**
- User A gives/sells ticket to User B
- User B receives ticket on their phone/card
- Once User B validates, ticket binds to their device
- User A can no longer use it (duplicate detection)

**Use cases:**
- Parent buys ticket for child
- Friend cannot travel, transfers to another friend
- Corporate bulk tickets distributed to employees

## Deployment Phases

### Phase 1: Android-Only (Low Cost)
- Android app with NFC card loading capability
- Users buy tickets in app, transfer to DESFire cards via phone NFC
- Conductors validate with Android smartphones
- **No kiosks needed** - purely app-based

**Cost**: ~€50K (app development only)

### Phase 2: iOS + Kiosks
- iOS app with Wallet integration
- Deploy kiosks at major stations for card purchases
- Full omnichannel experience

**Cost**: ~€200K (iOS app + 50 kiosks @ €3K each)

### Phase 3: Platform Validators (Optional)
- Install validators at platform entrances
- Faster throughput at busy stations
- Conductor checks remain as backup

**Cost**: ~€500K (100 validators @ €5K each)

## Technology Stack

**Hardware:**
- DESFire EV3 cards: €2-5 per card (bulk pricing)
- Smartphones: Passenger-owned or conductor-owned
- Kiosks: Standard PC + NFC reader (€3K each)

**Software:**
- Mobile apps: React Native (iOS + Android)
- Backend: Node.js + PostgreSQL + Redis
- HSM: AWS CloudHSM (pay-as-you-go)

**Security:**
- AES-128 (DESFire challenge-response)
- RSA-2048 (backend signatures)
- TLS 1.3 (transport security)

## Competitive Advantages

| Feature                 | Our Solution         | Paper Tickets       | Other Digital     |
| ----------------------- | -------------------- | ------------------- | ----------------- |
| **Clone Prevention**    | Hardware-backed      | None (easy to copy) | Software-only     |
| **Privacy**             | Conductor-anonymous  | Anonymous           | Account-linked    |
| **Transferability**     | Yes                  | Yes                 | Usually no        |
| **Works Without Phone** | Yes (DESFire card)   | Yes                 | No                |
| **Offline Validation**  | Yes                  | Visual only         | Usually no        |
| **Infrastructure Cost** | Low (conductor-only) | High (printers)     | Very high (gates) |

## Market Validation

**Real-world deployments of DESFire ticketing:**
- London Oyster Card: 85 million cards, 5 billion journeys/year
- Netherlands OV-Chipkaart: 35 million cards nationwide
- Washington DC Metro: 100% DESFire since 2010

## Revenue Model

1. **Card Sales**: €5 per DESFire card (€2 cost, €3 margin)
2. **Transaction Fees**: 1% on ticket sales (covers processing)
3. **B2B Licensing**: Sell system to other transport operators

**Break-even**: ~500K cards sold or 2 years of operation

## Ask

**Seeking**: €250K seed funding

**Use of funds:**
- €150K: Full app development (iOS + Android)
- €50K: Backend infrastructure (1 year)
- €50K: 50,000 DESFire cards (initial inventory)

**Deliverables in 6 months:**
- Working app (both platforms)
- Backend with HSM integration
- Pilot with 1,000 users

## Why Now?

- ✅ COVID-19 accelerated contactless payment adoption
- ✅ Smartphones are ubiquitous (85% penetration)
- ✅ NFC hardware is standard in all modern phones
- ✅ DESFire technology is mature and proven
- ✅ Environmental concerns drive paperless initiatives

## Team (To Be Filled)

- **CEO**: Transport industry veteran
- **CTO**: Security expert (10+ years cryptography)
- **Lead Developer**: Mobile + backend experience

---

## Contact

- **Website**: [sbb-tickets.com](https://sbb-tickets.com)
- **Demo**: [demo.sbb-tickets.com](https://demo.sbb-tickets.com)
- **Email**: hello@sbb-tickets.com

---

**Appendix: Technical Architecture**

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete technical specification including:
- Mermaid diagrams (system architecture, data flows, use cases)
- Detailed cryptographic protocols
- Security analysis and threat modeling
- API specifications
- Database schemas
