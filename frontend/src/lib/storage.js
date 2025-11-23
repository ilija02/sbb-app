/**
 * Complete IndexedDB storage for SBB Ticketing System
 * 
 * Stores:
 * 1. User Device: Virtual tokens, User tickets
 * 2. Backend: Cryptographic keys, Invalidated tickets, Token purchases
 * 3. Validator: Invalidation queue (offline sync)
 */

import { openDB } from "idb";

const DB_NAME = "SBBTicketing";
const DB_VERSION = 3;

// Cross-tab synchronization using BroadcastChannel
const SYNC_CHANNEL_NAME = "sbb-ticketing-sync";
const VALIDATOR_TIME_CHANNEL_NAME = "sbb-validator-time-sync";
let syncChannel = null;
let validatorTimeChannel = null;

// Flag to prevent auto-key creation during restart
let isRestarting = false;

/**
 * Initialize cross-tab synchronization
 */
function initSyncChannel() {
  if (typeof BroadcastChannel !== 'undefined' && !syncChannel) {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
}

/**
 * Notify other tabs about data changes
 * @param {string} store - Store name that changed
 * @param {string} operation - Operation type (add, update, delete)
 */
export function notifyTabs(store, operation) {
  if (!syncChannel) {
    initSyncChannel();
  }
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'db-change',
      store,
      operation,
      timestamp: Date.now()
    });
  }
}

/**
 * Subscribe to cross-tab changes
 * @param {Function} callback - Callback function to call when data changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToChanges(callback) {
  if (!syncChannel) {
    initSyncChannel();
  }
  if (syncChannel) {
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'db-change') {
        callback(event.data);
      }
    };
    syncChannel.addEventListener('message', messageHandler);
    return () => {
      if (syncChannel) {
        syncChannel.removeEventListener('message', messageHandler);
      }
    };
  }
  return () => {}; // No-op unsubscribe
}

/**
 * Initialize validator time sync channel
 */
function initValidatorTimeChannel() {
  if (typeof BroadcastChannel !== 'undefined' && !validatorTimeChannel) {
    validatorTimeChannel = new BroadcastChannel(VALIDATOR_TIME_CHANNEL_NAME);
  }
}

/**
 * Broadcast validator time change to all windows
 * @param {number} time - New validator time (timestamp)
 */
export function broadcastValidatorTime(time) {
  if (!validatorTimeChannel) {
    initValidatorTimeChannel();
  }
  if (validatorTimeChannel) {
    validatorTimeChannel.postMessage({
      type: 'validator-time-change',
      time: time,
      timestamp: Date.now()
    });
  }
}

/**
 * Subscribe to validator time changes from other windows
 * @param {Function} callback - Callback function to call when time changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToValidatorTime(callback) {
  if (!validatorTimeChannel) {
    initValidatorTimeChannel();
  }
  if (validatorTimeChannel) {
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'validator-time-change') {
        callback(event.data.time);
      }
    };
    validatorTimeChannel.addEventListener('message', messageHandler);
    return () => {
      if (validatorTimeChannel) {
        validatorTimeChannel.removeEventListener('message', messageHandler);
      }
    };
  }
  return () => {}; // No-op unsubscribe
}

// Store names
const STORES = {
  // User Device
  USER_TICKETS: "userTickets",          // Tickets purchased by user
  USAGE_TOKENS: "usageTokens",          // Usage tokens for daily tickets (user device)
  
  // Backend
  CRYPTOGRAPHIC_KEYS: "cryptographicKeys",  // Rotating signing keys
  INVALIDATED_TICKETS: "invalidatedTickets", // Invalidated tickets (active keys only)
  TOKEN_PURCHASES: "tokenPurchases",         // Token purchase records
  USER_BALANCES: "userBalances",             // User balances (cardId -> balance)
  
  // Validator
  VALIDATOR_INVALIDATION_QUEUE: "validatorInvalidationQueue", // Queue for offline sync
};

/**
 * Initialize the IndexedDB database
 */
