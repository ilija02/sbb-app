# Use Cases: Anonymous Ticketing System

## 🔒 Privacy Architecture: Dual-UID System

### Problem: NFC Card UID Exposure
**NFC cards have a public UID that is ALWAYS exposed to any reader (by protocol design).**

This creates privacy risks:
- **Passive Tracking**: Malicious readers can track card movements without authorization
- **Cross-System Linkage**: Same public UID used across payment, transport, building access
- **Backend Profiling**: If backend sees public UID, can build travel/spending patterns

### Solution: Separate Public & Private Identifiers

```
┌─────────────────────────────────────────────────────────┐
│                    NFC Card Structure                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📶 Public UID (NFC Protocol Level)                      │
│     - Always exposed to any reader                        │
│     - Used for: Anti-collision, card selection           │
│     - Cannot be hidden (RF protocol requirement)         │
│     - Example: ABC123                                     │
│                                                           │
│  🔐 Private Account ID (HSM Protected)                   │
│     - Requires: Mutual authentication                     │
│     - Used for: Backend refills, balance lookups         │
│     - Never transmitted without auth                      │
│     - Example: xyz789-secret                              │
│                                                           │
│  🎫 Tickets (Blind Signed)                               │
│     - ticket_id: Unlinkable to purchases                 │
│     - signature: Verifiable but anonymous                │
│     - Validators see: ticket_id ONLY                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Authentication Flow

```javascript
// KIOSK: Authorized for private account access
const auth = await authenticateCard(publicUid, 'kiosk')
if (auth.success) {
  // Step 1: Mutual challenge-response
  // Step 2: Card verifies kiosk is authorized
  // Step 3: Card releases private account ID
  
  // Now can access backend with private ID
  await addCreditsToAccount(auth.privateAccountId, amount)
  // Backend logs: xyz789 added 20 CHF
  // Backend NEVER sees: ABC123 (public UID)
}

// VALIDATOR: NOT authorized for private account access
const auth = await authenticateCard(publicUid, 'validator')
// Returns: { success: false, error: 'Not authorized' }
// Validators only see ticket_id, never account info
```

### What Backend Sees

| Operation | Backend Receives | Backend NEVER Sees |
|-----------|------------------|-------------------|
| **Credit Refill** | `account_id: xyz789`<br>`amount: 20 CHF` | ❌ Public UID: ABC123<br>❌ Physical card movements |
| **Ticket Purchase** | `blinded_token: blind(ticket_id)` | ❌ Original ticket_id<br>❌ Route/destination<br>❌ Account ID |
| **Validation** | `ticket_id: TKT123` | ❌ Public UID: ABC123<br>❌ Private account ID: xyz789 |

### Privacy Benefits

#### ❌ **Without Dual-UID (Privacy Broken)**
```
Passive reader at Zurich HB → Sees: ABC123 at 08:00
Backend refill log → Card ABC123 added 20 CHF at 08:15
Store payment terminal → Card ABC123 bought coffee at 08:30
Train validator → Card ABC123 validated ticket at 09:00
Passive reader at Bern → Sees: ABC123 at 10:00

TRACKING POSSIBLE:
- Card ABC123 travels Zurich → Bern daily
- Refills every Monday morning
- Commuter pattern established
```

#### ✅ **With Dual-UID (Privacy Preserved)**
```
Passive reader at Zurich HB → Sees: ABC123 at 08:00
Backend refill log → Account xyz789 added 20 CHF (can't link to ABC123)
Store payment terminal → Card ABC123 (different system, no backend link)
Train validator → Validates ticket TKT123 (blind signed, can't link to xyz789 or ABC123)
Passive reader at Bern → Sees: ABC123 at 10:00

TRACKING BLOCKED:
- Passive readers see ABC123, but backend doesn't
- Backend sees xyz789 refills, but not which physical card
- Backend sees TKT123 validations, but not which card/account
- No system can link: Physical card → Account → Tickets
```

### Implementation Status

**✅ Completed:**
- Dual-UID card structure (`publicUid` + `privateAccountId`)
- Challenge-response authentication (`authenticateCard()`)
- Kiosk authorization (can access private ID)
- Validator authorization (denied private ID access)
- Backend API uses `account_id`, never `card_uid`
- Privacy logging in console (shows what backend receives)

**🔒 Privacy Guarantees:**
1. Backend NEVER sees public NFC UID
2. Validators NEVER see private account ID
3. Passive readers CANNOT link to backend data
4. Refill transactions unlinkable from physical card movements


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

### Physical Flow (Detailed)

**Step 1: Buy Credits at Kiosk**
```
User Action:     Place card on kiosk reader (marked "📱 TAP HERE")
Hold Duration:   1-2 seconds until beep
Kiosk Reads:     Card UID, current balance
User Selects:    Amount (e.g., CHF 100)
User Pays:       Cash (inserted into slot)
Backend Logs:    "Cash payment: CHF 100" (no card UID, no name)
Kiosk Writes:    Credits to card's secure storage
User Action:     Remove card when "✅ Done" appears
```

**Step 2: Buy Ticket at Kiosk**
```
User Action:     Place same card on reader again
Hold Duration:   1-2 seconds until beep
Kiosk Reads:     Current balance (CHF 100)
User Selects:    Route (Zurich → Bern, CHF 55)
Card Generates:  Random ticket_id, blinds it
Backend Signs:   Blinded token (never sees ticket_id or card UID)
Card Unblinds:   Signature
Kiosk Writes:    Ticket + signature to card
Kiosk Updates:   Balance to CHF 45
User Action:     Remove card when done
```

**Step 3: Validate at Platform**
```
User Action:     Tap card on platform validator (yellow post)
Hold Duration:   < 1 second (brief tap)
Validator Reads: Ticket + signature from card
Validator Checks: Signature valid? Expired? Revoked?
Validator Logs:  ticket_id to bloom filter (local only)
Validator Shows: GREEN LED + beep ✅
User Action:     Proceed to train (no gate/barrier)
```

**Step 4: Random Conductor Check**
```
Conductor:       "Ticket, please"
User Action:     Hand card or tap on conductor's handheld
Hold Duration:   1-2 seconds
Handheld Reads:  Ticket + signature from card
Handheld Checks: Signature valid? Was it validated? Used elsewhere today?
Bloom Filter:    Check if ticket_id seen on another train → FRAUD
Result:          Valid → OK | Invalid → CHF 100 fine
```

### Flow Summary
1. User buys card at kiosk, pays cash CHF 100 → generic credits
2. User selects route at kiosk → kiosk generates `ticket_id`, blinds it
3. Backend signs blinded token
4. Kiosk unblinds signature, writes to card (Mifare DESFire EV3)
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
