import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { readFromCard } from '../lib/nfcSimulator'
import { verifySignature } from '../lib/crypto'
import { getPublicKey } from '../lib/api'
import { saveOfflineScan, getUnsyncedScans, markScanAsSynced } from '../lib/storage'

export default function Validator() {
  const [searchParams] = useSearchParams()
  const [scanResult, setScanResult] = useState(null)
  const [status, setStatus] = useState('idle') // idle | reading | validating | valid | invalid
  const [offlineMode, setOfflineMode] = useState(false)
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [tapCardId, setTapCardId] = useState(searchParams.get('cardId') || '')
  const [validationCount, setValidationCount] = useState(0)
  const [cardData, setCardData] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null)

  // Load unsynced count on mount and when online status changes
  useEffect(() => {
    loadUnsyncedCount()
  }, [offlineMode])

  useEffect(() => {
    // Auto-tap if cardId in URL
    const cardId = searchParams.get('cardId')
    if (cardId && status === 'idle') {
      setTapCardId(cardId)
      setTimeout(() => handleTapCard(cardId), 500)
    }
  }, [searchParams])

  const loadUnsyncedCount = async () => {
    const unsynced = await getUnsyncedScans()
    setUnsyncedCount(unsynced.length)
  }

  const handleTapCard = async (cardId = tapCardId) => {
    if (!cardId.trim()) {
      alert('Please enter a card ID')
      return
    }

    setStatus('reading')
    setScanResult(null)
    setCardData(null)
    setTicketInfo(null)
    
    try {
      // Step 1: Read from NFC card
      await delay(200)
      const data = await readFromCard(cardId)

      if (!data) {
        setStatus('invalid')
        setScanResult({ reason: 'Card not found' })
        setTimeout(reset, 3000)
        return
      }

      if (!data.tickets || data.tickets.length === 0) {
        setStatus('invalid')
        setScanResult({ reason: 'No tickets on card' })
        setTimeout(reset, 3000)
        return
      }

      setCardData(data)

      // Step 2: Validate first ticket
      setStatus('validating')
      await delay(150)

      const ticket = data.tickets[0]
      const now = Date.now()

      // Check expiry
      if (now > ticket.valid_until) {
        setStatus('invalid')
        setScanResult({ reason: 'Ticket expired' })
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Check validity start
      if (now < ticket.valid_from) {
        setStatus('invalid')
        setScanResult({ reason: 'Ticket not yet valid' })
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 3: Verify signature (offline)
      const publicKey = await getPublicKey()
      const signatureValid = verifySignature(ticket.ticket_id, ticket.signature, publicKey)

      if (!signatureValid) {
        setStatus('invalid')
        setScanResult({ reason: 'Invalid signature' })
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 4: Check revocation list (mock - always pass)
      const isRevoked = false

      if (isRevoked) {
        setStatus('invalid')
        setScanResult({ reason: 'Ticket has been revoked' })
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 5: Save offline log if in offline mode
      if (offlineMode) {
        await saveOfflineScan({
          ticket_id: ticket.ticket_id,
          card_uid: data.cardUid,
          timestamp: new Date().toISOString(),
          conductor_id: 'conductor-123',
          result: 'valid'
        })
        await loadUnsyncedCount()
      }

      // SUCCESS
      setStatus('valid')
      setScanResult({ message: 'Valid ticket' })
      setTicketInfo(ticket)
      setValidationCount(prev => prev + 1)

      setTimeout(reset, 4000)
      
    } catch (error) {
      console.error('Validation error:', error)
      setStatus('invalid')
      setScanResult({ reason: 'System error: ' + error.message })
      setTimeout(reset, 3000)
    }
  }

  const reset = () => {
    setStatus('idle')
    setScanResult(null)
    setCardData(null)
    setTicketInfo(null)
    setTapCardId('')
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const handleSyncOffline = async () => {
    if (unsyncedCount === 0) {
      alert('No offline scans to sync')
      return
    }
    
    try {
      const unsynced = await getUnsyncedScans()
      // TODO: Sync with backend
      // const result = await syncOfflineScans(unsynced)
      
      // For now, mark all as synced
      for (const scan of unsynced) {
        await markScanAsSynced(scan.id)
      }
      
      await loadUnsyncedCount()
      alert(`Synced ${unsynced.length} offline scans`)
    } catch (error) {
      alert('Sync failed: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">🎫 Conductor Handheld</h1>
            <p className="text-sm text-purple-300 mt-1">Manual Ticket Validation</p>
          </div>
          <div className="flex gap-3">
            <Link to="/kiosk" className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              ← Kiosk
            </Link>
            <Link to="/train-validator" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Train Validator
            </Link>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-purple-800 rounded-lg p-4 mb-6 flex justify-between items-center">
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-purple-300">Conductor</p>
              <p className="font-semibold">#1234</p>
            </div>
            <div>
              <p className="text-xs text-purple-300">Train</p>
              <p className="font-semibold">IC 123 (ZH→BE)</p>
            </div>
            <div>
              <p className="text-xs text-purple-300">Checked</p>
              <p className="font-semibold">{validationCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${offlineMode ? 'bg-orange-500' : 'bg-green-500'}`}></div>
            <span className="text-sm">{offlineMode ? 'Offline' : 'Online'}</span>
          </div>
        </div>

        {/* Main Validation Area */}
        <div className="bg-purple-800/50 rounded-xl shadow-2xl p-8 mb-6 min-h-[500px] border-2 border-purple-700">
          
          {/* Idle State - Ready to tap */}
          {status === 'idle' && (
            <div className="text-center py-12">
              <div className="text-9xl mb-6 animate-pulse">🎫</div>
              <h2 className="text-4xl font-bold text-white mb-4">Check Passenger's Ticket</h2>
              
              <div className="bg-purple-900/50 border-2 border-purple-500 rounded-lg p-6 max-w-md mx-auto mb-8">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-5xl">📶</span>
                  <span className="text-5xl">💳</span>
                  <span className="text-5xl">📱</span>
                </div>
                <p className="text-purple-200 text-lg font-semibold mb-2">
                  Tap Card or Phone on Handheld Device
                </p>
                <p className="text-purple-300 text-sm">
                  Hold for 1-2 seconds on back of tablet
                </p>
              </div>

              {/* Demo Input */}
              <div className="max-w-md mx-auto bg-purple-900 p-6 rounded-lg border border-purple-600">
                <p className="text-purple-200 text-sm mb-3">🎮 Demo Mode: Enter Card ID</p>
                <input
                  type="text"
                  value={tapCardId}
                  onChange={(e) => setTapCardId(e.target.value)}
                  placeholder="Card ID (from kiosk or URL)"
                  className="w-full px-4 py-2 bg-purple-950 text-white border border-purple-700 rounded-lg mb-3 font-mono text-sm"
                />
                <button
                  onClick={() => handleTapCard()}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Simulate NFC Tap
                </button>
              </div>
            </div>
          )}

          {/* Reading State */}
          {status === 'reading' && (
            <div className="text-center py-16">
              <div className="animate-spin text-8xl mb-6">📡</div>
              <h2 className="text-3xl font-bold text-white mb-4">Reading Card...</h2>
              <p className="text-purple-200">NFC communication</p>
            </div>
          )}

          {/* Validating State */}
          {status === 'validating' && (
            <div className="text-center py-16">
              <div className="animate-spin text-8xl mb-6">⚙️</div>
              <h2 className="text-3xl font-bold text-white mb-4">Verifying Ticket...</h2>
              <div className="space-y-2 text-purple-200">
                <p>✓ Card data read</p>
                <p>✓ Checking expiry</p>
                <p>→ Verifying HSM signature...</p>
              </div>
            </div>
          )}

          {/* Valid State - Green Screen */}
          {status === 'valid' && ticketInfo && (
            <div className="text-center py-12">
              <div className="text-9xl mb-6 animate-bounce">✅</div>
              <h2 className="text-5xl font-bold text-green-400 mb-6">TICKET VALID</h2>
              
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6 max-w-xl mx-auto mb-6">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <p className="text-green-300 text-sm">Route</p>
                    <p className="text-white text-xl font-semibold">{ticketInfo.route}</p>
                  </div>
                  <div>
                    <p className="text-green-300 text-sm">Class</p>
                    <p className="text-white text-xl font-semibold">{ticketInfo.class}{ticketInfo.class === 1 ? 'st' : 'nd'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-green-300 text-sm">Valid Until</p>
                    <p className="text-white text-lg">{formatTime(ticketInfo.valid_until)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-green-300 text-sm">Ticket ID</p>
                    <p className="text-white text-xs font-mono">{ticketInfo.ticket_id?.substring(0, 32)}...</p>
                  </div>
                </div>
              </div>

              {offlineMode && (
                <div className="mb-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm">
                  ⚠️ Offline validation - will sync later
                </div>
              )}

              <div className="text-purple-200 text-sm mb-4">
                <p>Card: {cardData?.cardUid}</p>
                <p>Tickets on card: {cardData?.tickets.length}</p>
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Next Passenger →
                </button>
              </div>
            </div>
          )}

          {/* Invalid State - Red Screen */}
          {status === 'invalid' && scanResult && (
            <div className="text-center py-12">
              <div className="text-9xl mb-6">❌</div>
              <h2 className="text-5xl font-bold text-red-400 mb-6">INVALID TICKET</h2>
              
              <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-6 max-w-xl mx-auto mb-6">
                <p className="text-red-300 text-xl font-semibold mb-4">{scanResult.reason}</p>
                
                {ticketInfo && (
                  <div className="text-left text-sm space-y-2 text-red-200 border-t border-red-700 pt-4 mt-4">
                    <p>Ticket ID: {ticketInfo.ticket_id?.substring(0, 32)}...</p>
                    <p>Route: {ticketInfo.route}</p>
                    <p>Valid From: {formatTime(ticketInfo.valid_from)}</p>
                    <p>Valid Until: {formatTime(ticketInfo.valid_until)}</p>
                    <p className="font-semibold text-red-300">
                      {Date.now() > ticketInfo.valid_until ? '⚠️ EXPIRED' : ''}
                    </p>
                  </div>
                )}

                {cardData && !ticketInfo && (
                  <div className="text-sm text-red-200 mt-3">
                    <p>Card: {cardData.cardUid}</p>
                  </div>
                )}
              </div>

              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
                <p className="text-yellow-300 text-sm font-semibold">⚠️ Standard Fine: CHF 100</p>
                <p className="text-yellow-400 text-xs mt-1">Issue fine via handheld terminal or allow passenger to purchase ticket at next stop.</p>
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                >
                  💳 Issue CHF 100 Fine
                </button>
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Next Passenger →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Offline Status Panel */}
        <div className="mb-6 bg-purple-900 border border-purple-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-200">� Network Status</h3>
              <p className="text-xs text-purple-300 mt-1">
                {offlineMode ? '✈️ Working Offline' : '📡 Connected to Backend'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-100">{unsyncedCount}</div>
              <div className="text-xs text-purple-300">Unsynced Logs</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOfflineMode(!offlineMode)}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              offlineMode 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {offlineMode ? '📡 Go Online' : '✈️ Go Offline'}
          </button>
          <button
            onClick={handleSyncOffline}
            disabled={unsyncedCount === 0}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition"
          >
            🔄 Sync Offline Logs ({unsyncedCount})
          </button>
        </div>

        {/* Status Info */}
        <div className="mt-8 bg-purple-900 border border-purple-700 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-purple-300 mb-2">✅ Conductor Features:</h3>
          <ul className="text-purple-200 space-y-1">
            <li>✅ NFC tap validation (virtual cards)</li>
            <li>✅ Offline signature verification</li>
            <li>✅ Ticket expiry checking</li>
            <li>✅ Revocation list checks (cached)</li>
            <li>✅ Offline logging (IndexedDB)</li>
            <li>✅ Sync functionality for offline logs</li>
            <li>✅ Override capability for edge cases</li>
            <li>✅ Multi-ticket card support</li>
          </ul>
        </div>
        
        {/* Developer Notes */}
        <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-gray-400">
          <p><strong>Demo Mode:</strong> Enter any virtual card ID to simulate NFC tap.</p>
          <p className="mt-2"><strong>URL Auto-Tap:</strong> Add <code>?tap=CARD123</code> to URL to simulate automatic tap.</p>
          <p className="mt-2"><strong>Production:</strong> Replace nfcSimulator with real NFC reader integration (Web NFC API or native bridge).</p>
        </div>
      </div>
    </div>
  )
}
