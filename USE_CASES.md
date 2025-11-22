# Use Cases: Anonymous Ticketing System

## Use Case 1: Mobile App Purchase (Smartphone NFC)

### Flow
1. User opens app, selects "Buy Credits" → pays CHF 100 via credit card
2. Credits stored on device (secure element/TEE)
3. User selects route (Zurich → Bern, CHF 55)
4. App generates random `ticket_id`, blinds it
5. Backend signs blinded token (never sees original `ticket_id`)
6. App unblinds signature, writes ticket to secure element
7. User voluntarily taps phone at platform validator → offline signature check → green light
8. Conductor checks during ride → taps phone → verifies signature → or issues fine

### Why Non-Trackable?

**Payment Unlinking:**
- Backend records: `"Credit card 4567 bought 100 CHF credits"`
- Backend signs: `"blinded_xyz"` (cannot see route or ticket_id)
- Validator logs: `Nothing` (offline validation, no reporting)
- **Result:** Backend cannot link credit card → route → travel time

**Technical Claims:**
1. **Blind Signatures**: HSM signs `blind(ticket_id)` without seeing `ticket_id`
   - Math: `sig(blind(m)) / r = sig(m)` where `r` is random blinding factor
   - Backend gets: `blind(ticket_id)` ✓ Signed: `sig(blind(ticket_id))`
   - Phone unblinds: `sig(ticket_id)` ← Backend never saw this!

2. **Offline Validation**: Validators check signature with cached HSM public key
   - No network calls during validation
   - No logs sent to backend
   - Validator only verifies: `verify(sig(ticket_id), ticket_id, HSM_pubkey) == true`

3. **Generic Credits**: Payment is for "credits", not specific routes
   - Backend sees: Payment → Generic CHF balance
   - Backend never sees: Which routes credits were used for

### No PII Required

**At Purchase:**
- Payment: Credit card (for payment processor, not SBB backend)
- App: Generates random `ticket_id` on device
- Backend: Only sees blinded token (no name, no card ID, no device ID)

**At Validation:**
- Validator reads: `ticket_id + signature + expiry + route`
- Validator verifies: Signature is valid (HSM signed it)
- No identity check needed (signature proves legitimacy)

**Why This Works:**
- Signature = Proof of payment (only HSM can create valid signatures)
- No need to know WHO paid (signature proves SOMEONE paid)
- Like cash: You don't need ID to use a cash-purchased ticket

### Anti-Sharing / Anti-Copying

**Mobile Device Binding:**
1. **Secure Element Storage**:
   - Ticket stored in TEE (Trusted Execution Environment) or SE (Secure Element)
   - OS-level protection prevents copying (like credit cards in Apple Pay)
   - Extract protection: Can't dump SE contents

2. **Device Attestation** (Optional Enhancement):
   - Device generates keypair in SE, sends public key during ticket generation
   - Backend signs: `sig(ticket_id + device_pubkey)`
   - Validation requires: Proof of device_privkey possession (SE-backed signature)
   - **Result:** Ticket bound to specific device hardware

3. **Single-Use Enforcement**:
   - Validators cache validated `ticket_id` in local bloom filter (24h TTL)
   - Conductors check bloom filter during inspection
   - If same `ticket_id` used on multiple trains → FRAUD DETECTED → Fine
   - Bloom filters synced between validators/conductors offline (peer-to-peer)
   - **Incentive:** CHF 100+ fine if caught without validated ticket
   - **Result:** Honor system + random checks + heavy fines = compliance

**Technical Implementation:**
```javascript
// During ticket generation (on phone)
const deviceKeypair = await SE.generateKey() // Hardware-backed
const ticket = {
  ticket_id: random(),
  route: "ZH-BE",
  device_pubkey: deviceKeypair.public,
  ...
}
const signature = unblind(backend.sign(blind(ticket)))

// During validation
validator.verify(ticket.signature, ticket.ticket_id) // HSM signature valid?
validator.requireProof(ticket.device_pubkey) // Phone must sign challenge with device_privkey
validator.checkBloomFilter(ticket.ticket_id) // Already used today?
```

**Why Sharing Fails:**
- **Copy to another phone**: Missing device_privkey (locked in SE of original device)
- **Screenshot/photo**: No SE access, can't prove device_privkey possession
- **Simultaneous use**: Conductor spot check detects duplicate `ticket_id` → CHF 100 fine
- **Risk/reward**: Fine (CHF 100) > Ticket cost (CHF 55) = Not worth sharing

---

## Use Case 2: Physical NFC Card Purchase

### Flow
1. User buys card at kiosk, pays cash CHF 100 → generic credits
2. User selects route at kiosk → kiosk generates `ticket_id`, blinds it
3. Backend signs blinded token
4. Kiosk unblinds signature, writes to card (Mifare DeSFire EV3)
5. User voluntarily taps card at platform validator → offline check → green light
6. Conductor checks during ride → taps card → verifies signature → or issues CHF 100 fine

