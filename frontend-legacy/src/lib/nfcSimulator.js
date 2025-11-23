/**
 * NFC Simulator
 * Simulates physical NFC card read/write without hardware
 * 
 * PRIVACY MODEL:
 * - publicUid: NFC protocol UID (always exposed to any reader)
 * - privateAccountId: HSM-protected account ID (requires authentication)
 * - Backend never sees publicUid (prevents tracking physical card movements)
 */

const STORAGE_KEY = 'sbb_virtual_cards';

/**
 * Generate cryptographic challenge for mutual authentication
 */
function generateChallenge() {
  return crypto.randomUUID();
}

/**
 * Compute HMAC for authentication (simplified - in production use proper crypto)
 */
async function computeHMAC(data, key) {
  // Simplified: In production, use Web Crypto API HMAC
  return crypto.randomUUID(); // Mock authentication response
}

/**
 * Load virtual cards from localStorage
 */
function loadCards() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const cards = stored ? JSON.parse(stored) : {};
    console.log('[STORAGE] Loaded cards from localStorage:', Object.keys(cards).length, 'cards');
    if (Object.keys(cards).length > 0) {
      console.log('[STORAGE] Card IDs:', Object.keys(cards));
      // Log ticket count for each card
      Object.entries(cards).forEach(([id, card]) => {
        const ticketCount = card.applications?.['0x5342']?.files ? 
          Math.floor(Object.keys(card.applications['0x5342'].files).length / 2) : 0;
        console.log(`[STORAGE]   - Card ${id}: ${card.credits} CHF, ${ticketCount} tickets`);
      });
    }
    return cards;
  } catch (error) {
    console.error('Failed to load cards from localStorage:', error);
    return {};
  }
}

/**
 * Save virtual cards to localStorage
 */
function saveCards(cards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    console.log('[STORAGE] Saved cards to localStorage:', Object.keys(cards).length, 'cards');
  } catch (error) {
    console.error('Failed to save cards to localStorage:', error);
  }
}

// Get cards from localStorage (persistent across page navigation)
let virtualCards = loadCards();

/**
 * Simulate writing ticket to NFC card
 * @param {string} cardId - Virtual card ID
 * @param {object} ticketData - Ticket data to write
 * @param {string} signature - HSM signature
 * @returns {Promise<boolean>}
 */
export async function writeToCard(cardId, ticketData, signature) {
  await delay(800); // Simulate NFC write delay

  // Reload from localStorage to get latest data
  virtualCards = loadCards();

  if (!virtualCards[cardId]) {
    virtualCards[cardId] = {
      // PUBLIC: NFC protocol UID (always exposed - can't be hidden)
      uid: cardId,
      publicUid: cardId, // Explicitly mark as public
      
      // PRIVATE: Account ID for backend operations (HSM protected)
      privateAccountId: crypto.randomUUID(),
      
      // Authentication key (stored in secure element on real card)
      cardAuthKey: crypto.randomUUID(),
      
      type: "Mifare DESFire EV3",
      applications: {},
      credits: 0, // Credit balance in CHF
    };
  }

  // Write to application 0x5342 (SBB)
  if (!virtualCards[cardId].applications["0x5342"]) {
    virtualCards[cardId].applications["0x5342"] = { files: {} };
  }

  const app = virtualCards[cardId].applications["0x5342"];
  const fileIndex = Object.keys(app.files).length;

  // Write ticket data and signature to sequential files
  app.files[fileIndex] = ticketData;
  app.files[fileIndex + 1] = { signature };

  // Persist to localStorage
  saveCards(virtualCards);

  return true;
}

/**
 * Simulate reading ticket from NFC card
 * @param {string} cardId - Virtual card ID
 * @returns {Promise<object|null>} Ticket data or null if card not found
 */
export async function readFromCard(cardId) {
  await delay(300); // Simulate NFC read delay

  // Reload from localStorage to get latest data
  virtualCards = loadCards();

  const card = virtualCards[cardId];
  if (!card) {
    return null;
  }

  // Return basic card info even if no tickets yet
  // NOTE: Only publicUid exposed here (cardUid) - privateAccountId requires auth
  if (!card.applications || !card.applications["0x5342"]) {
    return {
      cardUid: card.publicUid || card.uid, // Public UID only
      cardType: card.type,
      credits: card.credits || 0,
      tickets: [],
    };
  }

  const app = card.applications["0x5342"];
  const files = app.files;

  // Read all tickets from card (multi-use support)
  const tickets = [];
  const fileIndices = Object.keys(files).map(Number).sort();

  for (let i = 0; i < fileIndices.length; i += 2) {
    const ticketData = files[fileIndices[i]];
    const signatureData = files[fileIndices[i + 1]];

    if (ticketData && signatureData) {
      tickets.push({
        ...ticketData,
        signature: signatureData.signature,
      });
    }
  }

  return {
    cardUid: card.publicUid || card.uid, // Public UID only
    cardType: card.type,
    credits: card.credits || 0,
    tickets,
  };
}

/**
 * Add credits to card
 * @param {string} cardId - Virtual card ID
 * @param {number} amount - Amount in CHF to add
 * @returns {Promise<number>} New balance
 */
