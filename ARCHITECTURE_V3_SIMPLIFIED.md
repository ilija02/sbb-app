# SBB Digital Ticketing System - Architecture V3.0 (Simplified)

**Version**: 3.0 (Physical Card + HSM Focused)  
**Date**: November 22, 2025  
**Context**: LauzHack 2025 / BLS Cashless Transition

---

## Executive Summary

A **three-component digital ticketing system** inspired by **HID Physical Access Control**:

1. **HID App / Physical Card** - Passenger's credential (NFC card OR smartphone)
2. **Validator Machine** - At train doors (NFC reader, always online)
3. **Conductor Handheld** - Manual ticket checking (NFC reader OR camera)

### Core Security: HSM-Backed Credentials

**How HID Does It**:
- Physical cards have **secure element chips** (tamper-resistant crypto processors)
- Credentials signed by backend HSM, loaded onto card
- Readers validate credentials via challenge-response
- Cannot be cloned or shared

**Our Implementation**:
- Physical NFC cards: Mifare DESFire EV3 (AES-128 secure element)
- Mobile app: Smartphone NFC (Android HCE, iOS Wallet)
- Backend: HSM signs all credentials (AWS CloudHSM / Thales Luna)
- Validators: NFC readers validate offline with HSM public key

---

## System Components

### 1. Credential Carrier (Passenger)

#### Option A: Physical NFC Card
```
┌────────────────────────────────┐
│  Mifare DESFire EV3 Card      │
├────────────────────────────────┤
│ Secure Element (AES-128)       │
│ • Ticket ID                    │
│ • Expiry timestamp             │
│ • Route/Class                  │
│ • HSM signature                │
│ • Challenge-response keys      │
└────────────────────────────────┘
```

**How it works**:
- Passenger buys ticket at kiosk/counter
- Kiosk writes credential to card's secure element (NFC-A, 13.56 MHz)
- Card stores encrypted data (only readable by validators with correct keys)
- Cannot be cloned (secure element has anti-tamper protection)

**Technology**: 
- Chip: NXP Mifare DESFire EV3 (ISO 14443-A)
- Security: AES-128, 3DES, mutual authentication
- Storage: 2KB-8KB (plenty for ticket data)
- Cost: CHF 2-5 per card

#### Option B: Smartphone NFC (HID Mobile Access Pattern)
```
┌────────────────────────────────┐
│  Smartphone (Android/iOS)      │
├────────────────────────────────┤
│ NFC Controller + Secure Element │
│ • Android HCE (Host Card Emulation) │
│ • iOS Wallet / Apple Pay       │
│ • Credentials in secure storage│
│ • Challenge-response via NFC   │
└────────────────────────────────┘
```

**How it works**:
- Passenger downloads PWA wallet
- Purchases ticket (payment → backend → HSM signs → phone receives)
- Credential stored in Android KeyStore / iOS Secure Enclave
- Phone emulates NFC card (HCE) when near reader
- No Internet needed for validation (credential stored locally)

**Technology**:
- Android: Host Card Emulation (HCE) API
- iOS: Wallet framework, PassKit
- Storage: Secure Element / Trusted Execution Environment
- NFC: Same as physical cards (ISO 14443-A)

---

### 2. Validator Machine (Train Door)

```
┌─────────────────────────────────────────┐
│  Validator Machine (Always Online)      │
├─────────────────────────────────────────┤
│ Hardware:                               │
│ • NFC Reader (13.56 MHz)                │
│ • Display (LED: Green/Red)              │
│ • Network: 4G/5G modem                  │
│ • CPU: ARM Cortex-A53 (Linux)           │
│                                         │
│ Software:                               │
│ • NFC reader daemon                     │
│ • Validation logic (offline capable)    │
│ • Backend sync service                  │
│ • Revocation list cache                 │
└─────────────────────────────────────────┘
```

**Flow**:
```
1. Passenger taps card/phone on reader
2. Reader initiates challenge-response:
   a. Reader sends random challenge (16 bytes)
   b. Card/phone computes HMAC response
   c. Reader receives response
3. Validator verifies:
   a. Response valid (HMAC check with cached public key)
   b. Ticket not expired
   c. Credential not revoked (check local revocation list)
4. Validator opens door (green LED) or denies (red LED + beep)
5. Log validation to backend (async)
```

