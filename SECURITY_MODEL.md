# Security Model

## Overview

This system implements a privacy-preserving ticketing architecture using blind signatures, dual-UID cards, and offline validation to prevent travel pattern tracking while ensuring ticket authenticity.

## Core Security Principles

1. **Blind Signatures**: Backend cannot link payments to tickets
2. **Offline Validation**: Validators work without network (no real-time tracking)
3. **Dual-UID Architecture**: Separate public/private identifiers prevent cross-system tracking
4. **HSM Protection**: Private keys never leave Hardware Security Module

---

## Data Storage Model

### 1. Hardware Security Module (HSM)

**Stored:**
- RSA private key (2048-bit) - signs blinded tokens
- Never exported, never in memory

**Operations:**
- Sign blinded tokens (blind signature protocol)
- Cannot see original ticket_id or card_uid

**Access:**
- Only backend API can request signatures
- Rate limited (prevent DoS)
- Audit logged

### 2. Backend Database

**Stored:**
```
accounts:
  - account_id (UUID, private)
  - balance (CHF)
  - created_at
  - last_refill_at
  
validation_history:
  - ticket_id (SHA-256 hash)
  - timestamp
  - validator_id
  - location
  - fraud_score

fraud_log:
  - ticket_id
  - duplicate_count
  - flagged_at
```

**NOT Stored:**
- ❌ Card public UIDs (NFC-exposed)
- ❌ Original ticket_id (only hash)
- ❌ User identity (name, email)
- ❌ Routes or destinations
- ❌ Payment card numbers

### 3. NFC Card (Client)

**Stored on Secure Element:**
```
Card Structure:
├─ Public UID (NFC protocol level)
│  └─ Always exposed: "ABC123"
│
├─ Private Account ID (HSM protected)
│  └─ Requires auth: "550e8400-..."
│  └─ Used for: Backend refills only
│
├─ Card Auth Key (AES-256)
│  └─ Stored in secure element
│  └─ Used for: Challenge-response auth
│
└─ Application 0x5342 (SBB)
   ├─ Credits balance (encrypted)
   └─ Tickets (multiple):
       ├─ ticket_id (random, 256-bit)
       ├─ signature (RSA-2048, blind signed)
       ├─ route
       ├─ class
       ├─ valid_from
       └─ valid_until
```

**Security Features:**
- Secure Element (SE): Hardware-isolated storage
- APDU commands: Authenticated read/write
- Anti-tampering: Card detects physical attacks

### 4. Mobile App (Android/iOS)

**Stored in Keychain/Keystore:**
- Private account ID (encrypted)
- Card auth credentials
- Cached public key (for offline validation)

**Stored in App Storage:**
- Pending offline validations (queue)
- Local Bloom filter (duplicate detection)
- Validation history (last 100, temporary)

**NOT Stored:**
- ❌ Backend passwords
- ❌ HSM keys
- ❌ Other users' tickets

---

## HSM Usage Model

### When HSM is Used:

```
┌─────────────────────────────────────────────────┐
│              Ticket Purchase Flow                │
├─────────────────────────────────────────────────┤
│                                                  │
│ 1. User pays for credits                        │
│    Backend: account_id ← CHF 100                │
│    HSM: NOT involved                             │
│                                                  │
│ 2. User purchases ticket                         │
│    Client: Generate ticket_id (random)          │
│    Client: Blind ticket_id → blinded_token      │
│    Client → Backend: "Sign this blinded_token"  │
│    Backend → HSM: "Sign this blob"              │
│    HSM: Signs without seeing ticket_id ✅        │
│    HSM → Backend: blind_signature                │
│    Backend → Client: blind_signature             │
│    Client: Unblinds → ticket signature          │
│                                                  │
│ 3. Validation                                    │
│    Validator: Reads ticket from card            │
│    Validator: verify(ticket_id, signature, pubkey) │
│    HSM: NOT involved (uses cached public key)   │
│                                                  │
└─────────────────────────────────────────────────┘
```

**HSM Operations:**
- ✅ `sign_blinded(blinded_token)` → Returns blind signature
- ✅ `get_public_key()` → Returns RSA public key (for validators)
- ❌ Never sees: ticket_id, card_uid, routes, user identity

**Security Properties:**
- Blind signature: `HSM_sign(blind(ticket_id))` = `blind(HSM_sign(ticket_id))`
- HSM cannot link: Payment → Ticket → Validation
- Even HSM operator cannot track users

---

## Mobile App Security (Android)

### Threat Model

**Threats:**
1. Rooted devices (Magisk, SuperSU)
2. Debug tools (Frida, Xposed)
3. Emulators (BlueStacks, Android Studio)
4. Screenshot/screen recording
5. Memory dumps
6. App cloning (Parallel Space)

### Protection Mechanisms

#### 1. Root Detection

