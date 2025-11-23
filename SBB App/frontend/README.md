# SBB Ticketing Demo - New Implementation

Single-page application with 4 tabs for hackathon demo.

## Structure

```
frontend-new/
├── src/
│   ├── App.jsx              # Main app with 4-tab navigation
│   ├── main.jsx             # React entry point
│   ├── index.css            # Tailwind CSS
│   ├── components/
│   │   ├── BackendTab.jsx   # Backend view (keys, invalidations, purchases)
│   │   ├── ValidatorTab.jsx # Validator view (validate & regenerate cards)
│   │   ├── UserDeviceTab.jsx # User view (tokens & tickets)
│   │   └── KioskTab.jsx     # Kiosk view (buy tokens)
│   └── lib/
│       ├── storage.js       # Complete IndexedDB storage (6 stores)
│       └── crypto.js        # Blind signature utilities (mock)
```

## Storage Structure

### User Device Stores
- `VIRTUAL_TOKENS` - Virtual currency tokens on user device
- `USER_TICKETS` - Tickets purchased by user

### Backend Stores
- `CRYPTOGRAPHIC_KEYS` - Rotating signing keys
- `INVALIDATED_TICKETS` - Invalidated tickets (active keys only)
- `TOKEN_PURCHASES` - Token purchase records

### Validator Store
- `VALIDATOR_INVALIDATION_QUEUE` - Queue for offline sync

## Installation

```bash
cd frontend-new
npm install
npm run dev
```

## Next Steps

1. Implement KioskTab - Buy virtual tokens
2. Implement UserDeviceTab - View tokens, buy tickets
3. Implement ValidatorTab - Validate tickets, regenerate cards
4. Implement BackendTab - View keys, invalidations, purchases
5. Add key rotation system
6. Implement card regeneration logic