**Placement**:
- Train door entrances (2-4 per train car)
- Fixed installation, powered from train
- Always online (cellular modem)

**Hardware**:
- NFC Reader: ACR122U or similar (CHF 50-100)
- Display: Simple LED lights
- Computer: Raspberry Pi 4 / Intel NUC (CHF 100-200)
- Modem: 4G/5G cellular (CHF 50)
- **Total per unit**: CHF 200-350

---

### 3. Conductor Handheld Device

```
┌─────────────────────────────────────────┐
│  Conductor Handheld (Tablet/Phone)      │
├─────────────────────────────────────────┤
│ Hardware:                               │
│ • NFC reader (built-in or USB dongle)   │
│ • Camera (for QR fallback)              │
│ • Display (validation result)           │
│ • Battery powered                       │
│                                         │
│ Software:                               │
│ • Conductor app (PWA)                   │
│ • NFC read capability                   │
│ • QR scanner                            │
│ • Offline mode (Bloom filter)           │
│ • Manual override                       │
└─────────────────────────────────────────┘
```

**Flow**:
```
1. Conductor opens validation app
2. Taps passenger's card/phone with NFC reader
   OR scans QR code fallback
3. App validates:
   a. Challenge-response protocol
   b. Check expiry
   c. Check revocation list (cached)
4. Show result: ✅ VALID or ❌ INVALID
5. If invalid: Conductor issues fine
6. Sync logs when back online
```

**Device Options**:
- **Option 1**: Standard tablet + USB NFC reader (CHF 300-500)
- **Option 2**: Rugged handheld with built-in NFC (CHF 800-1200)
- **Option 3**: Conductor's phone + NFC dongle (CHF 50-100)

---

## Backend Architecture

### Core Services

```
┌────────────────────────────────────────────────────────┐
│                   BACKEND (Cloud)                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────┐      ┌──────────────────┐      │
│  │  Ticket API      │      │  HSM Service     │      │
│  │  (FastAPI)       │──────│  (AWS CloudHSM)  │      │
│  │                  │      │                  │      │
│  │ • Purchase       │      │ • Sign tickets   │      │
│  │ • Provision      │      │ • Verify sigs    │      │
│  │ • Revoke         │      │ • Key rotation   │      │
│  └──────────────────┘      └──────────────────┘      │
│           │                                           │
│           ▼                                           │
│  ┌──────────────────────────────────────────┐        │
│  │  PostgreSQL Database                     │        │
│  ├──────────────────────────────────────────┤        │
│  │ Tables:                                  │        │
│  │ • tickets (id, route, expiry, status)    │        │
│  │ • validations (ticket_id, validator_id,  │        │
│  │   timestamp, location)                   │        │
│  │ • revocations (ticket_id, reason)        │        │
│  │ • hsm_signatures (ticket_id, signature)  │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  ┌──────────────────────────────────────────┐        │
│  │  Validator Sync Service                  │        │
│  ├──────────────────────────────────────────┤        │
│  │ • Receives validation logs               │        │
│  │ • Sends revocation list updates          │        │
│  │ • Monitors fraud patterns                │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## HSM Integration (Production)

### Why HSM is Essential

**Problem**: If credential signing keys stored in software:
- Attackers can steal keys → forge tickets
- No audit trail of key usage
- Can't prove tickets are authentic

**Solution**: Hardware Security Module (HSM)
- Keys never leave hardware (tamper-resistant)
- All signing operations logged
- FIPS 140-2 Level 3 certified
- Government/enterprise grade

### How HID Does It

HID's credential system:
```
1. Backend has HSM with private signing key
2. Card/phone requests credential
3. Backend creates credential data (ticket ID, expiry, etc.)
4. HSM signs credential with private key
5. Credential + signature sent to card/phone
6. Card stores credential in secure element
7. Validators have HSM public key (cached)
8. Validator verifies signature offline
```

Our implementation is **identical**:
```
Purchase → Backend → HSM Signs → Credential + Signature → Card/Phone
Validation → Reader extracts credential → Verify signature with public key → Accept/Deny
```

### AWS CloudHSM Example

```python
import boto3
from cloudhsm_client import CloudHSMClient