```java
// Multi-layer root detection
public class RootDetector {
    
    // Check for root management apps
    private static final String[] ROOT_PACKAGES = {
        "com.topjohnwu.magisk",
        "eu.chainfire.supersu",
        "com.koushikdutta.superuser"
    };
    
    // Check for su binary
    private static final String[] SU_PATHS = {
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su"
    };
    
    // Check for modified system props
    boolean isRooted() {
        return checkRootPackages() ||
               checkSuBinary() ||
               checkBuildTags() ||
               checkRWSystem();
    }
}

// Response to root detection:
if (RootDetector.isRooted()) {
    // Option 1: Hard block (like banking apps)
    showError("Rooted devices not supported");
    System.exit(0);
    
    // Option 2: Degraded mode (like Google Wallet)
    disableNFCFeatures();
    requireOnlineValidation();
}
```

#### 2. Secure Element Access

```java
// Use Android Keystore with StrongBox
KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
        "sbb_card_key",
        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setUserAuthenticationRequired(true)  // Biometric required
    .setInvalidatedByBiometricEnrollment(true)
    .setIsStrongBoxBacked(true)  // Hardware-backed if available
    .build();
```

**StrongBox (Hardware Security):**
- Isolated processor (Titan M on Pixel)
- Keys never enter main CPU
- Tamper-resistant
- Side-channel attack protection

#### 3. Certificate Pinning

```java
// Prevent MITM attacks
CertificatePinner certificatePinner = new CertificatePinner.Builder()
    .add("api.sbb.ch", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .add("api.sbb.ch", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
    .build();

OkHttpClient client = new OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build();
```

#### 4. Code Obfuscation

```gradle
// build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                         'proguard-rules.pro'
        }
    }
}
```

**ProGuard Rules:**
```
# Obfuscate crypto operations
-keep class com.sbb.crypto.** { *; }
-keepclassmembers class com.sbb.crypto.** {
    native <methods>;
}

# Hide API endpoints
-keepclassmembers class com.sbb.api.ApiConfig {
    !private !public <methods>;
}
```

#### 5. Anti-Tampering

```java
// Verify app signature at runtime
public class IntegrityCheck {
    
    boolean verifyAppSignature(Context context) {
        try {
            PackageInfo info = context.getPackageManager()
                .getPackageInfo(context.getPackageName(), 
                               PackageManager.GET_SIGNATURES);
            
            Signature[] signatures = info.signatures;
            byte[] cert = signatures[0].toByteArray();
            
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(cert);
            
            String expectedHash = "EXPECTED_HASH_FROM_BUILD";
            return Arrays.equals(hash, expectedHash.getBytes());
            
        } catch (Exception e) {
            return false; // Assume tampered
        }
    }
    
    // Check for Xposed/Frida
    boolean isHooked() {
        try {
            throw new Exception();
        } catch (Exception e) {
            for (StackTraceElement element : e.getStackTrace()) {
                if (element.getClassName().contains("de.robv.android.xposed") ||
                    element.getClassName().contains("com.android.internal.os.ZygoteInit")) {
                    return true;
                }
            }
        }
        return false;
    }
}
```

#### 6. Screen Protection

```java
// Prevent screenshots in sensitive screens
@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // Block screenshots
    getWindow().setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
    );
    
    // Detect screen recording
    if (isScreenRecording()) {
        finish();
    }
}
```

#### 7. Memory Protection

```java
// Clear sensitive data from memory
public class SecureString implements AutoCloseable {
    private char[] data;
    
    public SecureString(String value) {
        this.data = value.toCharArray();
    }
    
    @Override
    public void close() {
        // Overwrite memory
        if (data != null) {
            Arrays.fill(data, '\0');
            data = null;
        }
    }
}

// Usage
try (SecureString accountId = new SecureString(getAccountId())) {
    // Use accountId
} // Automatically cleared from memory
```

### Google Wallet-Style Protection

**Similar to Google Wallet:**

1. **Device Attestation** (SafetyNet/Play Integrity API)
```java
SafetyNet.getClient(this).attest(nonce, API_KEY)
    .addOnSuccessListener(response -> {
        if (!response.isBasicIntegrity()) {
            // Device compromised
            disableNFCPayments();
        }
    });
```

2. **NFC-HCE with Secure Element**
```xml
<!-- AndroidManifest.xml -->
<service android:name=".TicketHostApduService"
         android:exported="true"
         android:permission="android.permission.BIND_NFC_SERVICE">
    <intent-filter>
        <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE"/>
    </intent-filter>
    <meta-data android:name="android.nfc.cardemulation.host_apdu_service"
               android:resource="@xml/apduservice"/>
</service>
```

3. **Cloud-Backed Ticket Storage**
- Tickets stored in cloud (encrypted)
- Device only caches temporarily
- Lost device → revoke all tickets remotely

4. **Biometric Authentication**
```java
BiometricPrompt.PromptInfo promptInfo = 
    new BiometricPrompt.PromptInfo.Builder()
        .setTitle("Authenticate to use ticket")
        .setSubtitle("Use fingerprint or face")
        .setNegativeButtonText("Cancel")
        .build();

biometricPrompt.authenticate(promptInfo);
```

---

## Attack Vectors & Mitigations

### 1. Ticket Forgery

**Attack:** Create fake ticket with fake signature

