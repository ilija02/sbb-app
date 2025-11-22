/**
 * Cryptographic utilities for blind signatures and rotating proofs
 *
 * MOCK IMPLEMENTATION - Uses placeholder crypto for POC
 * In production, implement proper RSA blind signatures using Web Crypto API
 */

/**
 * Generate a random 256-bit token
 * @returns {string} Hex-encoded token
 */
export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * MOCK: Blind a token (would use RSA blinding in production)
 * @param {string} token - Hex-encoded token
 * @param {object} publicKey - Issuer's public key
 * @returns {string} Blinded token
 */
export function blindToken(token, publicKey) {
  // In production: Implement RSA blinding
  // B(T) = T^e * r^n mod N
  // where r is a random blinding factor

  // For now, just prefix with 'blinded_'
  return "blinded_" + token;
}

/**
 * MOCK: Unblind a signed blinded token (would use RSA unblinding in production)
 * @param {string} signedBlindedToken - Server's signature on blinded token
 * @param {string} blindingFactor - The blinding factor used
 * @returns {string} Unblinded signature (valid signature on original token)
 */
export function unblindSignature(signedBlindedToken, blindingFactor) {
  // In production: Implement RSA unblinding
  // Sig(T) = Sig(B(T)) / r

  // For now, just remove the 'signed_blinded_' prefix
  return signedBlindedToken.replace("signed_blinded_", "sig_");
}

/**
 * MOCK: Verify a signature (would use RSA verification in production)
 * @param {string} token - Original token
 * @param {string} signature - Signature to verify
 * @param {object} publicKey - Issuer's public key
 * @returns {boolean} True if signature is valid
 */
export function verifySignature(token, signature, publicKey) {
  // In production: Verify signature using RSA public key
  // Verify: Sig(T)^e mod N == T

  // For now, just check if signature starts with 'sig_'
  return signature.startsWith("sig_");
}

/**
 * Generate a rotating cryptographic proof for anti-sharing
 * Uses HMAC(master_secret, current_epoch) to generate time-bound proofs
 *
 * @param {string} masterSecret - The master secret (stored securely)
 * @param {number} epochDurationMs - Duration of each epoch in milliseconds (default 30s)
 * @returns {object} { proof, expiresAt, epoch }
 */
export async function generateRotatingProof(
  masterSecret,
  epochDurationMs = 30000
) {
  const now = Date.now();
  const epoch = Math.floor(now / epochDurationMs);
  const expiresAt = (epoch + 1) * epochDurationMs;

  // In production: Use Web Crypto API for HMAC
  // const key = await crypto.subtle.importKey(...)
  // const proof = await crypto.subtle.sign('HMAC', key, epochBytes)

  // For now, mock implementation using a simple hash
  const message = `${masterSecret}-${epoch}`;
  const proof = await mockHMAC(message);

  return {
    proof,
    expiresAt,
    epoch,
    timeRemaining: expiresAt - now,
  };
}

/**
 * Verify a rotating proof is valid for current epoch
 * @param {string} proof - The proof to verify
 * @param {string} masterSecret - The master secret
 * @param {number} epoch - The epoch when proof was generated
 * @param {number} epochDurationMs - Epoch duration
 * @returns {boolean} True if proof is valid for current or previous epoch
 */
export async function verifyRotatingProof(
  proof,
  masterSecret,
  epoch,
  epochDurationMs = 30000
) {
  const currentEpoch = Math.floor(Date.now() / epochDurationMs);

  // Allow current epoch and previous epoch (for clock skew tolerance)
  if (epoch !== currentEpoch && epoch !== currentEpoch - 1) {
    return false;
  }

  const message = `${masterSecret}-${epoch}`;
  const expectedProof = await mockHMAC(message);

  return proof === expectedProof;
}

/**
 * Mock HMAC implementation using SHA-256
 * In production, use crypto.subtle.sign with HMAC
 */
async function mockHMAC(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

/**
 * Generate a QR code payload for a token
 * @param {object} tokenData - Token information
 * @returns {string} JSON string to encode in QR
 */
export function generateQRPayload(tokenData) {
  return JSON.stringify({
    t: tokenData.token,
    sig: tokenData.signature,
    exp: tokenData.expiry,
    proof: tokenData.proof || null,
    epoch: tokenData.epoch || null,
  });
}

/**
 * Parse a QR code payload
 * @param {string} qrData - Scanned QR code data
 * @returns {object} Parsed token data
 */
export function parseQRPayload(qrData) {
  try {
    const data = JSON.parse(qrData);
    return {
      token: data.t,
      signature: data.sig,
      expiry: data.exp,
      proof: data.proof,
      epoch: data.epoch,
    };
  } catch (error) {
    throw new Error("Invalid QR code format");
  }
}

/**
 * Check if a token has expired
 * @param {string} expiryISO - ISO timestamp
 * @returns {boolean} True if expired
 */
export function isTokenExpired(expiryISO) {
  return new Date(expiryISO) < new Date();
}