class TicketSigner:
    def __init__(self):
        self.hsm = CloudHSMClient(cluster_id='cluster-abc123')
        self.signing_key_id = 'sbb-ticket-signing-key-2025'
    
    def sign_ticket(self, ticket_data):
        """
        Sign ticket credential using HSM
        Returns: signature (256 bytes)
        """
        # Serialize ticket data
        message = json.dumps({
            'ticket_id': ticket_data['id'],
            'route': ticket_data['route'],
            'class': ticket_data['class'],
            'valid_from': ticket_data['valid_from'],
            'valid_until': ticket_data['valid_until']
        }, sort_keys=True)
        
        # HSM signs (private key never leaves HSM)
        signature = self.hsm.sign(
            key_id=self.signing_key_id,
            message=message.encode(),
            algorithm='RSASSA_PKCS1_V1_5_SHA_256'
        )
        
        # Log to audit trail
        db.execute(
            "INSERT INTO hsm_signatures (ticket_id, signature, signed_at) "
            "VALUES (?, ?, ?)",
            (ticket_data['id'], signature.hex(), datetime.now())
        )
        
        return signature.hex()
    
    def get_public_key(self):
        """
        Export public key for validators
        """
        return self.hsm.export_public_key(self.signing_key_id)
```

**Validator verification** (offline):
```python
def verify_ticket_signature(ticket_data, signature, public_key):
    """
    Verify ticket signature using cached HSM public key
    No need to contact backend!
    """
    message = json.dumps(ticket_data, sort_keys=True)
    
    return rsa_verify(
        public_key=public_key,
        message=message.encode(),
        signature=bytes.fromhex(signature),
        algorithm='RSASSA_PKCS1_V1_5_SHA_256'
    )
```

### HSM Costs

| Provider            | Monthly Cost       | Hardware   | Level         |
| ------------------- | ------------------ | ---------- | ------------- |
| AWS CloudHSM        | $1,500             | Cloud      | FIPS 140-2 L3 |
| Azure Key Vault HSM | $1,200             | Cloud      | FIPS 140-2 L3 |
| Thales Luna HSM     | $15,000 (one-time) | On-premise | FIPS 140-2 L3 |
| YubiHSM 2           | $650 (one-time)    | On-premise | FIPS 140-2 L3 |

**Recommendation**: AWS CloudHSM for production (cloud-based, easy to integrate)

---

## Physical Card Support

### Does Current Architecture Support Physical Cards?

**Answer**: YES, but needs adaptation

**Current system** (V2.0):
- Designed for smartphone app (device binding via browser fingerprint)
- Credentials encrypted with device-specific keys
- Challenge-response via BLE / QR codes

**What needs to change for physical cards**:

1. **Remove device binding** (cards don't have unique fingerprints like phones)
2. **Use secure element** instead of browser crypto
3. **NFC communication** instead of BLE/QR
4. **HSM becomes mandatory** (no more mock signing)

### How Physical Cards Work

#### Card Technology: Mifare DESFire EV3

```
┌───────────────────────────────────────┐
│  NXP Mifare DESFire EV3 Card         │
├───────────────────────────────────────┤
│  Secure Element (AES-128 encryption)  │
│                                       │
│  Memory Layout:                       │
│  ┌─────────────────────────────────┐ │
│  │ Application ID: 0x5342 (SBB)    │ │
│  ├─────────────────────────────────┤ │
│  │ File 0: Ticket Data             │ │
│  │   • Ticket ID (16 bytes)        │ │
│  │   • Route code (4 bytes)        │ │
│  │   • Class (1 byte)              │ │
│  │   • Valid from (4 bytes UNIX)   │ │
│  │   • Valid until (4 bytes UNIX)  │ │
│  ├─────────────────────────────────┤ │
│  │ File 1: HSM Signature           │ │
│  │   • Signature (256 bytes)       │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Security:                            │
│  • Read protected (key required)      │
│  • Write once (cannot modify ticket)  │
│  • Challenge-response auth            │
└───────────────────────────────────────┘
```

#### Card Provisioning (Purchase)

```
1. Customer buys ticket at kiosk
2. Kiosk generates ticket data:
   {
     ticket_id: "TKT-2025-123456",
     route: "ZH-BE",
     class: 2,
     valid_from: 1732281600,
     valid_until: 1732368000
   }