async function getDB() {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ===== USER DEVICE STORES =====
      
      // User tickets store (user device)
      if (!db.objectStoreNames.contains(STORES.USER_TICKETS)) {
        const ticketStore = db.createObjectStore(STORES.USER_TICKETS, {
          keyPath: "ticketId",
        });
        ticketStore.createIndex("cardId", "cardId");
        ticketStore.createIndex("validUntil", "validUntil");
        ticketStore.createIndex("keyId", "keyId");
      }

      // Usage tokens store (user device) - for daily ticket usage records
      if (!db.objectStoreNames.contains(STORES.USAGE_TOKENS)) {
        const usageTokenStore = db.createObjectStore(STORES.USAGE_TOKENS, {
          keyPath: "id",
          autoIncrement: true,
        });
        usageTokenStore.createIndex("ticketId", "ticketId");
        usageTokenStore.createIndex("cardId", "cardId");
        usageTokenStore.createIndex("usedAt", "usedAt");
      }

      // ===== BACKEND STORES =====
      
      // Cryptographic keys store (backend)
      if (!db.objectStoreNames.contains(STORES.CRYPTOGRAPHIC_KEYS)) {
        const keyStore = db.createObjectStore(STORES.CRYPTOGRAPHIC_KEYS, {
          keyPath: "keyId",
        });
        keyStore.createIndex("isActive", "isActive");
        keyStore.createIndex("expiresAt", "expiresAt");
        keyStore.createIndex("createdAt", "createdAt");
      }

      // Invalidated tickets store (backend)
      if (!db.objectStoreNames.contains(STORES.INVALIDATED_TICKETS)) {
        const invalidationStore = db.createObjectStore(STORES.INVALIDATED_TICKETS, {
          keyPath: "ticketId",
        });
        invalidationStore.createIndex("keyId", "keyId");
        invalidationStore.createIndex("invalidatedAt", "invalidatedAt");
        invalidationStore.createIndex("validatorId", "validatorId");
      }

      // Token purchases store (backend)
      if (!db.objectStoreNames.contains(STORES.TOKEN_PURCHASES)) {
        const purchaseStore = db.createObjectStore(STORES.TOKEN_PURCHASES, {
          keyPath: "id",
          autoIncrement: true,
        });
        purchaseStore.createIndex("accountId", "accountId");
        purchaseStore.createIndex("timestamp", "timestamp");
      }

      // User balances store (backend)
      if (!db.objectStoreNames.contains(STORES.USER_BALANCES)) {
        const balanceStore = db.createObjectStore(STORES.USER_BALANCES, {
          keyPath: "cardId",
        });
        balanceStore.createIndex("balance", "balance");
      }

      // ===== VALIDATOR STORES =====
      
      // Validator invalidation queue
      if (!db.objectStoreNames.contains(STORES.VALIDATOR_INVALIDATION_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.VALIDATOR_INVALIDATION_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("synced", "synced");
        queueStore.createIndex("timestamp", "timestamp");
      }
    },
  });
}

// ===== USER TICKETS (User Device) =====

/**
 * Save user ticket
 * @param {object} ticket - { ticketId, cardId, route, class, validFrom, validUntil, ticketType, signature, keyId }
 */
export async function saveUserTicket(ticket) {
  const db = await getDB();
  await db.put(STORES.USER_TICKETS, ticket);
  notifyTabs(STORES.USER_TICKETS, 'update');
}

/**
 * Get all tickets for a card
 * @param {string} cardId - Card ID
 * @returns {Array} List of tickets
 */
export async function getUserTicketsForCard(cardId) {
  const db = await getDB();
  const allTickets = await db.getAll(STORES.USER_TICKETS);
  return allTickets.filter(ticket => ticket.cardId === cardId);
}

/**
 * Get valid tickets for a card (not expired)
 * @param {string} cardId - Card ID
 * @returns {Array} List of valid tickets
 */
export async function getValidUserTickets(cardId) {
  const tickets = await getUserTicketsForCard(cardId);
  const now = Date.now();
  return tickets.filter(ticket => 
    ticket.validFrom <= now && ticket.validUntil >= now
  );
}

/**
 * Get all user tickets
 * @returns {Array} List of all tickets
 */
export async function getAllUserTickets() {
  const db = await getDB();
  return await db.getAll(STORES.USER_TICKETS);
}

/**
 * Delete a user ticket
 * @param {string} ticketId - Ticket ID
 */