### Why Non-Trackable?

**Payment Unlinking:**
- Kiosk records: `"Cash payment 100 CHF"` (no card serial number logged)
- Backend signs: `blinded_xyz` (cannot unblind or see ticket_id)
- Validator: Offline signature check (no reporting)
- **Result:** Cash payment → anonymous credits → anonymous ticket

**Even Better Than Mobile:**
- No device registration
- No account needed
- No app installation
- Pure cash transaction = maximum anonymity

### No PII Required

**At Purchase:**
- Payment: Cash (completely anonymous)
- Card: Blank NFC card (no serial number stored in backend)
- Backend: Only sees blinded tokens (unlinkable to card)

**At Validation:**
- Card UID read locally (not sent to backend)
- Signature verified offline
- No identity check

### Anti-Sharing / Anti-Copying

**Physical Card Binding:**
1. **Card UID Binding**:
   - Ticket includes hash of card UID: `sig(ticket_id + hash(card_UID))`
   - Validation checks: `card_UID` matches ticket's bound UID hash
   - **Result:** Ticket only valid on original card

2. **Secure NFC Storage**:
   - Mifare DESFire EV3 has encrypted storage
   - Application-level keys required for read/write
   - Cannot clone card without breaking encryption (AES-128)

3. **Single-Use Enforcement**:
   - Same bloom filter approach as mobile
   - Platform validators log validated `ticket_id`
   - Conductors detect duplicate use across trains → CHF 100+ fine
   - Honor system with spot checks (like current Swiss system)

**Technical Implementation:**
```javascript
// Kiosk writes ticket with card binding
const ticket = {
  ticket_id: random(),
  route: "ZH-BE",
  card_uid_hash: sha256(card.UID), // Bind to this card
  ...
}
const signature = unblind(backend.sign(blind(ticket)))
card.write(ticket, signature)

// Validator checks binding
const card_uid = validator.readUID()
if (sha256(card_uid) !== ticket.card_uid_hash) {
  REJECT("Ticket not valid on this card")
}
validator.verify(signature, ticket) // HSM signature valid?
validator.checkBloomFilter(ticket.ticket_id) // Already used?
```

**Why Sharing Fails:**
- **Clone card**: DESFire encryption prevents cloning (AES-128 protected)
- **Copy to another card**: `card_uid_hash` won't match (ticket bound to original UID)
- **Simultaneous use**: Conductor detects duplicate `ticket_id` → CHF 100+ fine
- **NFC relay attack**: Distance-bounding protocol (ISO 14443-4) prevents relay
- **Economic deterrent**: Fine cost > ticket cost = compliance via self-interest

---

## Security Summary

### Privacy Guarantees
| Property                         | Mobile             | Physical Card      |
| -------------------------------- | ------------------ | ------------------ |
| Payment unlinkable from route    | ✅ Blind signatures | ✅ Blind signatures |
| Offline validation (no tracking) | ✅ Cached HSM key   | ✅ Cached HSM key   |
| No PII required                  | ✅ Anonymous app    | ✅ Cash purchase    |
| Backend cannot see travel        | ✅ No logs          | ✅ No logs          |

### Anti-Fraud Guarantees
| Property            | Mobile                            | Physical Card               |
| ------------------- | --------------------------------- | --------------------------- |
| Cannot share ticket | ✅ SE binding + device attestation | ✅ Card UID binding          |
| Cannot clone        | ✅ SE extract protection           | ✅ DESFire encryption        |
| Cannot reuse        | ✅ Bloom filter                    | ✅ Bloom filter              |
| Cannot forge        | ✅ HSM signatures (RSA-2048)       | ✅ HSM signatures (RSA-2048) |

### Cryptographic Primitives
- **Blind Signatures**: RSA blind signatures (Chaum 1983)
- **Signature Scheme**: RSA-PSS with SHA-256
- **Card Encryption**: AES-128 (Mifare DESFire EV3)
- **Device Binding**: ECDSA P-256 (Secure Element)
- **Bloom Filters**: 1M entries, 0.1% false positive rate

---

## Comparison with Traditional Systems

| Feature          | Traditional                               | This System                        |
| ---------------- | ----------------------------------------- | ---------------------------------- |
| **Privacy**      | Backend tracks all trips                  | Backend sees only credit purchases |
| **PII**          | Name, phone, email required               | No PII needed                      |
| **Validation**   | Online check (network needed)             | Offline (cached public key)        |
| **Sharing**      | Account-based (hard to prevent)           | Device/card-bound (cryptographic)  |
| **Anonymity**    | Named accounts                            | Anonymous credits                  |
| **Payment Link** | Card → ticket → validation → trip profile | Card → credits (unlinked)          |

**Key Insight**: Traditional systems assume identity is needed for fraud prevention. This system proves cryptographic signatures can replace identity checks while providing stronger privacy.