3. Backend sends to HSM for signing
4. HSM returns signature
5. Kiosk writes to card via NFC:
   - Authenticates with card (AES-128 mutual auth)
   - Writes ticket data to File 0
   - Writes signature to File 1
   - Locks files (read-only)
6. Customer receives card
```

#### Card Validation (At Validator)

```
1. Passenger taps card on NFC reader
2. Reader initiates NFC communication (ISO 14443-A)
3. Reader authenticates with card (AES-128)
4. Reader reads File 0 (ticket data) + File 1 (signature)
5. Validator verifies:
   a. Signature valid (using cached HSM public key)
   b. Current time within valid_from..valid_until
   c. Ticket ID not in revocation list
6. Result:
   ✅ Valid: Green LED, door opens
   ❌ Invalid: Red LED, beep, door stays closed
7. Log validation to backend (async)
```

### Card vs. Smartphone Comparison

| Feature                | Physical Card               | Smartphone                |
| ---------------------- | --------------------------- | ------------------------- |
| **Hardware**           | Mifare DESFire chip         | NFC controller + SE       |
| **Security**           | Secure element (AES-128)    | Secure Enclave / KeyStore |
| **Storage**            | 2-8 KB                      | Unlimited                 |
| **Power**              | Passive (powered by reader) | Battery                   |
| **Cost**               | CHF 2-5 per card            | CHF 0 (user's phone)      |
| **Provisioning**       | NFC write at kiosk          | Over-the-air (Internet)   |
| **User Experience**    | Always works                | Requires battery, app     |
| **Durability**         | Very high (5+ years)        | Depends on phone          |
| **Lost/Stolen**        | Replace card                | Remote revocation         |
| **Sharing Prevention** | Card ID + validation logs   | Device binding            |

**Recommendation**: Support **both**
- Cards for elderly, tourists, children
- Smartphones for tech-savvy users

---

## Simplified Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    SWISS TICKETING SYSTEM                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────┐                    ┌──────────────┐
│  COMPONENT 1 │                    │  COMPONENT 2 │
│              │                    │              │
│   Passenger  │                    │  Validator   │
│              │                    │   Machine    │
│  ┌────────┐  │                    │  (At Door)   │
│  │  Card  │  │    1. Tap NFC      │              │
│  │   or   │  │──────────────────> │  ┌────────┐  │
│  │  Phone │  │                    │  │ Reader │  │
│  └────────┘  │                    │  └────────┘  │
│              │    2. Challenge    │              │
│  Credential: │ <────────────────  │  Validates:  │
│  • Ticket ID │                    │  • Signature │
│  • Expiry    │    3. Response     │  • Expiry    │
│  • Signature │──────────────────> │  • Revoked?  │
│              │                    │              │
│              │    4. ✅/❌ Result  │  Logs to:    │
│              │ <──────────────────│  Backend     │
└──────────────┘                    └──────┬───────┘
                                           │
       ┌───────────────────────────────────┘
       │
       ▼
┌──────────────┐                    ┌──────────────┐
│  COMPONENT 3 │                    │   BACKEND    │
│              │                    │              │
│  Conductor   │                    │  ┌────────┐  │
│   Handheld   │    5. Manual       │  │  HSM   │  │
│              │       Check        │  │ Signer │  │
│  ┌────────┐  │                    │  └────────┘  │
│  │ Tablet │  │──────────────────> │              │
│  │   +    │  │                    │  ┌────────┐  │
│  │  NFC   │  │    6. Verify       │  │   DB   │  │
│  └────────┘  │ <──────────────────│  └────────┘  │
│              │                    │              │
│  Functions:  │    7. Logs/Sync    │  Stores:     │
│  • Override  │──────────────────> │  • Tickets   │
│  • Fine      │                    │  • Logs      │
│  • Report    │                    │  • Revocations│
└──────────────┘                    └──────────────┘
```