**Mitigation:**
- ✅ HSM private key never exported
- ✅ RSA-2048 signature cannot be forged
- ✅ Validators verify signature with cached public key
- ✅ Invalid signature → Immediate rejection

### 2. Ticket Cloning

**Attack:** Copy ticket from one card to another

**Mitigation:**
- ⚠️ Tickets are not bound to card UID (by design, for privacy)
- ✅ Duplicate detection: ticket_id tracked in backend
- ✅ First validation accepted, second rejected
- ✅ Fraud logged for review

**Note:** Some cloning is acceptable (e.g., backup card), but excessive use is flagged.

### 3. Replay Attacks

**Attack:** Reuse already-validated ticket

**Mitigation:**
- ✅ Backend tracks: ticket_id → validation timestamp
- ✅ Single tickets: Only one validation allowed
- ✅ Day passes: Rate limiting (max 20 validations/24h)
- ✅ Offline validators: Bloom filter for duplicate detection

### 4. Card UID Tracking

**Attack:** Passive NFC readers track card movements

**Mitigation:**
- ⚠️ Public UID always exposed (NFC protocol limitation)
- ✅ Backend never sees public UID (uses private account_id)
- ✅ Validators don't log public UID (only ticket_id)
- ✅ Cannot link: Physical card → Backend records

### 5. Man-in-the-Middle (MITM)

**Attack:** Intercept API calls to backend

**Mitigation:**
- ✅ TLS 1.3 with certificate pinning
- ✅ Blind signatures: Even intercepted data is useless
- ✅ No sensitive data in API calls (blind tokens only)

### 6. Rooted Device Attacks

**Attack:** Root access to dump keys/tickets

**Mitigation:**
- ✅ Root detection → Disable NFC features
- ✅ StrongBox (if available) → Keys in hardware
- ✅ No critical secrets in app memory
- ✅ Runtime integrity checks

### 7. Backend Database Compromise

**Attack:** Attacker gains access to backend DB

**What Attacker Gets:**
- ✅ Can see: account_id balances, validation history
- ❌ Cannot see: User identities, card UIDs, payment info
- ❌ Cannot forge tickets: Private key in HSM (isolated)
- ❌ Cannot link: Accounts → Physical cards → Travel patterns

**Mitigation:**
- ✅ HSM isolated from database
- ✅ Database encryption at rest
- ✅ Minimal data retention (GDPR)

---

## Privacy Guarantees

### What Backend Cannot Track:

1. **Physical Card Movements**
   - Backend never sees NFC public UID
   - Cannot correlate: Card ABC123 → Backend account xyz789

2. **Payment → Ticket Linkage**
   - Blind signatures prevent linking
   - Backend signs blinded tokens without seeing ticket_id

3. **Travel Patterns Across Tickets**
   - Each ticket has unique random ticket_id
   - No common identifier links tickets on same card

4. **User Identity**
   - No registration required
   - No email, phone, or name stored
   - Anonymous credits can be bought with cash at kiosks

### What Backend CAN Track:

1. **Per-Ticket Validation History**
   - ticket_id XYZ789 validated at Platform A at 14:00
   - ticket_id XYZ789 validated again at 15:00 (fraud detected)

2. **Aggregate Statistics**
   - Route popularity (e.g., ZH-BE route: 10,000 tickets/day)
   - Peak hours (e.g., 8am-9am busiest)
   - **But:** Cannot link to individuals

3. **Fraud Detection**
   - Duplicate ticket usage patterns
   - Excessive day pass validations
   - **But:** Only per-ticket, not per-user

---

## Compliance

### GDPR (EU Data Protection)

**Compliance:**
- ✅ Minimal data collection (ticket_id only)
- ✅ Pseudonymization (account_id not linkable to identity)
- ✅ Right to erasure (delete account → delete all tickets)
- ✅ Data portability (export validation history)
- ✅ No profiling (cannot build user profiles)

### PCI DSS (Payment Card Industry)

**Compliance:**
- ✅ Payment handled by certified processor
- ✅ No credit card data stored on app/card
- ✅ Backend never sees payment details
- ✅ Generic credits (payment unlinkable from tickets)

### SOC 2 (Security Controls)

**Compliance:**
- ✅ HSM for key management
- ✅ Audit logging (validation attempts)
- ✅ Access controls (HSM, database)
- ✅ Incident response (fraud detection)

---

## Summary Table

| Component | Data Stored | Security | Privacy |
|-----------|-------------|----------|---------|
| **HSM** | RSA private key | Hardware isolated, never exported | Signs blindly (can't track) |
| **Backend DB** | account_id, validation history | Encrypted at rest, access logs | No card UIDs, no user PII |
| **NFC Card** | Public UID, private account_id, tickets | Secure element, tamper resistant | Public UID exposed (NFC protocol) |
| **Mobile App** | Cached tickets, private account_id | Keystore/StrongBox, root detection | Local only, no cloud sync |
| **Validators** | None (stateless) | Cached public key, offline capable | Don't log card UIDs |

**Security Motto:** "Trust the math (blind signatures), not the infrastructure."

**Privacy Motto:** "Backend sees tickets, not people."
