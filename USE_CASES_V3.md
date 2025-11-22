# Use Cases - Physical Card + HSM Ticketing System

**Version**: 3.0 (Simplified - Physical Cards + HSM)  
**Date**: November 22, 2025  
**Architecture**: Three components (Card/Phone + Validator + Conductor)

---

## Overview

This document describes the use cases for a **three-component digital ticketing system** using:
1. **Physical NFC cards** (Mifare DESFire EV3) OR **smartphones** (Android/iOS NFC)
2. **Validator machines** at train doors (automated NFC readers)
3. **Conductor handhelds** for manual ticket checking

**Key Features**:
- ✅ Multi-use cards (DESFire supports multiple tickets simultaneously)
- ✅ Anonymous purchases possible (blind signatures with physical cards)
- ✅ HSM-signed credentials (mandatory for production)
- ✅ Offline validation (validators cache HSM public key)
- ✅ Cannot be cloned (secure element hardware)

---

## Table of Contents

### Primary Use Cases (Physical Cards)
1. [UC1: Purchase Physical Card at Kiosk](#uc1-purchase-physical-card-at-kiosk)
2. [UC2: Validator Door Entry (NFC Tap)](#uc2-validator-door-entry-nfc-tap)
3. [UC3: Conductor Manual Check](#uc3-conductor-manual-check)
4. [UC4: Card Cloning Attack Prevention](#uc4-card-cloning-attack-prevention)
5. [UC5: Anonymous Prepaid Purchase (Blind Signatures)](#uc5-anonymous-prepaid-purchase-blind-signatures)

### Secondary Use Cases (Smartphones)
6. [UC6: Purchase Ticket on Smartphone](#uc6-purchase-ticket-on-smartphone)
7. [UC7: Smartphone NFC Validation](#uc7-smartphone-nfc-validation)

### System Use Cases
8. [UC8: Card Loss & Revocation](#uc8-card-loss--revocation)
9. [UC9: Multi-Use Card Management](#uc9-multi-use-card-management)
10. [UC10: Offline Validator Operation](#uc10-offline-validator-operation)

---

## UC1: Purchase Physical Card at Kiosk (Blind Signatures - ALL Payment Methods)

**Actor**: Passenger  
**Goal**: Purchase ticket on physical NFC card with payment unlinkability  
**Preconditions**: Kiosk operational, passenger has payment method  
**Postconditions**: Card contains HSM-signed ticket credential, backend cannot link payment to ticket_id

### Flow (DECOUPLED: Payment ≠ Ticket)

```
1. Passenger at ticket kiosk selects:
   Route: Zurich HB → Bern
   Class: 2nd
   Type: Single ride (24h validity)
   Price: CHF 55.00

2. Passenger pays (credit card OR cash OR prepaid)
   → Payment processor records: "CHF 55 paid at kiosk_123"
   → Backend receives: {"payment_confirmed": true, "amount": 55}
   → ⚠️ PAYMENT SYSTEM STOPS HERE - No ticket_id revealed

3. Kiosk prompts: "Place card on reader"
   - Use existing card OR
   - Buy new card (+CHF 5)

4. Passenger places Mifare DESFire card on NFC reader

5. Card generates BLINDED TOKEN (on secure element):
   - Original ticket_id: T = random_256_bit()
   - Blinding factor: r = random()
   - Blinded token: B(T) = (T * r^e) mod N
     (e, N are HSM's public RSA params)

6. Kiosk → Backend API (BLIND SIGNATURE REQUEST):
   POST /api/tickets/provision_blind
   {
     "blinded_token": "B(T)",  ← Backend cannot see T
     "route": "ZH-BE",
     "class": 2,
     "duration_hours": 24,
     "payment_ref": "payment_abc123"  ← Only proves payment, not ticket_id
   }

7. Backend → HSM:
   - Backend sends B(T) to HSM
   - HSM signs: S(B(T)) = B(T)^d mod N
     (d is private key, never leaves HSM)
   - ⚠️ HSM NEVER SEES ORIGINAL TICKET_ID (T)

8. Backend → Kiosk:
   {
     "blind_signature": "S(B(T))",  ← Signature on BLINDED token
     "route": "ZH-BE",
     "class": 2,
     "valid_from": 1732281600,
     "valid_until": 1732368000
   }

9. Card UNBLINDS signature (on secure element):
   S(T) = S(B(T)) * r^(-1) mod N
   → Now card has VALID HSM signature on ORIGINAL ticket_id (T)

10. Kiosk writes to card via NFC:
    Application: 0x5342 (SBB)
    File 0: Ticket data (29 bytes) - using ORIGINAL T
    File 1: UNBLINDED signature S(T) (256 bytes)
    Permissions: Read=Free, Write=Never (locked)

11. Receipt printed (optional) - Shows route, class, NOT ticket_id

12. Passenger receives card with unlinkable ticket
```

### Privacy Guarantee (ALL Payment Methods)

**Payment System Knows**:
- ✅ CHF 55 paid via credit card 1234
- ✅ Payment at kiosk_123 at 14:30
- ✅ Payment reference: payment_abc123

**Backend/HSM Knows**:
- ✅ Someone requested ticket (ZH→BE, 2nd class)
- ✅ Payment confirmed (payment_abc123)
- ✅ Signed a blinded token B(T)
- ❌ **CANNOT KNOW** original ticket_id (T)

**Validator Knows**:
- ✅ Ticket is valid (HSM signature verifies correctly)
- ✅ Ticket_id T (for revocation check)
- ❌ **CANNOT LINK** to payment or purchase location

**Result**: Credit card payment is recorded, but ticket usage is unlinkable

### Technical Details

**Card Memory Layout**:
```
Mifare DESFire EV3 (2KB-8KB storage)
├── Application 0x5342 (SBB Tickets)
│   ├── File 0: Ticket #1 (29 bytes)
│   │   ├─ ticket_id[16]
│   │   ├─ route_code[4]
│   │   ├─ class[1]
│   │   ├─ valid_from[4]
│   │   └─ valid_until[4]
│   ├── File 1: Signature #1 (256 bytes)
│   ├── File 2: Ticket #2 (29 bytes)  ← MULTI-USE
│   ├── File 3: Signature #2 (256 bytes)
│   └── ... (up to 32 files, ~16 tickets max)
└── Application 0x5343 (SBB Balance)
    └── File 0: Prepaid balance (optional)
```

**Multi-Use Support**:
- Each ticket uses 2 files (data + signature)
- DESFire supports 32 files per application
- **Maximum 16 tickets per card simultaneously**
- Expired tickets can be overwritten

**HSM Blind Signing** (Backend):
```python
def provision_blind_ticket(blind_request):
    # Verify payment confirmation
    payment = verify_payment(blind_request.payment_ref)
    if not payment.confirmed:
        raise PaymentError("Payment not confirmed")
    
    # ⚠️ CRITICAL: Backend only sees BLINDED token, NOT original ticket_id
    blinded_token = blind_request.blinded_token
    
    # Sign blinded token with HSM (backend never sees original)
    hsm = CloudHSMClient()
    blind_signature = hsm.sign_raw(
        key_id='sbb-signing-key-2025',
        message=bytes.fromhex(blinded_token),  # Sign blinded token as-is
        algorithm='RSA_PKCS1'  # Raw RSA signing (no hashing)
    )
    
    # ⚠️ Store payment info ONLY - NO ticket_id
    db.execute("""
        INSERT INTO payments (payment_ref, route, class, amount, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, blind_request.payment_ref, blind_request.route, 
        blind_request.ticket_class, payment.amount, int(time.time()))
    
    # ⚠️ DO NOT store ticket_id or blind_signature linkage
    # This ensures payment cannot be linked to future validations
    
    return {
        "blind_signature": blind_signature.hex(),
        "route": blind_request.route,
        "class": blind_request.ticket_class,
        "valid_from": int(time.time()),
        "valid_until": int(time.time()) + (blind_request.duration_hours * 3600)
        # Note: NO ticket_id returned - card generates it locally
    }
```

**Card-Side Unblinding** (On DESFire Secure Element):
```python
def unblind_and_store_ticket(blind_signature, ticket_params):
    # Original values (stored in card memory during blinding)
    original_ticket_id = card.secure_memory.read('pending_ticket_id')
    blinding_factor_r = card.secure_memory.read('blinding_factor')
    
    # Unblind signature
    # S(T) = S(B(T)) * r^(-1) mod N
    blind_sig_int = int.from_bytes(blind_signature, 'big')
    r_inverse = pow(blinding_factor_r, -1, RSA_MODULUS_N)
    unblinded_signature = (blind_sig_int * r_inverse) % RSA_MODULUS_N
    
    # Create final ticket data
    ticket_data = {
        "ticket_id": original_ticket_id,  # ORIGINAL unblinded ID
        "route": ticket_params.route,
        "class": ticket_params.ticket_class,
        "valid_from": ticket_params.valid_from,
        "valid_until": ticket_params.valid_until
    }
    
    # Write to card storage
    card.write_file(
        app_id=0x5342,
        file_id=get_next_free_file(),
        data=serialize(ticket_data)
    )
    card.write_file(
        app_id=0x5342,
        file_id=get_next_free_file(),
        data=unblinded_signature.to_bytes(256, 'big')
    )
    
    # Clear temporary blinding data
    card.secure_memory.erase('pending_ticket_id')
    card.secure_memory.erase('blinding_factor')
    
    return True
```

**Payment Database Schema** (DECOUPLED):
```sql
-- Payments table (links to payment system, NOT tickets)
CREATE TABLE payments (
    payment_ref UUID PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20),  -- 'card', 'cash', 'prepaid'
    route VARCHAR(10),
    class INT,
    timestamp BIGINT,
    -- ⚠️ NO ticket_id column
    -- ⚠️ NO blind_signature column
);

-- Validations table (links to validators, NOT payments)
CREATE TABLE validations (
    validation_id UUID PRIMARY KEY,
    ticket_id VARCHAR(64),  -- Seen at validator
    validator_location VARCHAR(100),
    timestamp BIGINT,
    -- ⚠️ NO payment_ref column
    -- Cannot join to payments table
);

-- Revocations table (for lost cards)
CREATE TABLE revocations (
    ticket_id VARCHAR(64) PRIMARY KEY,
    revoked_at BIGINT,
    reason VARCHAR(50)  -- 'lost', 'stolen', 'fraud'
);
```

**Why This Prevents Linking**:
```sql
-- ❌ IMPOSSIBLE: Cannot join payments to validations
SELECT p.payment_method, v.validator_location
FROM payments p
JOIN validations v ON p.??? = v.???  -- No common key!

-- ✅ Payment system knows: "Credit card 1234 paid CHF 55"
-- ✅ Validator logs show: "Ticket T-XYZ validated at Zurich HB"
-- ❌ Cannot prove they're the same transaction
```

---

## UC2: Validator Door Entry (NFC Tap)

**Actor**: Passenger  
**Goal**: Enter train through automated validator door  
**Preconditions**: Validator operational, card has valid ticket  
**Postconditions**: Door opens if valid, logs validation

### Flow

```
1. Passenger approaches train door validator

2. Passenger taps NFC card on reader

3. Validator reads card (NFC ISO 14443-A):
   - Application 0x5342
   - File 0: Ticket data
   - File 1: Signature

4. Validator validates OFFLINE:
   ✓ Parse ticket data
   ✓ Check: current_time < valid_until
   ✓ Verify HSM signature (cached public key)
   ✓ Check revocation list (ticket_id not revoked)

5a. If VALID:
    - Green LED ✅
    - Beep (success)
    - Unlock door for 3 seconds
    - Log: ticket_id, validator_id, timestamp

5b. If INVALID:
    - Red LED ❌
    - Beep beep (error)
    - Door stays locked
    - Display: "Ticket expired" or "Invalid"
    - Log rejection

6. Passenger enters (if valid)

7. Door auto-closes after 3s

8. Validator syncs log to backend (async, 4G modem)
```

### Validation Code

```python
def validate_nfc_card(card_data):
    # Parse ticket
    ticket = parse_bytes(card_data['file_0'])
    signature = card_data['file_1']
    
    # Check expiry
    now = int(time.time())
    if now < ticket['valid_from'] or now > ticket['valid_until']:
        return {"valid": False, "reason": "Expired"}
    
    # Verify signature OFFLINE
    message = serialize_ticket(ticket)
    if not rsa_verify(HSM_PUBLIC_KEY_CACHED, message, signature):
        return {"valid": False, "reason": "Invalid signature"}
    
    # Check revocation list (cached, updated every 5 min)
    if ticket['ticket_id'] in REVOCATION_CACHE:
        return {"valid": False, "reason": "Revoked"}
    
    # Success
    return {"valid": True, "ticket_id": ticket['ticket_id']}
```

**Performance**:
- NFC read: 200ms
- Signature verify: 50ms
- Total: **<300ms** (sub-second)

---

## UC3: Conductor Manual Check

**Actor**: Conductor  
**Goal**: Manually validate tickets during train ride  
**Preconditions**: Conductor has handheld with NFC, passengers onboard  
**Postconditions**: Tickets validated, invalid tickets flagged

### Flow

```
1. Conductor opens tablet app

2. Conductor walks through train car

3. Passenger shows card

4. Conductor taps card on handheld NFC reader

5. App validates (same logic as validator door):
   - Read card via NFC
   - Verify HSM signature offline
   - Check expiry
   - Check revocation list

6a. If VALID:
    ✅ Green screen
    Display: Ticket ID, Route, Expiry
    Beep (success)
    Conductor moves to next passenger

6b. If INVALID:
    ❌ Red screen
    Display: Reason (expired/revoked/invalid)
    Beep beep (error)
    Conductor options:
    - Issue fine
    - Allow with override (logged)
    - Report to system

7. All validations logged locally (offline mode)

8. When back in service area:
   - Auto-sync logs to backend
   - Download updated revocation list
```

### Conductor UI

```
┌────────────────────────────────────┐
│  🎫 SBB Ticket Validator           │
├────────────────────────────────────┤
│  Conductor: #1234                  │
│  Train: IC 123 (ZH→BE)             │
│  Online ● | Checked: 47            │
├────────────────────────────────────┤
│                                    │
│    👋 Tap passenger's card         │
│                                    │
│    [NFC Reader Active]             │
│                                    │
├────────────────────────────────────┤
│  Last Validation:                  │
│  ✅ VALID - TKT-2025-112201        │
│  2nd class, ZH→BE, Exp: 18:00     │
├────────────────────────────────────┤
│  [Settings] [Sync] [Report]        │
└────────────────────────────────────┘
```

**Hardware Options**:
1. Tablet + USB NFC reader (CHF 400)
2. Rugged handheld with built-in NFC (CHF 1,000)
3. Conductor's phone + NFC dongle (CHF 100)

---

## UC4: Card Cloning Attack Prevention

**Actor**: Attacker  
**Goal**: Clone a valid ticket card to share with others  
**Expected Outcome**: Cloning fails due to secure element

### Attack Scenario

```
1. Attacker buys valid ticket card

2. Attacker tries to clone card:

   Method A: Copy UID (card ID)
   ❌ FAILS - DESFire has encrypted UID
   ❌ Validators don't validate by UID alone

   Method B: Read data and write to blank card
   ❌ FAILS - Files are read-protected
   ❌ Requires AES-128 key to authenticate
   ❌ Kiosks have unique write keys per card

   Method C: Extract data from memory
   ❌ FAILS - Secure element anti-tamper
   ❌ Opening card destroys memory
   ❌ Fault injection attacks prevented

   Method D: Replay NFC communication
   ❌ FAILS - Challenge-response authentication
   ❌ Each communication uses random nonce
   ❌ Cannot predict future responses

3. Attacker gives up - cloning is cryptographically impossible
```

### Why Cloning Is Impossible

**Secure Element Protection**:
```
Mifare DESFire EV3 Features:
├── Unique diversified keys per card
├── Mutual authentication (AES-128)
├── Encrypted data transmission
├── Anti-tamper physical design
├── Random UID (can't be predicted)
├── Secure messaging layer
└── FIPS 140-2 Level 3 certified chip
```

**Even If Attacker Extracts Data**:
- Signature is bound to specific ticket_id
- Ticket_id tracked in backend validation logs
- Simultaneous use detected (fraud alert)
- Revocation immediate

**Comparison to Regular QR Codes**:
| Security Feature   | Regular QR | NFC Card         |
| ------------------ | ---------- | ---------------- |
| Screenshot sharing | ❌ Possible | ✅ Impossible     |
| Photo copy         | ❌ Possible | ✅ Impossible     |
| Data extraction    | ❌ Visible  | ✅ Encrypted      |
| Clone card         | ❌ Easy     | ✅ Impossible     |
| Hardware security  | ❌ None     | ✅ Secure element |

---

## UC5: Anonymous Purchase with Credit Card (Blind Signatures)

**Actor**: Passenger (privacy-conscious, uses credit card)  
**Goal**: Purchase ticket with credit card but prevent usage tracking  
**Preconditions**: Passenger has credit/debit card  
**Postconditions**: Credit card payment recorded, but ticket usage unlinkable

### How Blind Signatures Decouple Payment from Ticket

**Problem**: Without blind signatures, backend links payment → ticket_id → validations  
**Solution**: Blind signature protocol prevents backend from seeing ticket_id

### Flow (SAME AS UC1 - ALL PAYMENTS USE BLIND SIGNATURES)

```
1. Passenger selects ticket at kiosk (ZH→BE, CHF 55)

2. Passenger pays with CREDIT CARD
   → Card reader: "Approved - CHF 55"
   → Payment processor: "Card *1234 paid CHF 55 at kiosk_123"
   → Backend: "Payment confirmed: payment_abc123"

3. Card placed on NFC reader

4. Card generates BLINDED TOKEN:
   - Original ticket_id: T = random_256_bit()
   - Blinding factor: r = random()
   - Blinded token: B(T) = (T * r^e) mod N

5. Kiosk → Backend:
   POST /api/tickets/provision_blind
   {
     "blinded_token": "B(T)",  ← Backend cannot see T
     "route": "ZH-BE",
     "class": 2,
     "payment_ref": "payment_abc123"
   }

6. Backend → HSM:
   - HSM signs: S(B(T)) = B(T)^d mod N
   - HSM NEVER SEES original ticket_id (T)

7. Backend → Kiosk: S(B(T))

8. Card unblinds signature:
   S(T) = S(B(T)) * r^(-1) mod N

9. Kiosk writes to card:
   File 0: Ticket data (with ORIGINAL T)
   File 1: Unblinded signature S(T)

10. Passenger receives ticket
```

### Privacy Guarantee (Credit Card + Blind Signatures)

**Payment System Knows**:
- ✅ Credit card *1234 paid CHF 55
- ✅ Cardholder: Jane Smith
- ✅ Purchase location: Zurich HB kiosk_123
- ✅ Timestamp: 2025-11-22 14:30

**Backend/HSM Knows**:
- ✅ Payment confirmed (payment_abc123 = CHF 55)
- ✅ Ticket requested: ZH→BE, 2nd class
- ✅ Signed a blinded token B(T)
- ❌ **CANNOT KNOW** original ticket_id (T)

**Validator Logs Show**:
- ✅ Ticket T-XYZ123 validated at Bern Station, 15:45
- ✅ Signature valid (HSM public key verifies)
- ❌ **CANNOT LINK** to Jane Smith or credit card

**Database Query Attempts**:
```sql
-- ❌ IMPOSSIBLE: Cannot join payments to validations
SELECT p.cardholder, v.location, v.timestamp
FROM payments p
JOIN validations v ON p.??? = v.???  -- No common key exists!

-- Payment record: {payment_ref: abc123, card: *1234, amount: 55}
-- Validation record: {ticket_id: T-XYZ123, location: Bern, time: 15:45}
-- ⚠️ No cryptographic or database link between them
```

**Why This Works**:
- RSA blind signatures preserve signature validity
- Backend signs B(T), never sees T
- Unblinding reveals valid signature on T
- Validators verify signature normally
- **Payment processor knows purchase ≠ Validators know usage**

### Comparison: With vs Without Blind Signatures

| Scenario              | Without Blind Sig                            | With Blind Sig (V3.0)                 |
| --------------------- | -------------------------------------------- | ------------------------------------- |
| **Payment**           | Credit card *1234 → Backend                  | Credit card *1234 → Payment processor |
| **Ticket Generation** | Backend creates ticket_id                    | Card creates ticket_id locally        |
| **HSM Signing**       | HSM signs ticket_id directly                 | HSM signs blinded token B(T)          |
| **Backend Database**  | `payments.ticket_id = validations.ticket_id` | **No common key**                     |
| **Privacy**           | ❌ Full tracking possible                     | ✅ Unlinkable                          |
| **Refunds**           | ✅ Easy (knows your ticket)                   | ⚠️ Complex (no link)                   |
| **Surveillance**      | ❌ Can build travel graph                     | ✅ Cannot link trips                   |

### Multi-Use with Blind Signatures

**ALL tickets use blind signatures in V3.0**:
```
Card Memory (DESFire EV3):
├── Application 0x5342 (SBB Tickets)
│   ├── Ticket 1 (ZH→BE, blind sig, credit card paid)
│   ├── Ticket 2 (BE→GE, blind sig, cash paid)
│   ├── Ticket 3 (Monthly pass, blind sig, credit card paid)
│   └── ... (up to 16 tickets, all unlinkable)
└── Application 0x5343 (SBB Balance)
    └── Prepaid balance (optional)
```

Passenger can have:
- **All tickets use blind signatures** (consistent privacy)
- Multiple payment methods (credit card, cash, prepaid)
- All tickets unlinkable to payment method
- All on the same card!

---

## UC6: Purchase Ticket on Smartphone

**Actor**: Passenger with smartphone  
**Goal**: Purchase ticket and store in phone's NFC wallet  
**Preconditions**: Smartphone with NFC (Android HCE or iOS Wallet)  
**Postconditions**: Credential stored in secure element, can validate via NFC

### Flow

```
1. Passenger opens PWA: https://sbb-wallet.ch

2. Selects ticket:
   Route: ZH→BE
   Class: 2nd
   Duration: 24h

3. Pays via credit card (Apple Pay / Google Pay)

4. Backend provisions ticket:
   - Creates ticket_id
   - HSM signs credential
   - Returns to phone

5. Phone stores in secure storage:
   Android: Android KeyStore + HCE
   iOS: Secure Enclave + Wallet/PassKit

6. Credential encrypted at rest

7. Ticket appears in wallet app

8. Passenger can now validate via NFC tap
   (phone emulates NFC card)
```

### Technical: Android HCE

```java
// Host Card Emulation Service
public class TicketHCEService extends HostApduService {
    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        // Validator sends: SELECT application 0x5342
        if (isSelectCommand(commandApdu, 0x5342)) {
            return SUCCESS_RESPONSE;
        }
        
        // Validator sends: READ file 0
        if (isReadCommand(commandApdu, 0)) {
            return getTicketData();  // From KeyStore
        }
        
        // Validator sends: READ file 1
        if (isReadCommand(commandApdu, 1)) {
            return getSignature();  // From KeyStore
        }
        
        return ERROR_RESPONSE;
    }
}
```

### Technical: iOS Wallet

```swift
// Store ticket in iOS Wallet
let pass = PKPass()
pass.passTypeIdentifier = "ch.sbb.ticket"
pass.serialNumber = ticketId
pass.nfcPayload = NFCPayload(
    applicationIdentifier: 0x5342,
    ticketData: ticketBytes,
    signature: signatureBytes
)

PKPassLibrary().addPasses([pass]) { success in
    // Ticket now in Apple Wallet
    // Validates via NFC like physical card
}
```

**Advantages**:
- No physical card needed
- Over-the-air provisioning
- Multiple tickets in one device
- Can still use when phone is dead (Power Reserve on iOS)

---

## UC7: Smartphone NFC Validation

**Actor**: Passenger with smartphone ticket  
**Goal**: Validate ticket at validator door using NFC  
**Preconditions**: Phone has active ticket in wallet  
**Postconditions**: Door opens if valid

### Flow

```
1. Passenger approaches validator door

2. Passenger holds phone near NFC reader
   (Phone locked or unlocked - works either way)

3. Phone activates NFC:
   Android: HCE service responds
   iOS: Wallet app responds

4. Validator reads from phone (same as card):
   - Application 0x5342
   - File 0: Ticket data
   - File 1: Signature

5. Validator validates (identical to physical card)

6. Door opens if valid

7. Validation logged to backend
```

**User Experience**:
- Tap phone on reader (like contactless payment)
- Works even when phone locked
- Works even when battery low (Power Reserve)
- No need to open app
- Sub-second validation

**From Validator's Perspective**:
- Cannot tell difference between card and phone
- Same NFC protocol (ISO 14443-A)
- Same data format
- Same validation logic

---

## UC8: Card Loss & Revocation

**Actor**: Passenger  
**Goal**: Revoke lost card to prevent misuse  
**Preconditions**: Passenger has proof of purchase  
**Postconditions**: Card permanently invalidated

### Flow

```
1. Passenger loses card with active ticket

2. Passenger contacts SBB support:
   - Phone: 0800 123 456
   - Web: sbb.ch/support
   - App: Submit revocation request

3. Passenger provides proof:
   - Receipt number
   - Transaction ID
   - Purchase date/time/location
   - OR prepaid card number (if anonymous)

4. Support verifies identity/proof

5. Support revokes ticket:
   UPDATE tickets 
   SET status = 'revoked', revoked_at = NOW()
   WHERE ticket_id = 'TKT-2025-112201'

6. Revocation immediately added to:
   - Central revocation database
   - Distributed to all validators (within 5 minutes)

7. Next validation attempt:
   - Validator checks revocation list
   - Ticket_id found → REJECT
   - Door stays locked
   - Display: "Ticket revoked - contact support"

8. If passenger finds card later:
   - Cannot be used (permanently revoked)
   - Must purchase new ticket
```

### Revocation Distribution

```python
# Validators poll for revocation updates
@app.get("/api/revocations/since/{timestamp}")
def get_revocations_since(timestamp: int):
    revoked = db.execute("""
        SELECT ticket_id, revoked_at, reason
        FROM tickets
        WHERE status = 'revoked' 
        AND revoked_at > ?
    """, timestamp)
    
    return {"revocations": revoked}

# Validators cache revocation list
# Updated every 5 minutes
# Stored in SQLite on validator device
```

**Revocation List Size**:
- Average: 100 revocations/day
- List size: 30 days × 100 = 3,000 entries
- Storage: 3,000 × 20 bytes = 60 KB (tiny!)

---

## UC9: Multi-Use Card Management

**Actor**: Passenger with multi-use card  
**Goal**: Manage multiple tickets on one card  
**Preconditions**: Card has DESFire with multiple file support  
**Postconditions**: Multiple active tickets, correct one validated

### Card Structure

```
DESFire Card (4 KB storage)
├── Application 0x5342: SBB Tickets
│   ├── File 0: Ticket 1 (ZH→BE, expires 18:00)
│   ├── File 1: Signature 1
│   ├── File 2: Ticket 2 (BE→GE, expires 20:00)
│   ├── File 3: Signature 2
│   ├── File 4: Ticket 3 (Monthly pass, expires Jan 31)
│   ├── File 5: Signature 3
│   └── ... (up to 16 tickets)
└── Application 0x5343: Prepaid Balance
    └── File 0: Balance (CHF 45.50)
```

### Purchase Multiple Tickets

```
1. Passenger at kiosk buys 3 tickets:
   - Ticket A: ZH→BE (today, single)
   - Ticket B: BE→GE (today, single)
   - Ticket C: Monthly pass

2. Kiosk writes to different files:
   Files 0-1: Ticket A
   Files 2-3: Ticket B
   Files 4-5: Ticket C

3. All tickets coexist on same card
```

### Validation with Multiple Tickets

**Scenario**: Passenger has 3 tickets on card, wants to use Ticket A (ZH→BE)

```
1. Passenger taps card at validator

2. Validator reads ALL tickets from card:
   - Reads File 0, 2, 4, 6, ... (all ticket data files)
   - Reads File 1, 3, 5, 7, ... (all signature files)

3. Validator filters valid tickets:
   For each ticket:
   ✓ Check expiry (not expired)
   ✓ Verify signature
   ✓ Check route matches current validator location
   ✓ Check not revoked

4. Validator finds best match:
   - Ticket A: ZH→BE, valid ✅ MATCH!
   - Ticket B: BE→GE, valid but wrong route ❌
   - Ticket C: Monthly pass, valid ✅ MATCH!

5. Validator uses most specific ticket:
   - Monthly pass is valid anywhere
   - ZH→BE ticket is specific to this route
   - Use ZH→BE (avoid wasting monthly pass)

6. Door opens, log validation of Ticket A
```

### Expired Ticket Cleanup

```
1. Passenger's card has 5 tickets (3 expired, 2 valid)

2. At next purchase:
   Kiosk: "Card has expired tickets. Clean up?"
   
3. If yes:
   - Kiosk removes expired ticket files
   - Reclaims storage space
   - New ticket written to freed space

4. If no:
   - New ticket written to next available file
```

### Capacity Planning

**Storage per ticket**: 
- Ticket data: 29 bytes
- Signature: 256 bytes
- Total: 285 bytes per ticket

**Card capacity**:
- 2 KB card: ~7 tickets max
- 4 KB card: ~14 tickets max
- 8 KB card: ~28 tickets max

**Recommendation**: 4 KB cards (14 tickets) for most users

---

## UC10: Offline Validator Operation

**Actor**: Validator machine  
**Goal**: Continue validating tickets without Internet connection  
**Preconditions**: Validator has cached public key and revocation list  
**Postconditions**: Tickets validated offline, logs synced when online

### Offline Capability

```
Validator Machine Storage:
├── HSM Public Key (2 KB)
│   - Cached permanently
│   - Updated quarterly (key rotation)
│
├── Revocation List (60 KB)
│   - 3,000 most recent revocations
│   - Updated every 5 minutes when online
│   - Last update: 10 minutes ago ← STALE
│
└── Validation Logs (SQLite, 10 MB)
    - 50,000 validations cached
    - Synced every 10 seconds when online
```

### Offline Validation Flow

```
1. Train enters tunnel (no 4G signal)

2. Validator detects offline mode:
   - Cannot reach backend API
   - Switches to offline validation

3. Passenger taps card

4. Validator validates using cached data:
   ✓ Read card data
   ✓ Verify signature (HSM public key cached)
   ✓ Check expiry (local clock)
   ✓ Check revocation list (may be 10 min old)
   
5a. If valid per cached data:
    - Accept ticket
    - Green LED, door opens
    - Log validation to local SQLite
    - Mark log as "unsynced"

5b. If invalid:
    - Reject (same as online)

6. Validator stores unsynced logs:
   INSERT INTO validation_logs (ticket_id, timestamp, synced)
   VALUES ('TKT-2025-112201', 1732281600, 0)

7. Train exits tunnel (4G signal restored)

8. Validator syncs automatically:
   - Upload 347 unsynced validation logs
   - Download revocation list updates
   - Update timestamp of last sync

9. Backend processes offline logs:
   - Check if any offline validations were invalid
   - Flag for review if suspicious patterns
```

### Risk Mitigation

**Problem**: Revocation list may be stale during offline period

**Solution 1 - Short Offline Periods**:
- Trains are offline max 10-15 minutes (tunnels)
- Revocation list updated every 5 minutes
- Maximum staleness: 15 minutes
- Low risk window

**Solution 2 - Fraud Detection**:
```python
# Backend analyzes offline validations
def analyze_offline_validations(logs):
    for log in logs:
        # Check if ticket was revoked DURING offline period
        revocation = db.get_revocation(log.ticket_id)
        if revocation and revocation.revoked_at < log.timestamp:
            # Ticket was revoked but validator didn't know!
            alert_security_team({
                "ticket_id": log.ticket_id,
                "validated_at": log.timestamp,
                "revoked_at": revocation.revoked_at,
                "validator_id": log.validator_id,
                "risk": "revoked_ticket_used_offline"
            })
```

**Solution 3 - Statistical Monitoring**:
- Track offline validation success rates
- Alert if anomalies detected
- Flag validators with suspicious patterns

### Offline Performance

| Metric                       | Value                             |
| ---------------------------- | --------------------------------- |
| HSM public key size          | 2 KB                              |
| Revocation list size         | 60 KB (3,000 entries)             |
| Validation logs capacity     | 10 MB (50,000 entries)            |
| Validation speed offline     | <300ms (same as online)           |
| Maximum offline duration     | Unlimited (fully offline-capable) |
| Sync frequency (when online) | Every 10 seconds                  |

---

## Summary Matrix

| Use Case                   | Actor     | Physical Card | Smartphone | Anonymous | Offline |
| -------------------------- | --------- | ------------- | ---------- | --------- | ------- |
| UC1: Purchase at Kiosk     | Passenger | ✅             | ❌          | Optional  | ❌       |
| UC2: Validator Door        | Passenger | ✅             | ✅          | ✅         | ✅       |
| UC3: Conductor Check       | Conductor | ✅             | ✅          | ✅         | ✅       |
| UC4: Clone Prevention      | Attacker  | ✅             | ✅          | N/A       | N/A     |
| UC5: Anonymous Purchase    | Passenger | ✅             | ✅          | ✅         | ❌       |
| UC6: Smartphone Purchase   | Passenger | ❌             | ✅          | Optional  | ❌       |
| UC7: Smartphone Validation | Passenger | ❌             | ✅          | ✅         | ✅       |
| UC8: Revocation            | Passenger | ✅             | ✅          | ✅         | Partial |
| UC9: Multi-Use             | Passenger | ✅             | ✅          | Mixed     | ✅       |
| UC10: Offline Validator    | System    | ✅             | ✅          | ✅         | ✅       |

---

## Key Questions Answered

### Q: Does architecture support anonymous purchases?
**A: YES** - Blind signatures work with physical cards:
- Buy prepaid card with cash (no identity)
- Card generates blinded token
- HSM signs without knowing original ticket ID
- Card unblinds → valid anonymous ticket

### Q: Are DESFire cards multi-use?
**A: YES** - DESFire EV3 specifications:
- Up to 28 applications per card
- Up to 32 files per application
- 2-8 KB total storage
- **Our system: ~14 tickets per 4KB card**
- Tickets can be added, expired tickets removed
- Multiple ticket types simultaneously (single, monthly, anonymous)

### Q: Does HSM work with physical cards?
**A: YES** - HSM signs ticket data:
- Ticket data written to card's secure element
- HSM signature written alongside data
- Validators verify signature offline
- HSM never sees card directly (signs data only)

---

## Implementation Status

| Component                  | Status                      |
| -------------------------- | --------------------------- |
| Physical card support      | ❌ Not started               |
| HSM integration            | ❌ Not started               |
| NFC reader integration     | ❌ Not started               |
| Validator door machine     | ❌ Not started               |
| Conductor handheld         | ❌ Not started               |
| Smartphone NFC (prototype) | ✅ Partially complete (V2.0) |
| Backend API                | ❌ Not started               |
| Database schema            | ✅ Designed                  |

---

## Next Steps

### Phase 1: HSM + Backend (2 weeks)
1. Setup AWS CloudHSM cluster
2. Implement ticket signing API
3. PostgreSQL database with ticket/validation tables
4. Revocation list API

### Phase 2: Physical Card (2 weeks)
1. Order Mifare DESFire EV3 cards (samples)
2. Test NFC reader (ACR122U)
3. Implement card write/read logic
4. Kiosk provisioning flow

### Phase 3: Validator Machine (2 weeks)
1. Raspberry Pi + NFC reader setup
2. Offline validation logic
3. LED indicators + door lock integration
4. Sync service

### Phase 4: Conductor Handheld (1 week)
1. Tablet app with NFC
2. Validation UI
3. Offline mode
4. Sync service

### Phase 5: Blind Signatures (1 week, optional)
1. Implement RSA blind/unblind
2. Anonymous prepaid card flow
3. Privacy-preserving purchase API

---

**Document Version**: 3.0  
**Last Updated**: November 22, 2025  
**For Architecture Details**: See [ARCHITECTURE_V3_SIMPLIFIED.md](./ARCHITECTURE_V3_SIMPLIFIED.md)  
**For Business Case**: See [PITCH_DECK.md](./PITCH_DECK.md)  
**Previous Version**: [USE_CASES.md](./USE_CASES.md) (V2.0 - Device-binding focused)