---

## What to Remove from V2.0

### ❌ Remove (Unnecessary Complexity)

1. **Browser Device Fingerprinting**
   - Only needed for smartphones without secure element
   - Physical cards don't have "device identity"
   - Replaced by: Secure element on card / Secure Enclave on phone

2. **BLE (Bluetooth) Communication**
   - Over-complicated
   - Not needed - NFC is standard for physical access
   - Replaced by: NFC (ISO 14443-A)

3. **Rotating QR Codes**
   - Workaround for screenshot sharing
   - Not needed with NFC + challenge-response
   - Replaced by: NFC tap validation

4. **Device Key Generation (PBKDF2 + browser fingerprint)**
   - Only for software-only solution
   - Physical cards use secure element
   - Replaced by: Secure element authentication

5. **Blind Signatures** ✅ **PROMOTED TO CORE FEATURE**
   - **Required for privacy** (not optional)
   - Decouples payment from ticket usage
   - Works with ALL payment methods (credit card, cash, prepaid)
   - Prevents surveillance of passenger travel patterns

6. **TPM Integration**
   - Overkill for this use case
   - Physical cards don't have TPM
   - Remove entirely

7. **Twist-and-Go Motion Detection**
   - Gimmick feature
   - Not needed for train doors
   - Remove entirely

8. **Offline Bloom Filters**
   - Complex to implement
   - Validators can be always online (4G)
   - Simplified to: Small revocation list cache

---

## 🔐 Payment-Ticket Decoupling (Blind Signatures)

### Problem: Traditional Systems Link Everything

**Without blind signatures**:
```
Customer pays with credit card *1234
    ↓
Backend creates ticket_id "T-ABC123"
    ↓
HSM signs ticket_id directly
    ↓
Database: payments.ticket_id = "T-ABC123"
    ↓
Validator scans ticket "T-ABC123"
    ↓
Database: validations.ticket_id = "T-ABC123"
    ↓
JOIN payments AND validations → Full travel history linked to credit card
```

### Solution: Blind Signatures Decouple Payment from Usage

**With blind signatures (V3.0)**:
```
Customer pays with credit card *1234
    ↓
Payment processor: "Card *1234 paid CHF 55"
    ↓ (Payment system STOPS HERE)
    
Card generates blinded token B(T)  ← Backend cannot reverse
    ↓
Backend/HSM signs B(T) without seeing original T
    ↓
Card unblinds to get signature on T
    ↓
Database: payments table has NO ticket_id
    ↓
Validator scans ticket "T-XYZ123"  ← Different ID, generated on card
    ↓
Database: validations table has NO payment_ref
    ↓
❌ CANNOT JOIN payments to validations (no common key)
```

### Cryptographic Guarantee

**RSA Blind Signature Protocol**:
1. Card generates: T = random_256_bit() (original ticket_id)
2. Card blinds: B(T) = (T × r^e) mod N (r = random blinding factor)
3. Backend/HSM signs: S(B(T)) = B(T)^d mod N (d = private key)
4. Card unblinds: S(T) = S(B(T)) × r^(-1) mod N
5. Result: Valid signature on T, but HSM never saw T

**Mathematical Property**:
```
RSA_verify(T, S(T), public_key) = TRUE

Because: S(T)^e mod N = T (signature property preserved)
```

**Privacy Properties**:
- ✅ Payment processor knows: Who paid, how much, when
- ✅ Backend knows: Ticket type (route, class), blinded token
- ❌ Backend CANNOT know: Final ticket_id written to card
- ❌ Validators CANNOT know: Which payment bought this ticket
- ❌ Database queries CANNOT link: Payment to validation

### Database Architecture (Decoupled)

