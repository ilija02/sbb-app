/**
 * Seed Data for Demo
 * 
 * This file contains fake startup data for the demo.
 * Modify values here to adjust the initial state.
 */

import { 
  saveCryptographicKey,
  saveUserTicket,
  saveInvalidatedTicket,
  saveTokenPurchase,
  setUserBalance,
  getAllCryptographicKeys,
  getAllUserBalances,
  notifyTabs
} from './storage'
import { generateToken } from './crypto'

// ===== CRYPTOGRAPHIC KEYS =====
// These keys are shared between Backend and Validator
// System maintains at least 5 active keys at all times
// Keys expire in hours for easier testing
// Keys are spaced 2 hours apart in expiration time

/**
 * Generate fresh seed keys with current timestamps
 * @param {number} baseTime - Base time to calculate from (defaults to Date.now())
 * @returns {Array} Array of seed keys
 */
export function getSeedKeys(baseTime = Date.now()) {
  return [
    {
      keyId: 'key_20250101_001',
      publicKey: { n: 'mock_modulus_12345...', e: 65537 },
      privateKey: 'mock_private_key_001', // Mock - in production this stays in HSM
      isActive: true,
      createdAt: baseTime - 2 * 60 * 60 * 1000, // 2 hours ago
      expiresAt: baseTime + 2 * 60 * 60 * 1000, // Expires in 2 hours
    },
    {
      keyId: 'key_20250108_002',
      publicKey: { n: 'mock_modulus_67890...', e: 65537 },
      privateKey: 'mock_private_key_002',
      isActive: true,
      createdAt: baseTime - 1.5 * 60 * 60 * 1000, // 1.5 hours ago
      expiresAt: baseTime + 4 * 60 * 60 * 1000, // Expires in 4 hours (2 hours after first)
    },
    {
      keyId: 'key_20250115_003',
      publicKey: { n: 'mock_modulus_abcde...', e: 65537 },
      privateKey: 'mock_private_key_003',
      isActive: true,
      createdAt: baseTime - 1 * 60 * 60 * 1000, // 1 hour ago
      expiresAt: baseTime + 6 * 60 * 60 * 1000, // Expires in 6 hours (2 hours after second)
    },
    {
      keyId: 'key_20250120_004',
      publicKey: { n: 'mock_modulus_fghij...', e: 65537 },
      privateKey: 'mock_private_key_004',
      isActive: true,
      createdAt: baseTime - 0.5 * 60 * 60 * 1000, // 30 minutes ago
      expiresAt: baseTime + 8 * 60 * 60 * 1000, // Expires in 8 hours (2 hours after third)
    },
    {
      keyId: 'key_20250125_005',
      publicKey: { n: 'mock_modulus_klmno...', e: 65537 },
      privateKey: 'mock_private_key_005',
      isActive: true,
      createdAt: baseTime - 0.25 * 60 * 60 * 1000, // 15 minutes ago (newest)
      expiresAt: baseTime + 10 * 60 * 60 * 1000, // Expires in 10 hours (2 hours after fourth)
    },
  ]
}

// Legacy export for backwards compatibility (uses current time)
export const SEED_KEYS = getSeedKeys()

// ===== USER DEVICE DATA =====

// Card IDs for demo
export const DEMO_CARD_IDS = {
  USER_1: 'CARD_001_ABC123',
  USER_2: 'CARD_002_DEF456',
}

// User Balances (Backend - cardId -> balance)
// These balances should match the sum of purchases for each user
export const SEED_USER_BALANCES = [
  {
    cardId: DEMO_CARD_IDS.USER_1,
    balance: 125, // CHF 125 (from purchases: 50 + 50 + 25)
  },
  {
    cardId: DEMO_CARD_IDS.USER_2,
    balance: 105, // CHF 105 (from purchases: 75 + 30)
  },
]

