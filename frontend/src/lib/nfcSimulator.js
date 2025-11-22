/**
 * NFC Simulator
 * Simulates physical NFC card read/write without hardware
 */

// Simulated NFC card storage (in-memory for demo)
let virtualCards = {};

/**
 * Simulate writing ticket to NFC card
 * @param {string} cardId - Virtual card ID
 * @param {object} ticketData - Ticket data to write
 * @param {string} signature - HSM signature
 * @returns {Promise<boolean>}
 */
export async function writeToCard(cardId, ticketData, signature) {
  await delay(800); // Simulate NFC write delay

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

  return true;
}

/**
 * Simulate reading ticket from NFC card
 * @param {string} cardId - Virtual card ID
 * @returns {Promise<object|null>} Ticket data or null if card not found
 */
export async function readFromCard(cardId) {
  await delay(300); // Simulate NFC read delay

  const card = virtualCards[cardId];
  if (!card || !card.applications["0x5342"]) {
    return null;
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

  if (!virtualCards[cardId]) {
    virtualCards[cardId] = {
      uid: cardId,
      type: "Mifare DESFire EV3",
      applications: {},
      credits: 0,
    };
  }

  virtualCards[cardId].credits = (virtualCards[cardId].credits || 0) + amount;
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
  return card.credits;
}

/**
 * Get credit balance
 * @param {string} cardId - Virtual card ID
 * @returns {Promise<number>} Balance in CHF
 */
export async function getBalance(cardId) {
  await delay(200);

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
  return virtualCards[cardId] !== undefined;
}

/**
 * Get all virtual cards (for debug)
 * @returns {object}
 */
export function getAllCards() {
  return virtualCards;
}

/**
 * Clear all virtual cards (reset demo)
 * @returns {void}
 */
export function clearAllCards() {
  virtualCards = {};
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