```sql
-- Payments table (isolated from tickets)
CREATE TABLE payments (
    payment_ref UUID PRIMARY KEY,
    payment_method VARCHAR(20),  -- 'card_1234', 'cash', 'prepaid'
    amount DECIMAL(10,2),
    route VARCHAR(10),           -- Generic ticket info
    class INT,
    timestamp BIGINT,
    kiosk_id VARCHAR(50)
    -- ⚠️ NO ticket_id - Cannot link to validations
);

-- Validations table (isolated from payments)
CREATE TABLE validations (
    validation_id UUID PRIMARY KEY,
    ticket_id VARCHAR(64),       -- From card/phone
    validator_id VARCHAR(50),
    location VARCHAR(100),
    timestamp BIGINT,
    result VARCHAR(20)           -- 'valid', 'expired', 'revoked'
    -- ⚠️ NO payment_ref - Cannot link to payments
);

-- Revocations table (for lost cards)
CREATE TABLE revocations (
    ticket_id VARCHAR(64) PRIMARY KEY,
    revoked_at BIGINT,
    reason VARCHAR(50)
);
```

**Query Results**:
```sql
-- ✅ CAN query: Revenue by payment method
SELECT payment_method, SUM(amount) FROM payments GROUP BY payment_method;

-- ✅ CAN query: Validator usage statistics
SELECT validator_id, COUNT(*) FROM validations GROUP BY validator_id;

-- ❌ CANNOT query: Travel patterns by payment method
SELECT p.payment_method, v.location, v.timestamp
FROM payments p
JOIN validations v ON p.??? = v.???  -- No join key exists!
```

### Benefits

| Aspect                      | Value                                                         |
| --------------------------- | ------------------------------------------------------------- |
| **Privacy**                 | Payment method decoupled from travel patterns                 |
| **Security**                | HSM never sees final ticket_id (reduced attack surface)       |
| **Compliance**              | GDPR-friendly (cannot track individuals)                      |
| **Surveillance Resistance** | Government cannot subpoena payment records to track movements |
| **Works with ALL payments** | Credit card, cash, prepaid - all get same privacy             |

### Trade-offs

| Pro                     | Con                                          |
| ----------------------- | -------------------------------------------- |
| ✅ Strong privacy        | ⚠️ Complex refund process                     |
| ✅ Prevents surveillance | ⚠️ Cannot auto-detect fraud patterns          |
| ✅ GDPR compliant        | ⚠️ Lost card = lost ticket (no ID link)       |
| ✅ Works offline         | ⚠️ Requires card-side crypto (secure element) |

---

### ✅ Keep (Essential)

1. **HSM Credential Signing** ✅
   - Core security feature
   - Mandatory for production

2. **Blind Signatures** ✅
   - Core privacy feature
   - Decouples payment from usage
   - Works with all payment methods

3. **Challenge-Response Protocol** ✅
   - Standard in physical access control
   - Prevents replay attacks

3. **NFC Communication** ✅
   - Standard for contactless cards
   - Works with phones too

4. **Offline Validation** ✅
   - Validators cache public key + revocation list
   - Can work in tunnels

5. **Anonymous Prepaid Cards** ✅
   - Required for BLS compliance
   - Purchase with cash, no identity

---

## Revised Data Flow

### Purchase Flow (DECOUPLED with Blind Signatures)

```
Payment → Payment Processor (records payment)
    ↓
Card/Phone → Generates Blinded Token → Backend → HSM Signs Blinded Token
    ↓
Card/Phone → Unblinds Signature → Valid Ticket (Backend never saw ticket_id)
```

