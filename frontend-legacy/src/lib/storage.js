/**
 * IndexedDB storage wrapper for offline token persistence
 * Stores tokens, master secrets, and Bloom filters
 */

import { openDB } from "idb";

const DB_NAME = "TicketWallet";
const DB_VERSION = 1;

// Store names
const STORES = {
  TOKENS: "tokens",
  MASTER_SECRETS: "masterSecrets",
  BLOOM_FILTERS: "bloomFilters",
  OFFLINE_SCANS: "offlineScans",
};

/**
 * Initialize the IndexedDB database
 */
async function getDB() {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Tokens store
      if (!db.objectStoreNames.contains(STORES.TOKENS)) {
        const tokenStore = db.createObjectStore(STORES.TOKENS, {
          keyPath: "id",
        });
        tokenStore.createIndex("created", "created");
        tokenStore.createIndex("expiry", "expiry");
      }

      // Master secrets store (for day tickets with rotating proofs)
      if (!db.objectStoreNames.contains(STORES.MASTER_SECRETS)) {
        db.createObjectStore(STORES.MASTER_SECRETS, { keyPath: "ticketId" });
      }

      // Bloom filters store (for validators)
      if (!db.objectStoreNames.contains(STORES.BLOOM_FILTERS)) {
        const bloomStore = db.createObjectStore(STORES.BLOOM_FILTERS, {
          keyPath: "id",
        });
        bloomStore.createIndex("downloaded", "downloaded");
      }

      // Offline scans store (for validators)
      if (!db.objectStoreNames.contains(STORES.OFFLINE_SCANS)) {
        const scanStore = db.createObjectStore(STORES.OFFLINE_SCANS, {
          keyPath: "id",
          autoIncrement: true,
        });
        scanStore.createIndex("timestamp", "timestamp");
        scanStore.createIndex("synced", "synced");
      }
    },
  });
}

// ===== TOKEN OPERATIONS =====

/**
 * Save a token to storage
 * @param {object} token - Token data
 */
export async function saveToken(token) {
  const db = await getDB();
  await db.put(STORES.TOKENS, token);
}

/**
 * Get all tokens
 * @returns {Array} List of tokens
 */
export async function getAllTokens() {
  const db = await getDB();
  return await db.getAll(STORES.TOKENS);
}

/**
 * Get a specific token by ID
 * @param {string} id - Token ID
 * @returns {object|undefined} Token data
 */
export async function getToken(id) {
  const db = await getDB();
  return await db.get(STORES.TOKENS, id);
}

/**
 * Delete a token
 * @param {string} id - Token ID
 */
export async function deleteToken(id) {
  const db = await getDB();
  await db.delete(STORES.TOKENS, id);
}

/**
 * Delete expired tokens
 * @returns {number} Number of tokens deleted
 */
export async function deleteExpiredTokens() {
  const db = await getDB();
  const tokens = await db.getAll(STORES.TOKENS);
  const now = new Date();

  let count = 0;
  for (const token of tokens) {
    if (new Date(token.expiry) < now) {
      await db.delete(STORES.TOKENS, token.id);
      count++;
    }
  }

  return count;
}

// ===== MASTER SECRET OPERATIONS (for day tickets) =====

/**
 * Save a master secret for a day ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} masterSecret - Master secret for rotating proofs
 */
export async function saveMasterSecret(ticketId, masterSecret) {
  const db = await getDB();
  await db.put(STORES.MASTER_SECRETS, {
    ticketId,
    masterSecret,
    created: Date.now(),
  });
}

/**
 * Get master secret for a ticket
 * @param {string} ticketId - Ticket ID
 * @returns {string|undefined} Master secret
 */
export async function getMasterSecret(ticketId) {
  const db = await getDB();
  const record = await db.get(STORES.MASTER_SECRETS, ticketId);
  return record?.masterSecret;
}

// ===== BLOOM FILTER OPERATIONS (for validators) =====

/**
 * Save a Bloom filter
 * @param {string} id - Filter ID (e.g., date)
 * @param {Uint8Array} filterData - Bloom filter binary data
 */
export async function saveBloomFilter(id, filterData) {
  const db = await getDB();
  await db.put(STORES.BLOOM_FILTERS, {
    id,
    data: filterData,
    downloaded: Date.now(),
  });
}

/**
 * Get a Bloom filter
 * @param {string} id - Filter ID
 * @returns {Uint8Array|undefined} Filter data
 */
export async function getBloomFilter(id) {
  const db = await getDB();
  const record = await db.get(STORES.BLOOM_FILTERS, id);
  return record?.data;
}

/**
 * Get the latest Bloom filter
 * @returns {object|undefined} Filter record
 */
export async function getLatestBloomFilter() {
  const db = await getDB();
  const filters = await db.getAllFromIndex(STORES.BLOOM_FILTERS, "downloaded");
  return filters[filters.length - 1];
}

// ===== OFFLINE SCAN OPERATIONS (for validators) =====

/**
 * Save an offline scan
 * @param {object} scanData - Scan data
 */
export async function saveOfflineScan(scanData) {
  const db = await getDB();
  await db.add(STORES.OFFLINE_SCANS, {
    ...scanData,
    timestamp: Date.now(),
    synced: false,
  });
}

/**
 * Get all unsynced offline scans
 * @returns {Array} List of unsynced scans
 */
export async function getUnsyncedScans() {
  const db = await getDB();
  const allScans = await db.getAll(STORES.OFFLINE_SCANS);
  return allScans.filter((scan) => !scan.synced);
}

/**
 * Mark a scan as synced
 * @param {number} scanId - Scan ID
 */
export async function markScanAsSynced(scanId) {
  const db = await getDB();
  const scan = await db.get(STORES.OFFLINE_SCANS, scanId);
  if (scan) {
    scan.synced = true;
    await db.put(STORES.OFFLINE_SCANS, scan);
  }
}

/**
 * Clear all synced scans older than X days
 * @param {number} daysOld - Number of days
 * @returns {number} Number of scans deleted
 */
export async function clearOldSyncedScans(daysOld = 7) {
  const db = await getDB();
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const allScans = await db.getAll(STORES.OFFLINE_SCANS);

  let count = 0;
  for (const scan of allScans) {
    if (scan.synced && scan.timestamp < cutoff) {
      await db.delete(STORES.OFFLINE_SCANS, scan.id);
      count++;
    }
  }

  return count;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Clear all data (useful for testing)
 */
export async function clearAllData() {
  const db = await getDB();
  await db.clear(STORES.TOKENS);
  await db.clear(STORES.MASTER_SECRETS);
  await db.clear(STORES.BLOOM_FILTERS);
  await db.clear(STORES.OFFLINE_SCANS);
}

/**
 * Get storage statistics
 * @returns {object} Storage stats
 */
export async function getStorageStats() {
  const db = await getDB();

  const tokens = await db.getAll(STORES.TOKENS);
  const masterSecrets = await db.getAll(STORES.MASTER_SECRETS);
  const bloomFilters = await db.getAll(STORES.BLOOM_FILTERS);
  const offlineScans = await db.getAll(STORES.OFFLINE_SCANS);
  const unsyncedScans = offlineScans.filter((s) => !s.synced);

  return {
    totalTokens: tokens.length,
    totalMasterSecrets: masterSecrets.length,
    totalBloomFilters: bloomFilters.length,
    totalOfflineScans: offlineScans.length,
    unsyncedScans: unsyncedScans.length,
  };
}