export async function addCredits(cardId, amount) {
  await delay(500); // Simulate NFC write delay

  // Reload from localStorage to get latest data
  virtualCards = loadCards();

  if (!virtualCards[cardId]) {
    virtualCards[cardId] = {
      uid: cardId,
      type: "Mifare DESFire EV3",
      applications: {},
      credits: 0,
    };
  }

  virtualCards[cardId].credits = (virtualCards[cardId].credits || 0) + amount;
  
  // Persist to localStorage
  saveCards(virtualCards);
  
  return virtualCards[cardId].credits;
}

/**
 * Deduct credits from card
 * @param {string} cardId - Virtual card ID
 * @param {number} amount - Amount in CHF to deduct
 * @returns {Promise<number>} New balance
 * @throws {Error} If insufficient credits
 */
export async function deductCredits(cardId, amount) {
  await delay(300);

  // Reload from localStorage to get latest data
  virtualCards = loadCards();

  const card = virtualCards[cardId];
  if (!card) {
    throw new Error("Card not found");
  }

  const currentBalance = card.credits || 0;
  if (currentBalance < amount) {
    throw new Error(
      `Insufficient credits. Balance: CHF ${currentBalance}, Required: CHF ${amount}`
    );
  }

  card.credits = currentBalance - amount;
  
  // Persist to localStorage
  saveCards(virtualCards);
  
  return card.credits;
}

/**
 * Get credit balance
 * @param {string} cardId - Virtual card ID
 * @returns {Promise<number>} Balance in CHF
 */
export async function getBalance(cardId) {
  await delay(200);

  // Reload from localStorage to get latest balance
  virtualCards = loadCards();

  const card = virtualCards[cardId];
  return card ? card.credits || 0 : 0;
}

/**
 * Generate a virtual card ID
 * @returns {string}
 */
export function generateVirtualCardId() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Create a new virtual card with dual-UID structure
 * @returns {object} { publicUid, privateAccountId }
 */
export function createVirtualCard() {
  const publicUid = generateVirtualCardId();
  
  virtualCards = loadCards();
  
  // Initialize new card with dual-UID structure
  virtualCards[publicUid] = {
    // PUBLIC: NFC protocol UID (always exposed)
    uid: publicUid,
    publicUid: publicUid,
    
    // PRIVATE: Account ID for backend operations (HSM protected)
    privateAccountId: crypto.randomUUID(),
    
    // Authentication key (stored in secure element on real card)
    cardAuthKey: crypto.randomUUID(),
    
    type: "Mifare DESFire EV3",
    applications: {},
    credits: 0,
  };
  
  saveCards(virtualCards);
  
  return {
    publicUid: publicUid,
    privateAccountId: virtualCards[publicUid].privateAccountId,
  };
}

/**
 * Check if card is present (for tap simulation)
 * @param {string} cardId
 * @returns {boolean}
 */
export function isCardPresent(cardId) {
  // Reload from localStorage to check latest data
  virtualCards = loadCards();
  return virtualCards[cardId] !== undefined;
}

/**
 * Get all virtual cards (for debug)
 * @returns {object}
 */
export function getAllCards() {
  // Reload from localStorage to ensure fresh data
  virtualCards = loadCards();
  return virtualCards;
}

/**
 * Clear all virtual cards (reset demo)
 * @returns {void}
 */
export function clearAllCards() {
  virtualCards = {};
  saveCards(virtualCards);
}

/**
 * Authenticate with card and get private account ID
 * @param {string} cardId - Public UID (NFC-exposed)
 * @param {string} readerType - 'kiosk' | 'validator' | 'conductor'
 * @returns {Promise<object>} { success, privateAccountId?, error? }
 */
export async function authenticateCard(cardId, readerType = 'kiosk') {
  await delay(200); // Simulate authentication delay
  
  virtualCards = loadCards();
  const card = virtualCards[cardId];
  
  if (!card) {
    return { success: false, error: 'Card not found' };
  }
  
  // Only authorized readers can access private account ID
  const authorizedReaders = ['kiosk']; // Validators don't need private ID
  
  if (!authorizedReaders.includes(readerType)) {
    return { 
      success: false, 
      error: 'Reader not authorized for private account access' 
    };
  }
  
  // Step 1: Reader sends challenge
  const readerChallenge = generateChallenge();
  
  // Step 2: Card responds with HMAC
  const cardResponse = await computeHMAC(readerChallenge, card.cardAuthKey);
  
  // Step 3: Reader verifies (simplified - in production do mutual auth)
  // In real implementation: card also verifies reader's identity
  
  // Step 4: Return private account ID over encrypted channel
  return {
    success: true,
    privateAccountId: card.privateAccountId,
    publicUid: card.publicUid || card.uid,
    cardAuthKey: card.cardAuthKey, // For session encryption
  };
}

/**
 * Get public card info (no authentication required)
 * @param {string} cardId - Public UID
 * @returns {Promise<object>} Public card data
 */
export async function getPublicCardInfo(cardId) {
  await delay(100);
  
  virtualCards = loadCards();
  const card = virtualCards[cardId];
  
  if (!card) {
    return null;
  }
  
  // Only return public information
  return {
    publicUid: card.publicUid || card.uid,
    cardType: card.type,
    hasTickets: card.applications?.["0x5042"] ? 
      Object.keys(card.applications["0x5042"].files || {}).length > 0 : false,
    // NOTE: Credits NOT exposed without authentication
  };
}

/**
 * Simulate NFC tap event
 * @param {string} cardId
 * @param {function} onTap - Callback with card data
 */
export function simulateTap(cardId, onTap) {
  setTimeout(async () => {
    const cardData = await readFromCard(cardId);
    onTap(cardData);
  }, 100);
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
