/**
 * NFC Simulator
 * Simulates physical NFC card read/write without hardware
 */

const STORAGE_KEY = 'sbb_virtual_cards';

/**
 * Load virtual cards from localStorage
 */
function loadCards() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
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
      uid: cardId,
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
  if (!card.applications || !card.applications["0x5342"]) {
    return {
      cardUid: card.uid,
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
    cardUid: card.uid,
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