export async function deleteUserTicket(ticketId) {
  const db = await getDB();
  await db.delete(STORES.USER_TICKETS, ticketId);
  notifyTabs(STORES.USER_TICKETS, 'delete');
}

// ===== USAGE TOKENS (User Device) =====

/**
 * Save usage token (for daily tickets)
 * @param {object} usageToken - { ticketId, cardId, usedAt, validatorId, location, token }
 */
export async function saveUsageToken(usageToken) {
  const db = await getDB();
  await db.add(STORES.USAGE_TOKENS, {
    ...usageToken,
    usedAt: usageToken.usedAt || Date.now(),
  });
  notifyTabs(STORES.USAGE_TOKENS, 'add');
}

/**
 * Get usage tokens for a card
 * @param {string} cardId - Card ID
 * @returns {Array} List of usage tokens
 */
export async function getUsageTokensForCard(cardId) {
  const db = await getDB();
  const allTokens = await db.getAll(STORES.USAGE_TOKENS);
  return allTokens.filter(token => token.cardId === cardId);
}

/**
 * Get all usage tokens
 * @returns {Array} List of all usage tokens
 */
export async function getAllUsageTokens() {
  const db = await getDB();
  return await db.getAll(STORES.USAGE_TOKENS);
}

// ===== CRYPTOGRAPHIC KEYS (Backend) =====

/**
 * Save cryptographic key
 * @param {object} key - { keyId, publicKey, privateKey (mock), isActive, createdAt, expiresAt }
 */
export async function saveCryptographicKey(key) {
  const db = await getDB();
  await db.put(STORES.CRYPTOGRAPHIC_KEYS, {
    ...key,
    createdAt: key.createdAt || Date.now(),
  });
  notifyTabs(STORES.CRYPTOGRAPHIC_KEYS, 'update');
}

/**
 * Get all cryptographic keys
 * @returns {Array} List of keys
 */
export async function getAllCryptographicKeys() {
  const db = await getDB();
  return await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
}

/**
 * Ensure at least 5 active keys exist
 * Automatically creates new keys if there are fewer than 5 active keys
 * @param {number} currentTime - Current time to check expiration (defaults to Date.now())
 * @returns {Promise<void>}
 */
export async function ensureActiveKeys(currentTime = Date.now()) {
  // Don't auto-create keys during restart
  if (isRestarting) {
    console.log('[Storage] Skipping auto-key creation during restart');
    return;
  }
  
  const db = await getDB();
  const allKeys = await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
  
  // Filter for active keys that haven't expired
  const activeKeys = allKeys.filter(key => {
    return key.isActive === true && key.expiresAt && key.expiresAt > currentTime;
  });
  
  // If we have less than 5 active keys, create new ones
  const keysNeeded = 5 - activeKeys.length;
  if (keysNeeded > 0) {
    console.log(`[Storage] Only ${activeKeys.length} active keys found, creating ${keysNeeded} new key(s)...`);
    for (let i = 0; i < keysNeeded; i++) {
      await rotateCryptographicKey(10, currentTime); // 10 hours validity
    }
  }
}

/**
 * Get active cryptographic key (newest one)
 * Automatically ensures at least 5 active keys exist
 * @param {number} currentTime - Current time to check expiration (defaults to Date.now())
 * @returns {object|undefined} Newest active key
 */
export async function getActiveCryptographicKey(currentTime = Date.now()) {
  // Ensure we have at least 5 active keys
  await ensureActiveKeys(currentTime);
  
  const db = await getDB();
  const allKeys = await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
  
  // Filter for active keys that haven't expired
  const activeKeys = allKeys.filter(key => {
    return key.isActive === true && key.expiresAt && key.expiresAt > currentTime;
  });
  
  // Sort by createdAt (newest first) and return the newest one
  activeKeys.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  return activeKeys.length > 0 ? activeKeys[0] : undefined;
}

/**
 * Get all active keys (not expired)
 * Automatically ensures at least 5 active keys exist
 * @param {number} currentTime - Current time to check expiration (defaults to Date.now())
 * @returns {Array} List of active keys, sorted by creation time (newest first)
 */