**Detailed (Privacy-Preserving)**:
```
1. Customer selects ticket (route, class, duration)
2. Customer pays (credit card, cash, prepaid)
   → Payment processor records: {payment_ref, amount, card_number, timestamp}
   → Backend receives: {payment_confirmed: true, payment_ref}
   ⚠️ PAYMENT STOPS HERE - No ticket_id created yet

3. Card/Phone generates blinded token:
   a. Generate random ticket_id: T = random_256_bit()
   b. Generate blinding factor: r = random()
   c. Compute blinded token: B(T) = (T * r^e) mod N
      (e, N are HSM's public RSA parameters)

4. Card/Phone → Backend:
   POST /api/tickets/provision_blind
   {
     "blinded_token": "B(T)",  ← Backend cannot reverse this
     "route": "ZH-BE",
     "class": 2,
     "payment_ref": "payment_abc123"
   }

5. Backend → HSM:
   - HSM signs blinded token: S(B(T)) = B(T)^d mod N
   - HSM NEVER SEES original ticket_id (T)
   - Only sees random-looking blinded token

6. Backend stores payment record ONLY (no ticket_id):
   INSERT INTO payments (payment_ref, route, class, amount, timestamp)
   ⚠️ Cannot link to future validations

7. Backend → Card/Phone: {blind_signature: S(B(T)), valid_from, valid_until}

8. Card/Phone unblinds signature:
   S(T) = S(B(T)) * r^(-1) mod N
   → Now has VALID HSM signature on ORIGINAL ticket_id (T)

9a. If physical card: Kiosk writes to card via NFC
    - File 0: Ticket data (with original T)
    - File 1: Unblinded signature S(T)
9b. If smartphone: App stores in secure storage

Result: Payment recorded, but ticket usage unlinkable
```

**Database Schema (Decoupled)**:
```sql
-- Payments (links to payment system, NOT tickets)
CREATE TABLE payments (
    payment_ref UUID PRIMARY KEY,
    amount DECIMAL,
    payment_method VARCHAR(20),
    route VARCHAR(10),
    class INT,
    timestamp BIGINT
    -- ⚠️ NO ticket_id column
);

-- Validations (links to validators, NOT payments)  
CREATE TABLE validations (
    validation_id UUID PRIMARY KEY,
    ticket_id VARCHAR(64),  -- From card/phone
    validator_id VARCHAR(50),
    timestamp BIGINT
    -- ⚠️ NO payment_ref column
);

-- ❌ IMPOSSIBLE: Cannot JOIN payments to validations
-- SELECT * FROM payments p JOIN validations v ON p.??? = v.???
```

### Validation Flow (Works with Blind Signatures)

```
Card/Phone → NFC Tap → Reader → Verify Signature → Log (Cannot Link to Payment)
```

**Detailed**:
```
1. Passenger taps card/phone on validator NFC reader

2. Reader reads card/phone via NFC:
   - ticket_id: "T-XYZ123"  ← Original unblinded ID
   - route: "ZH-BE"
   - class: 2
   - valid_from: 1732281600
   - valid_until: 1732368000
   - signature: S(T)  ← Unblinded HSM signature

3. Reader verifies OFFLINE:
   a. Parse ticket data
   b. Check expiry: current_time < valid_until
   c. Verify signature: RSA_verify(ticket_data, S(T), HSM_public_key)
      → Signature is VALID because unblinding preserves validity
   d. Check revocation list: ticket_id not in cached revoked_tickets[]

4. Reader shows result:
   ✅ Valid → Green LED, door opens (< 300ms)
   ❌ Invalid → Red LED, beep

5. Reader logs to backend (async when online):
   INSERT INTO validations (ticket_id, validator_id, timestamp, result)
   
   ⚠️ Backend sees ticket_id "T-XYZ123" but CANNOT link to payment
   ⚠️ No payment_ref in validations table
   ⚠️ No ticket_id in payments table
   ⚠️ Cryptographically impossible to link
```

**Why Validators Cannot Track Users**:
```
Validator Log:
- 14:30: Ticket T-ABC validated at Zurich HB
- 15:45: Ticket T-XYZ validated at Bern Station
- 16:20: Ticket T-DEF validated at Bern Station

Payment Records:
- 14:20: Card *1234 paid CHF 55
- 14:25: Cash payment CHF 55
- 14:28: Card *5678 paid CHF 55

Question: Which payment belongs to ticket T-XYZ?
Answer: ❌ IMPOSSIBLE TO DETERMINE
- No database join key
- HSM never saw original ticket_id during signing
- Backend signed blinded token, not final ticket
```

---

## Implementation Priorities

### Phase 1: HSM + Backend (2 weeks)
```
✅ Setup AWS CloudHSM
✅ Implement ticket signing API
✅ PostgreSQL schema
✅ Validation logging
✅ Public key distribution to validators
```