// User Tickets - Generated dynamically to ensure unique IDs
// Each device has: max 3 tickets (1 daily + 2 single tickets)
export function getSeedUserTickets(baseTime = Date.now()) {
  const seedKeys = getSeedKeys(baseTime)
  return [
    // User 1: Daily ticket
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_1,
      route: 'ZH-BE',
      class: 2,
      validFrom: baseTime - 2 * 60 * 60 * 1000, // 2 hours ago
      validUntil: seedKeys[1].expiresAt, // Aligned with key expiration
      ticketType: 'day',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[1].keyId, // Signed with second key
    },
    // User 1: Single ticket 1
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_1,
      route: 'ZH-BE',
      class: 2,
      validFrom: baseTime - 1 * 60 * 60 * 1000, // 1 hour ago
      validUntil: seedKeys[3].expiresAt, // Aligned with key expiration (newest key)
      ticketType: 'single',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[3].keyId, // Signed with newest key
    },
    // User 1: Single ticket 2
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_1,
      route: 'ZH-BE',
      class: 2,
      validFrom: baseTime - 15 * 60 * 1000, // 15 minutes ago
      validUntil: seedKeys[2].expiresAt, // Aligned with key expiration
      ticketType: 'single',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[2].keyId, // Signed with third key
    },
    // User 2: Daily ticket
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_2,
      route: 'BE-ZH',
      class: 1,
      validFrom: baseTime - 3 * 60 * 60 * 1000, // 3 hours ago
      validUntil: baseTime + 21 * 60 * 60 * 1000, // Valid for 21 more hours (day pass)
      ticketType: 'day',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[0].keyId, // Signed with first key
    },
    // User 2: Single ticket 1
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_2,
      route: 'BE-ZH',
      class: 1,
      validFrom: baseTime - 30 * 60 * 1000, // 30 minutes ago
      validUntil: seedKeys[2].expiresAt, // Aligned with key expiration
      ticketType: 'single',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[2].keyId, // Signed with third key
    },
    // User 2: Single ticket 2
    {
      ticketId: generateToken(),
      cardId: DEMO_CARD_IDS.USER_2,
      route: 'BE-ZH',
      class: 1,
      validFrom: baseTime - 10 * 60 * 1000, // 10 minutes ago
      validUntil: seedKeys[3].expiresAt, // Aligned with key expiration (newest key)
      ticketType: 'single',
      signature: 'sig_' + generateToken().substring(0, 32),
      keyId: seedKeys[3].keyId, // Signed with newest key
    },
  ]
}

// ===== BACKEND DATA =====

// Invalidated Tickets (only for active keys) - Generated dynamically
export function getSeedInvalidatedTickets(baseTime = Date.now()) {
  const seedKeys = getSeedKeys(baseTime)
  return [
    {
      ticketId: generateToken(),
      keyId: seedKeys[0].keyId, // Active key
      invalidatedAt: baseTime - 2 * 60 * 60 * 1000, // 2 hours ago
      validatorId: 'VAL-ZH-CENTRAL-001',
      location: 'Zurich HB Platform 4',
    },
    {
      ticketId: generateToken(),
      keyId: seedKeys[1].keyId, // Active key
      invalidatedAt: baseTime - 1 * 60 * 60 * 1000, // 1 hour ago
      validatorId: 'VAL-BE-CENTRAL-001',
      location: 'Bern HB Platform 1',
    },
  ]
}

// Token Purchases (Backend records) - 5 total purchases
// These purchases should add up to the balances in SEED_USER_BALANCES
// User 1 (CARD_001_ABC123): 50 + 50 + 25 = 125 CHF
// User 2 (CARD_002_DEF456): 75 + 30 = 105 CHF
export const SEED_TOKEN_PURCHASES = [
  {
    accountId: 'account_user_001', // Private account ID (not card UID!) - corresponds to USER_1
    amount: 50,
    paymentMethod: 'cash',
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
  },
  {
    accountId: 'account_user_001',
    amount: 50,
    paymentMethod: 'credit_card',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
  },
  {
    accountId: 'account_user_002', // Private account ID - corresponds to USER_2
    amount: 75,
    paymentMethod: 'twint',
    timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago
  },
  {
    accountId: 'account_user_001',
    amount: 25,
    paymentMethod: 'cash',
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
  },
  {
    accountId: 'account_user_002',
    amount: 30,
    paymentMethod: 'credit_card',
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
  },
]

// ===== INITIALIZATION FUNCTION =====

/**
 * Initialize database with seed data
 * Call this on app startup
 * @param {number} baseTime - Base time to use for generating seed data (defaults to Date.now())
 */