export async function getActiveCryptographicKeys(currentTime = Date.now()) {
  // Ensure we have at least 5 active keys
  await ensureActiveKeys(currentTime);
  
  const db = await getDB();
  // Get all keys and filter in JavaScript to avoid IndexedDB index issues
  const allKeys = await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
  
  // Filter for active keys that haven't expired
  const activeKeys = allKeys.filter(key => {
    return key.isActive === true && key.expiresAt && key.expiresAt > currentTime;
  });
  
  // Sort by createdAt descending (newest first)
  activeKeys.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  return activeKeys;
}

/**
 * Rotate keys - create a new key and optionally expire old ones
 * @param {number} validityHours - Number of hours the new key should be valid (default: 10)
 * @param {number} currentTime - Current time for expiration calculation (defaults to Date.now())
 * @returns {object} The newly created key
 */
export async function rotateCryptographicKey(validityHours = 10, currentTime = Date.now()) {
  const db = await getDB();
  const { generateKeyId } = await import('./crypto');
  
  // Generate new key
  const newKeyId = generateKeyId();
  const newKey = {
    keyId: newKeyId,
    publicKey: { n: `mock_modulus_${newKeyId}...`, e: 65537 },
    privateKey: `mock_private_key_${newKeyId}`,
    isActive: true,
    createdAt: currentTime,
    expiresAt: currentTime + (validityHours * 60 * 60 * 1000),
  };
  
  // Save new key
  await db.put(STORES.CRYPTOGRAPHIC_KEYS, newKey);
  notifyTabs(STORES.CRYPTOGRAPHIC_KEYS, 'update');
  
  console.log('[Storage] New key created:', newKeyId);
  return newKey;
}

/**
 * Deactivate a key (mark as inactive)
 * @param {string} keyId - Key ID
 */
export async function deactivateCryptographicKey(keyId) {
  const db = await getDB();
  const key = await db.get(STORES.CRYPTOGRAPHIC_KEYS, keyId);
  if (key) {
    key.isActive = false;
    await db.put(STORES.CRYPTOGRAPHIC_KEYS, key);
    notifyTabs(STORES.CRYPTOGRAPHIC_KEYS, 'update');
  }
}

/**
 * Delete expired keys
 * @returns {number} Number of keys deleted
 */
export async function deleteExpiredKeys() {
  const db = await getDB();
  const keys = await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
  const now = Date.now();
  
  let count = 0;
  for (const key of keys) {
    if (key.expiresAt < now) {
      await db.delete(STORES.CRYPTOGRAPHIC_KEYS, key.keyId);
      notifyTabs(STORES.CRYPTOGRAPHIC_KEYS, 'delete');
      count++;
    }
  }
  
  return count;
}

// ===== INVALIDATED TICKETS (Backend) =====

/**
 * Save invalidated ticket (only for active keys)
 * @param {object} invalidation - { ticketId, keyId, invalidatedAt, validatorId, location }
 */
export async function saveInvalidatedTicket(invalidation) {
  const db = await getDB();
  await db.put(STORES.INVALIDATED_TICKETS, {
    ...invalidation,
    invalidatedAt: invalidation.invalidatedAt || Date.now(),
  });
  notifyTabs(STORES.INVALIDATED_TICKETS, 'update');
}

/**
 * Check if ticket is invalidated
 * @param {string} ticketId - Ticket ID
 * @returns {boolean} True if invalidated
 */
export async function isTicketInvalidated(ticketId) {
  const db = await getDB();
  const invalidation = await db.get(STORES.INVALIDATED_TICKETS, ticketId);
  return !!invalidation;
}

/**
 * Get invalidated ticket
 * @param {string} ticketId - Ticket ID
 * @returns {object|undefined} Invalidation record
 */
export async function getInvalidatedTicket(ticketId) {
  const db = await getDB();
  return await db.get(STORES.INVALIDATED_TICKETS, ticketId);
}

/**
 * Get all invalidated tickets for active keys
 * @returns {Array} List of invalidations
 */
export async function getInvalidatedTicketsForActiveKeys() {
  const db = await getDB();
  const activeKeys = await getActiveCryptographicKeys();
  const activeKeyIds = new Set(activeKeys.map(k => k.keyId));
  
  const allInvalidations = await db.getAll(STORES.INVALIDATED_TICKETS);
  return allInvalidations.filter(inv => activeKeyIds.has(inv.keyId));
}

/**
 * Clean up invalidated tickets for expired keys
 * @returns {number} Number of invalidations deleted
 */
