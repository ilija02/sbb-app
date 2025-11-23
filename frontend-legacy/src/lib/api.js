/**
 * API client for backend communication
 *
 * MOCK IMPLEMENTATION - Returns mock data for POC
 * In production, replace with actual fetch calls to backend
 */

const API_BASE = "/api/v1";
const MOCK_MODE = true; // Set to false when backend is ready

// Track network status
let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; syncPendingValidations(); });
window.addEventListener('offline', () => { isOnline = false; });

/**
 * Get issuer's public key
 * @returns {object} Public key
 */
export async function getPublicKey() {
  if (MOCK_MODE) {
    await delay(300);
    return {
      n: "mock_modulus_12345...",
      e: 65537,
    };
  }

  const response = await fetch(`${API_BASE}/keys/public`);
  if (!response.ok) throw new Error("Failed to fetch public key");
  return await response.json();
}

/**
 * Send blinded token to be signed (after payment)
 * @param {string} blindedToken - Blinded token
 * @param {string} paymentProof - Payment verification token
 * @returns {string} Signed blinded token
 */
export async function signBlindedToken(blindedToken, paymentProof) {
  if (MOCK_MODE) {
    await delay(800);
    // Simulate payment verification and signing
    return "signed_" + blindedToken;
  }

  const response = await fetch(`${API_BASE}/sign_blinded`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blinded_token: blindedToken,
      payment_proof: paymentProof,
    }),
  });

  if (!response.ok) throw new Error("Failed to sign token");
  const data = await response.json();
  return data.signed_blinded_token;
}

/**
 * Redeem a token (validator checks it online)
 * @param {string} tokenHash - Hash of the token
 * @param {string} signature - Signature
 * @param {object} metadata - Additional metadata
 * @returns {object} Redemption result
 */
export async function redeemToken(tokenHash, signature, metadata = {}) {
  if (MOCK_MODE) {
    await delay(500);

    // Simulate random validation
    const isValid = Math.random() > 0.1; // 90% success rate

    if (isValid) {
      return {
        valid: true,
        message: "Token accepted",
        redeemed_at: new Date().toISOString(),
      };
    } else {
      return {
        valid: false,
        message: "Token already spent or invalid",
        error: "ALREADY_SPENT",
      };
    }
  }

  const response = await fetch(`${API_BASE}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token_hash: tokenHash,
      signature,
      ...metadata,
    }),
  });

  if (!response.ok) throw new Error("Failed to redeem token");
  return await response.json();
}

/**
 * Download Bloom filter for offline validation
 * @param {string} date - Date for filter (YYYY-MM-DD)
 * @returns {Uint8Array} Bloom filter binary data
 */
export async function downloadBloomFilter(date) {
  if (MOCK_MODE) {
    await delay(1000);
    // Return a mock 1KB Bloom filter
    return new Uint8Array(1024).fill(0);
  }

  const response = await fetch(`${API_BASE}/bloom?date=${date}`);
  if (!response.ok) throw new Error("Failed to download Bloom filter");

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Sync offline scans to backend
 * @param {Array} scans - Array of offline scan records
 * @returns {object} Sync result
 */
export async function syncOfflineScans(scans) {
  if (MOCK_MODE) {
    await delay(1500);
    return {
      synced: scans.length,
      conflicts: 0,
      errors: 0,
    };
  }

  const response = await fetch(`${API_BASE}/sync_offline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scans }),
  });

  if (!response.ok) throw new Error("Failed to sync offline scans");
  return await response.json();
}

/**
 * Create a prepaid voucher (for cashless compliance)
 * @param {number} amount - Voucher amount in CHF cents
 * @param {string} paymentMethod - Payment method
 * @returns {object} Voucher data
 */
export async function createVoucher(amount, paymentMethod = "cash") {
  if (MOCK_MODE) {
    await delay(600);
    const code = generateVoucherCode();
    return {
      voucher_code: code,
      amount,
      balance: amount,
      created_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  }

  const response = await fetch(`${API_BASE}/vouchers/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, payment_method: paymentMethod }),
  });

  if (!response.ok) throw new Error("Failed to create voucher");
  return await response.json();
}

/**
 * Redeem a voucher to get a token
 * @param {string} voucherCode - Voucher code
 * @param {string} blindedToken - Blinded token to be signed
 * @returns {object} Redemption result with signed token
 */
export async function redeemVoucher(voucherCode, blindedToken) {
  if (MOCK_MODE) {
    await delay(700);
    return {
      success: true,
      signed_blinded_token: "signed_" + blindedToken,
      remaining_balance: 0,
      message: "Voucher redeemed successfully",
    };
  }

  const response = await fetch(`${API_BASE}/vouchers/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voucher_code: voucherCode,
      blinded_token: blindedToken,
    }),
  });

  if (!response.ok) throw new Error("Failed to redeem voucher");
  return await response.json();
}

