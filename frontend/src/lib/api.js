/**
 * API client for backend communication
 *
 * MOCK IMPLEMENTATION - Returns mock data for POC
 * In production, replace with actual fetch calls to backend
 */

const API_BASE = "/api/v1";
const MOCK_MODE = true; // Set to false when backend is ready

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