export async function cleanupExpiredKeyInvalidations() {
  const db = await getDB();
  const activeKeys = await getActiveCryptographicKeys();
  const activeKeyIds = new Set(activeKeys.map(k => k.keyId));
  
  const allInvalidations = await db.getAll(STORES.INVALIDATED_TICKETS);
  let count = 0;
  
  for (const inv of allInvalidations) {
    if (!activeKeyIds.has(inv.keyId)) {
      await db.delete(STORES.INVALIDATED_TICKETS, inv.ticketId);
      notifyTabs(STORES.INVALIDATED_TICKETS, 'delete');
      count++;
    }
  }
  
  return count;
}

/**
 * Get all invalidated tickets
 * @returns {Array} List of all invalidations
 */
export async function getAllInvalidatedTickets() {
  const db = await getDB();
  return await db.getAll(STORES.INVALIDATED_TICKETS);
}

// ===== USER BALANCES (Backend) =====

/**
 * Get user balance for a card
 * @param {string} cardId - Card ID
 * @returns {number} Balance in CHF (default 0 if not found)
 */
export async function getUserBalance(cardId) {
  const db = await getDB();
  const balanceRecord = await db.get(STORES.USER_BALANCES, cardId);
  return balanceRecord ? balanceRecord.balance : 0;
}

/**
 * Set user balance for a card
 * @param {string} cardId - Card ID
 * @param {number} balance - Balance in CHF
 */
export async function setUserBalance(cardId, balance) {
  const db = await getDB();
  await db.put(STORES.USER_BALANCES, {
    cardId,
    balance,
    updatedAt: Date.now(),
  });
  notifyTabs(STORES.USER_BALANCES, 'update');
}

/**
 * Add to user balance
 * @param {string} cardId - Card ID
 * @param {number} amount - Amount to add in CHF
 * @returns {number} New balance
 */
export async function addToUserBalance(cardId, amount) {
  const currentBalance = await getUserBalance(cardId);
  const newBalance = currentBalance + amount;
  await setUserBalance(cardId, newBalance);
  return newBalance;
}

/**
 * Deduct from user balance
 * @param {string} cardId - Card ID
 * @param {number} amount - Amount to deduct in CHF
 * @returns {number} New balance
 * @throws {Error} If insufficient balance
 */
export async function deductFromUserBalance(cardId, amount) {
  const currentBalance = await getUserBalance(cardId);
  if (currentBalance < amount) {
    throw new Error(`Insufficient balance. Current: CHF ${currentBalance}, Required: CHF ${amount}`);
  }
  const newBalance = currentBalance - amount;
  await setUserBalance(cardId, newBalance);
  return newBalance;
}

/**
 * Get all user balances
 * @returns {Array} List of all balance records
 */
export async function getAllUserBalances() {
  const db = await getDB();
  return await db.getAll(STORES.USER_BALANCES);
}

// ===== TOKEN PURCHASES (Backend) =====

/**
 * Save token purchase record
 * @param {object} purchase - { accountId, amount, paymentMethod, timestamp }
 */
export async function saveTokenPurchase(purchase) {
  const db = await getDB();
  await db.add(STORES.TOKEN_PURCHASES, {
    ...purchase,
    timestamp: purchase.timestamp || Date.now(),
  });
  notifyTabs(STORES.TOKEN_PURCHASES, 'add');
}

/**
 * Get all token purchases
 * @returns {Array} List of purchases
 */
export async function getAllTokenPurchases() {
  const db = await getDB();
  return await db.getAll(STORES.TOKEN_PURCHASES);
}

/**
 * Get token purchases for an account
 * @param {string} accountId - Account ID
 * @returns {Array} List of purchases
 */
export async function getTokenPurchasesForAccount(accountId) {
  const db = await getDB();
  const allPurchases = await db.getAll(STORES.TOKEN_PURCHASES);
  return allPurchases.filter(p => p.accountId === accountId);
}

// ===== VALIDATOR INVALIDATION QUEUE =====

/**
 * Add ticket to validator invalidation queue (offline)
 * @param {object} invalidation - { ticketId, keyId, validatorId, location, oldTicketData, newTicketData }
 */
