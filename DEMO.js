#!/usr/bin/env node

/**
 * Demo Script - Test All Features
 *
 * This script demonstrates the complete flow of the anonymous ticketing system
 * using the browser console.
 */

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        Anonymous Ticketing System - Feature Demo             ║
╚═══════════════════════════════════════════════════════════════╝

🎯 Features Implemented:
  ✅ Blind signature token generation
  ✅ Rotating cryptographic proofs (anti-screenshot)
  ✅ IndexedDB storage
  ✅ QR code generation with time-based epochs
  ✅ Online/offline validation
  ✅ Offline scan synchronization

📋 Test Instructions:

1. WALLET TESTING (http://localhost:5173/)
   ─────────────────────────────────────────
   a) Click "Single Journey" - generates 2-hour ticket
   b) Click "Day Ticket" - generates 24-hour ticket with Rx
      - Watch QR regenerate every 30 seconds
      - Note the countdown timer
      - Try screenshot (won't work after 30s!)
   e) Delete a ticket to test cleanup

2. VALIDATOR TESTING (Switch to Validator)
   ─────────────────────────────────────────
   a) Click "Simulate Valid" - see green success screen
   b) Click "Simulate Invalid" - see red failure screen
   c) Toggle "Go Offline" - test offline mode
   d) Validate tickets offline - watch counter increase
   e) Toggle "Go Online" - sync offline scans

3. STORAGE TESTING (Browser DevTools)
   ─────────────────────────────────────────
   a) Open DevTools (F12)
   b) Go to Application > IndexedDB > TicketWallet
   c) Inspect:
      - tokens store (your tickets)
      - masterSecrets store (RCP secrets)
      - offlineScans store (offline validations)

4. CONSOLE TESTING
   ─────────────────────────────────────────
   Open browser console and try:

   // Check storage stats
   import { getStorageStats } from './src/lib/storage.js'
   const stats = await getStorageStats()
   console.log(stats)

   // Generate rotating proof
   import { generateRotatingProof } from './src/lib/crypto.js'
   const proof = await generateRotatingProof('secret123', 30000)
   console.log('Proof:', proof)
   
   // Wait 30s and generate again - different proof!
   setTimeout(async () => {
     const proof2 = await generateRotatingProof('secret123', 30000)
     console.log('New proof:', proof2)
   }, 31000)

5. ROTATING PROOF DEMO
   ─────────────────────────────────────────
   a) Generate a Day Ticket
   b) Show QR Code
   c) Note the epoch number (bottom of QR)
   d) Wait for countdown to reach 0
   e) QR regenerates automatically!
   f) Epoch number increments
   g) Old screenshot is now invalid

6. MOCK API TESTING
   ─────────────────────────────────────────
   a) All API calls use mock data
   b) 90% success rate on redemption
   c) To test failures:
      - Run "Simulate Invalid" multiple times
      - Some will show "already spent"
   d) Check Network tab - no real API calls yet

7. OFFLINE MODE DEMO
   ─────────────────────────────────────────
   a) Go to Validator
   b) Click "Go Offline" (orange indicator)
   c) Click "Simulate Valid" 3 times
   d) Note "Sync Offline Logs (3)"
   e) Click "Go Online"
   f) Click "Sync Offline Logs"
   g) Counter resets to 0

🔧 Developer Commands:
  npm run dev      # Start dev server (already running)
  npm run build    # Build for production
  npm run preview  # Preview production build

📦 Key Files:
  src/lib/crypto.js          # Crypto & RCP logic
  src/lib/storage.js         # IndexedDB wrapper
  src/lib/api.js             # Mock API client
  src/components/RotatingQRCode.jsx  # QR with rotation
  src/pages/Wallet.jsx       # Passenger wallet
  src/pages/Validator.jsx    # Conductor scanner

🎓 Learning Points:
  - Blind signatures prevent linkability
  - Rotating proofs prevent screenshot sharing
  - IndexedDB enables offline functionality
  - Epoch-based system allows clock skew tolerance
  - Bloom filters enable offline validation

⚠️  Remember: This is using MOCK data!
  - Set MOCK_MODE=false in api.js when backend ready
  - Install @zxing/library for real QR scanning
  - Implement real RSA blind signatures

🚀 Next Steps:
  1. Test all features listed above
  2. Check IndexedDB in DevTools
  3. Try offline mode flow
  4. Generate day ticket and watch RCP rotation
  5. When ready: integrate with Developer A's backend

───────────────────────────────────────────────────────────────
Happy Testing! 🎉
───────────────────────────────────────────────────────────────
`);