export async function initializeSeedData(baseTime = Date.now()) {
  console.log('[SEED] Initializing seed data with baseTime:', new Date(baseTime).toLocaleString())

  try {
    // Generate fresh seed keys with current timestamps
    const seedKeys = getSeedKeys(baseTime)
    
    // 1. Create cryptographic keys
    console.log('[SEED] Creating cryptographic keys...')
    for (const key of seedKeys) {
      await saveCryptographicKey(key)
    }
    console.log(`[SEED] Created ${seedKeys.length} cryptographic keys`)

    // 2. Create user balances
    console.log('[SEED] Creating user balances...')
    for (const balanceRecord of SEED_USER_BALANCES) {
      await setUserBalance(balanceRecord.cardId, balanceRecord.balance)
    }
    console.log(`[SEED] Created ${SEED_USER_BALANCES.length} user balances`)

    // 3. Create user tickets
    console.log('[SEED] Creating user tickets...')
    const userTickets = getSeedUserTickets(baseTime)
    console.log('[SEED] Generated tickets:', userTickets.length)
    for (const ticket of userTickets) {
      try {
        await saveUserTicket(ticket)
        console.log('[SEED] Saved ticket:', ticket.ticketId.substring(0, 16) + '...', 'for card:', ticket.cardId)
      } catch (error) {
        console.error('[SEED] Error saving ticket:', error, ticket)
      }
    }
    console.log(`[SEED] Created ${userTickets.length} user tickets`)
    
    // Verify tickets were saved
    const { getAllUserTickets } = await import('./storage')
    const allSavedTickets = await getAllUserTickets()
    console.log('[SEED] Verification: Total tickets in DB:', allSavedTickets.length)

    // 4. Create invalidated tickets
    console.log('[SEED] Creating invalidated tickets...')
    const invalidatedTickets = getSeedInvalidatedTickets(baseTime)
    for (const invalidation of invalidatedTickets) {
      await saveInvalidatedTicket(invalidation)
    }
    console.log(`[SEED] Created ${invalidatedTickets.length} invalidated tickets`)

    // 5. Create token purchases
    console.log('[SEED] Creating token purchases...')
    for (const purchase of SEED_TOKEN_PURCHASES) {
      await saveTokenPurchase(purchase)
    }
    console.log(`[SEED] Created ${SEED_TOKEN_PURCHASES.length} token purchases`)

    // Notify all tabs that seed data initialization is complete
    // This ensures components refresh after all data is loaded
    // Use a delay to ensure all database writes are complete
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Send final notifications to ensure all components refresh
    // Send multiple times to ensure they're received (in case of timing issues)
    console.log('[SEED] Sending final notifications to refresh components...')
    notifyTabs('cryptographicKeys', 'update')
    notifyTabs('userTickets', 'update')
    notifyTabs('invalidatedTickets', 'update')
    notifyTabs('userBalances', 'update')
    notifyTabs('tokenPurchases', 'update')
    
    // Send again after a short delay to ensure components refresh
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('[SEED] Sending second round of notifications...')
    notifyTabs('cryptographicKeys', 'update')
    notifyTabs('userTickets', 'update')
    notifyTabs('invalidatedTickets', 'update')
    notifyTabs('userBalances', 'update')
    notifyTabs('tokenPurchases', 'update')
    
    // Send a third round after another delay to ensure BackendTab definitely refreshes
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('[SEED] Sending third round of notifications to force refresh...')
    notifyTabs('cryptographicKeys', 'update')
    notifyTabs('userTickets', 'update')
    notifyTabs('invalidatedTickets', 'update')
    notifyTabs('userBalances', 'update')
    notifyTabs('tokenPurchases', 'update')

    console.log('[SEED] Seed data initialization complete!')
    return true
  } catch (error) {
    console.error('[SEED] Error initializing seed data:', error)
    return false
  }
}

/**
 * Check if seed data already exists
 * @returns {Promise<boolean>} True if data exists
 */
export async function hasSeedData() {
  const keys = await getAllCryptographicKeys()
  const balances = await getAllUserBalances()
  return keys.length > 0 || balances.length > 0
}