### Phase 2: Physical Card Support (2 weeks)
```
✅ Mifare DESFire integration
✅ NFC read/write at kiosks
✅ Card provisioning flow
✅ Secure element authentication
```

### Phase 3: Validator Machines (2 weeks)
```
✅ NFC reader integration (ACR122U)
✅ Challenge-response implementation
✅ Offline verification (cached public key)
✅ LED indicators + door control
✅ Backend sync service
```

### Phase 4: Conductor Handheld (1 week)
```
✅ Tablet app with NFC reader
✅ Manual validation UI
✅ Offline mode (revocation list cache)
✅ Fine issuance workflow
```

### Phase 5: Smartphone Support (1 week)
```
✅ PWA wallet with NFC HCE
✅ Secure storage (KeyStore/Enclave)
✅ Over-the-air provisioning
✅ Challenge-response via NFC
```

---

## Hardware Requirements

### For Production Deployment

| Component                            | Quantity | Unit Cost       | Total           |
| ------------------------------------ | -------- | --------------- | --------------- |
| **Physical Cards** (Mifare DESFire)  | 100,000  | CHF 3           | CHF 300,000     |
| **Kiosks** (with NFC writers)        | 50       | CHF 5,000       | CHF 250,000     |
| **Validator Machines** (train doors) | 500      | CHF 300         | CHF 150,000     |
| **Conductor Handhelds** (tablets)    | 200      | CHF 500         | CHF 100,000     |
| **Backend HSM** (AWS CloudHSM)       | 1        | CHF 18,000/year | CHF 18,000      |
| **Backend Servers** (AWS EC2)        | 3        | CHF 2,000/year  | CHF 6,000       |
| **Total Initial**                    |          |                 | **CHF 824,000** |
| **Annual Operating**                 |          |                 | **CHF 24,000**  |

---

## Security Comparison: V2 vs V3

| Feature                | V2 (Smartphone Only)                 | V3 (Cards + Phones)              |
| ---------------------- | ------------------------------------ | -------------------------------- |
| **Anti-Sharing**       | Device binding (browser fingerprint) | Secure element + validation logs |
| **Credential Storage** | Browser IndexedDB (encrypted)        | Secure element (hardware)        |
| **Signing**            | HSM (optional)                       | HSM (mandatory)                  |
| **Validation**         | BLE/QR challenge-response            | NFC challenge-response           |
| **Offline**            | Bloom filters                        | Revocation list cache            |
| **Physical Security**  | Software only                        | Hardware secure element          |
| **Cloning Prevention** | Browser fingerprint                  | Secure element anti-tamper       |
| **User Experience**    | Requires smartphone + battery        | Works always (passive NFC)       |

**Verdict**: V3 is **more secure** and **more practical**

---

## Conclusion

### Key Changes from V2 to V3

1. **Added Physical Card Support** ✅
   - Mifare DESFire secure element
   - NFC-based validation
   - Works for non-smartphone users

2. **Made HSM Mandatory** ✅
   - All credentials HSM-signed
   - No mock/software signing
   - Production-grade security

3. **Simplified Communication** ✅
   - NFC only (no BLE, no QR codes)
   - Standard ISO 14443-A
   - Works with cards and phones

4. **Removed Unnecessary Features** ✅
   - No blind signatures
   - No device fingerprinting
   - No rotating QR codes
   - No TPM integration
   - No twist-and-go

5. **Three Clear Components** ✅
   - Credential (card/phone)
   - Validator (door reader)
   - Conductor (handheld)

### Next Steps

1. **Review this architecture** with stakeholders
2. **Order physical cards** (Mifare DESFire samples)
3. **Setup AWS CloudHSM** (production environment)
4. **Build backend** with HSM integration
5. **Test NFC readers** with sample cards
6. **Pilot with 1 train** (100 cards, 10 validators)

---

**Document Version**: 3.0  
**Replaces**: ARCHITECTURE_V2.md  
**For Business Case**: See [PITCH_DECK.md](./PITCH_DECK.md)  
**For Use Cases**: See [USE_CASES.md](./USE_CASES.md) (needs update)