export async function queueValidatorInvalidation(invalidation) {
  const db = await getDB();
  await db.add(STORES.VALIDATOR_INVALIDATION_QUEUE, {
    ...invalidation,
    timestamp: Date.now(),
    synced: false,
  });
  notifyTabs(STORES.VALIDATOR_INVALIDATION_QUEUE, 'update');
}

/**
 * Get all unsynced invalidations from queue
 * @returns {Array} List of unsynced invalidations
 */
export async function getUnsyncedValidatorInvalidations() {
  const db = await getDB();
  const allInvalidations = await db.getAll(STORES.VALIDATOR_INVALIDATION_QUEUE);
  return allInvalidations.filter(inv => !inv.synced);
}

/**
 * Mark invalidation as synced
 * @param {number} invalidationId - Invalidation ID
 */
export async function markValidatorInvalidationSynced(invalidationId) {
  const db = await getDB();
  const invalidation = await db.get(STORES.VALIDATOR_INVALIDATION_QUEUE, invalidationId);
  if (invalidation) {
    invalidation.synced = true;
    await db.put(STORES.VALIDATOR_INVALIDATION_QUEUE, invalidation);
    notifyTabs(STORES.VALIDATOR_INVALIDATION_QUEUE, 'update');
  }
}

/**
 * Get all validator invalidations
 * @returns {Array} List of all invalidations
 */
export async function getAllValidatorInvalidations() {
  const db = await getDB();
  return await db.getAll(STORES.VALIDATOR_INVALIDATION_QUEUE);
}

/**
 * Clear synced invalidations older than X days
 * @param {number} daysOld - Number of days
 * @returns {number} Number of invalidations deleted
 */
export async function clearOldSyncedValidatorInvalidations(daysOld = 7) {
  const db = await getDB();
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const allInvalidations = await db.getAll(STORES.VALIDATOR_INVALIDATION_QUEUE);
  
  let count = 0;
  for (const inv of allInvalidations) {
    if (inv.synced && inv.timestamp < cutoff) {
      await db.delete(STORES.VALIDATOR_INVALIDATION_QUEUE, inv.id);
      count++;
    }
  }
  
  return count;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Set restarting flag to prevent auto-key creation during restart
 */
export function setRestarting(restarting) {
  isRestarting = restarting;
  console.log(`[Storage] Restarting flag set to: ${restarting}`);
}

/**
 * Clear all data (useful for testing/restart)
 * Also notifies all tabs about the clear
 */
export async function clearAllData() {
  // Set restarting flag to prevent auto-key creation
  isRestarting = true;
  
  const db = await getDB();
  
  // Clear all stores
  const storeNames = Object.values(STORES);
  
  for (const storeName of storeNames) {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await store.clear();
      await tx.done;
      console.log(`[Storage] Cleared store: ${storeName}`);
    } catch (error) {
      console.error(`[Storage] Error clearing store ${storeName}:`, error);
    }
  }
  
  // Notify all tabs about the clear
  for (const storeName of storeNames) {
    notifyTabs(storeName, 'clear');
  }
  
  console.log('[Storage] All storage cleared');
}

/**
 * Get storage statistics
 * @returns {object} Storage stats
 */
export async function getStorageStats() {
  const db = await getDB();
  
  const userTickets = await db.getAll(STORES.USER_TICKETS);
  const keys = await db.getAll(STORES.CRYPTOGRAPHIC_KEYS);
  const invalidatedTickets = await db.getAll(STORES.INVALIDATED_TICKETS);
  const tokenPurchases = await db.getAll(STORES.TOKEN_PURCHASES);
  const userBalances = await db.getAll(STORES.USER_BALANCES);
  const validatorQueue = await db.getAll(STORES.VALIDATOR_INVALIDATION_QUEUE);
  
  const activeKeys = await getActiveCryptographicKeys();
  const unsyncedQueue = validatorQueue.filter(q => !q.synced);
  
  return {
    userTickets: userTickets.length,
    userBalances: userBalances.length,
    cryptographicKeys: keys.length,
    activeKeys: activeKeys.length,
    invalidatedTickets: invalidatedTickets.length,
    tokenPurchases: tokenPurchases.length,
    validatorQueue: validatorQueue.length,
    unsyncedQueue: unsyncedQueue.length,
  };
}