/**
 * Check voucher balance
 * @param {string} voucherCode - Voucher code
 * @returns {object} Voucher info
 */
export async function checkVoucherBalance(voucherCode) {
  if (MOCK_MODE) {
    await delay(400);
    return {
      voucher_code: voucherCode,
      balance: 2000, // 20.00 CHF
      original_amount: 5000,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(
        Date.now() + 358 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  }

  const response = await fetch(
    `${API_BASE}/vouchers/balance?code=${voucherCode}`
  );
  if (!response.ok) throw new Error("Failed to check voucher balance");
  return await response.json();
}

// ===== UTILITY FUNCTIONS =====

/**
 * Delay helper for mock responses
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a mock voucher code
 */
function generateVoucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ===== ONLINE VALIDATION FUNCTIONS =====

/**
 * Validate ticket online (check for fraud, duplicates)
 * @param {object} ticket - Ticket data
 * @param {string} validatorId - Validator device ID
 * @param {string} location - Validator location
 * @param {string} validatorType - Type: 'platform' (pre-boarding) or 'conductor' (on-train check)
 * @returns {Promise<object>} Validation result
 */
export async function validateTicketOnline(ticket, validatorId, location, validatorType = 'platform') {
  if (MOCK_MODE) {
    await delay(400);
    
    // Conductor checks don't affect duplicate detection
    if (validatorType === 'conductor') {
      return {
        valid: true,
        message: 'Conductor check - ticket inspection only',
        validator_type: 'conductor'
      };
    }

    // Check localStorage for duplicate validations (simulate backend DB)
    // Only check PLATFORM validations (not conductor checks)
    const validationHistory = getValidationHistory();
    
    console.log('[VALIDATION] Checking ticket:', {
      ticket_id: ticket.ticket_id.substring(0, 20) + '...',
      ticket_type: ticket.ticket_type,
      route: ticket.route,
      validator_type: validatorType
    });
    
    console.log('[VALIDATION] History for this ticket:', {
      matching_validations: validationHistory.filter(v => v.ticket_id === ticket.ticket_id),
      total_history_count: validationHistory.length
    });
    
    const recentValidation = validationHistory.find(
      v => v.ticket_id === ticket.ticket_id && 
      v.validator_type === 'platform' && // Only check platform validations
      Date.now() - v.timestamp < 5 * 60 * 1000 // 5 minutes
    );

    if (recentValidation && ticket.ticket_type === 'single') {
      // Single journey already validated recently at platform
      return {
        valid: false,
        reason: 'duplicate_use',
        message: 'Ticket already validated at platform recently',
        last_validated: recentValidation.timestamp,
        location: recentValidation.location,
        fraud_score: 0.95
      };
    }

    // Check for day pass rate limiting (only for platform validators)
    if (ticket.ticket_type === 'day') {
      const dayPassValidations = validationHistory.filter(
        v => v.ticket_id === ticket.ticket_id &&
        v.validator_type === 'platform' && // Only count platform validations
        Date.now() - v.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
      );

      // Allow day pass, but flag if excessive
      if (dayPassValidations.length > 20) {
        return {
          valid: true,
          warning: 'excessive_validations',
          message: 'Day pass validated many times - flagged for review',
          validation_count: dayPassValidations.length,
          fraud_score: 0.7
        };
      }
    }

    return {
      valid: true,
      message: 'Ticket valid',
      validation_count: validationHistory.filter(
        v => v.ticket_id === ticket.ticket_id && v.validator_type === 'platform'
      ).length + 1,
      validator_type: validatorType
    };
  }

  // Production: Call backend API
  const response = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket,
      validator_id: validatorId,
      validator_type: validatorType,
      location,
      timestamp: Date.now()
    })
  });

  if (!response.ok) throw new Error('Validation API failed');
  return await response.json();
}

/**
 * Queue validation for offline processing
 * @param {object} ticket - Ticket data
 * @param {string} validatorId - Validator device ID
 * @param {string} location - Validator location
 * @param {string} result - Local validation result
 */
export function queueOfflineValidation(ticket, validatorId, location, result) {
  const pendingValidations = JSON.parse(localStorage.getItem('pending_validations') || '[]');
  
  pendingValidations.push({
    ticket_id: ticket.ticket_id,
    ticket_type: ticket.ticket_type,
    route: ticket.route,
    validator_id: validatorId,
    location,
    timestamp: Date.now(),
    local_result: result,
    synced: false
  });

  localStorage.setItem('pending_validations', JSON.stringify(pendingValidations));
  console.log(`[OFFLINE] Queued validation for ticket ${ticket.ticket_id}`);
}

/**
 * Sync pending validations when network becomes available
 */
export async function syncPendingValidations() {
  if (!isOnline) return;

  const pendingValidations = JSON.parse(localStorage.getItem('pending_validations') || '[]');
  const unsyncedValidations = pendingValidations.filter(v => !v.synced);

  if (unsyncedValidations.length === 0) return;

  console.log(`[SYNC] Syncing ${unsyncedValidations.length} pending validations...`);

  if (MOCK_MODE) {
    await delay(1000);
    
    // Simulate fraud detection
    const fraudulentTickets = [];
    for (const validation of unsyncedValidations) {
      // Check if this ticket was validated multiple times offline
      const duplicates = unsyncedValidations.filter(
        v => v.ticket_id === validation.ticket_id &&
        v.ticket_type === 'single'
      );

      if (duplicates.length > 1) {
        fraudulentTickets.push({
          ticket_id: validation.ticket_id,
          validator_id: validation.validator_id,
          location: validation.location,
          timestamp: validation.timestamp,
          fraud_type: 'offline_duplicate',
          message: 'Single ticket validated multiple times while offline'
        });
      }
    }

    // Mark all as synced
    pendingValidations.forEach(v => { v.synced = true; });
    localStorage.setItem('pending_validations', JSON.stringify(pendingValidations));

    // Log fraud detections
    if (fraudulentTickets.length > 0) {
      const fraudLog = JSON.parse(localStorage.getItem('fraud_log') || '[]');
      fraudLog.push(...fraudulentTickets);
      localStorage.setItem('fraud_log', JSON.stringify(fraudLog));
      console.warn(`[FRAUD] Detected ${fraudulentTickets.length} fraudulent validations`);
    }

    console.log(`[SYNC] Complete. ${fraudulentTickets.length} fraud cases logged.`);
    return { synced: unsyncedValidations.length, fraud_detected: fraudulentTickets.length };
  }

  // Production: Batch sync to backend
  try {
    const response = await fetch(`${API_BASE}/validations/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validations: unsyncedValidations })
    });

    if (response.ok) {
      const result = await response.json();
      pendingValidations.forEach(v => { v.synced = true; });
      localStorage.setItem('pending_validations', JSON.stringify(pendingValidations));
      return result;
    }
  } catch (error) {
    console.error('[SYNC] Failed:', error);
  }
}

/**
 * Get validation history (for mock duplicate checking)
 */
function getValidationHistory() {
  const history = JSON.parse(localStorage.getItem('validation_history') || '[]');
  return history;
}

/**
 * Record validation to history
 */
export function recordValidation(ticket, validatorId, location, validatorType = 'platform') {
  const history = getValidationHistory();
  history.push({
    ticket_id: ticket.ticket_id,
    ticket_type: ticket.ticket_type,
    validator_id: validatorId,
    validator_type: validatorType,
    location,
    timestamp: Date.now()
  });
  
  // Keep only last 1000 validations
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }
  
  localStorage.setItem('validation_history', JSON.stringify(history));
}

/**
 * Get fraud log
 */
export function getFraudLog() {
  return JSON.parse(localStorage.getItem('fraud_log') || '[]');
}

/**
 * Clear fraud log
 */
export function clearFraudLog() {
  localStorage.setItem('fraud_log', '[]');
}

/**
 * Check if network is online
 */
export function checkNetworkStatus() {
  return isOnline;
}

/**
 * Add credits to account (backend operation)
 * @param {string} accountId - PRIVATE account ID (NOT public card UID!)
 * @param {number} amount - Amount in CHF
 * @param {string} paymentProof - Payment verification token
 * @returns {Promise<object>} { success, newBalance }
 */
export async function addCreditsToAccount(accountId, amount, paymentProof) {
  if (MOCK_MODE) {
    await delay(500);
    console.log('PRIVACY: Backend receives:');
    console.log('  - account_id:', accountId, '(HSM-protected, NOT public UID)');
    console.log('  - amount:', amount);
    console.log('  - payment_proof:', paymentProof);
    console.log('PRIVACY: Backend NEVER sees public card UID!');
    
    return {
      success: true,
      newBalance: amount, // Mock - would query actual balance
      transaction_id: crypto.randomUUID(),
    };
  }

  const response = await fetch(`${API_BASE}/credits/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId, // ← Private ID, not card_uid!
      amount: amount,
      payment_proof: paymentProof,
    }),
  });

  if (!response.ok) throw new Error("Failed to add credits");
  return await response.json();
}

/**
 * Get account balance (backend operation)
 * @param {string} accountId - PRIVATE account ID (NOT public card UID!)
 * @returns {Promise<number>} Balance in CHF
 */
export async function getAccountBalance(accountId) {
  if (MOCK_MODE) {
    await delay(200);
    console.log('PRIVACY: Backend receives account_id:', accountId);
    console.log('PRIVACY: Backend NEVER sees public card UID!');
    
    // Mock - return balance from localStorage for demo
    return 0;
  }

  const response = await fetch(`${API_BASE}/credits/balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId, // ← Private ID, not card_uid!
    }),
  });

  if (!response.ok) throw new Error("Failed to get balance");
  const data = await response.json();
  return data.balance;
}
