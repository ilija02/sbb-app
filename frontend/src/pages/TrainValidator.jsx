import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { readFromCard } from '../lib/nfcSimulator'
import { verifySignature } from '../lib/crypto'
import { getPublicKey, validateTicketOnline, queueOfflineValidation, recordValidation, checkNetworkStatus, syncPendingValidations } from '../lib/api'

export default function TrainValidator() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('idle') // idle | reading | validating | valid | invalid
  const [cardData, setCardData] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isOnline, setIsOnline] = useState(checkNetworkStatus())
  const [validationMode, setValidationMode] = useState('online') // online | offline

  const [tapCardId, setTapCardId] = useState(searchParams.get('cardId') || '')

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncPendingValidations()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    // Auto-tap if cardId in URL
    const cardId = searchParams.get('cardId')
    if (cardId && status === 'idle') {
      setTapCardId(cardId)
      setTimeout(() => handleTapCard(cardId), 1000)
    }
  }, [searchParams])

  const handleTapCard = async (cardId = tapCardId) => {
    if (!cardId.trim()) {
      alert('Please enter a card ID')
      return
    }

    setStatus('reading')
    setErrorMessage('')
    setCardData(null)
    setTicketInfo(null)

    try {
      // Step 1: Read from NFC card
      await delay(300)
      const data = await readFromCard(cardId)

      if (!data) {
        setStatus('invalid')
        setErrorMessage('Card not found')
        setTimeout(reset, 3000)
        return
      }

      setCardData(data)

      if (!data.tickets || data.tickets.length === 0) {
        setStatus('invalid')
        setErrorMessage(data.credits > 0 
          ? `Card has CHF ${data.credits} credits but no tickets. You need to: 1) Go to kiosk, 2) Select "Buy Ticket", 3) Choose a route, 4) Pay with your on-card credits. Then come back here to validate.`
          : 'No tickets on card. Go to the kiosk and purchase a ticket first.'
        )
        setTimeout(reset, 8000)
        return
      }

      // Step 2: Find most recent valid ticket (skip expired/used ones)
      setStatus('validating')
      await delay(200)

      const now = Date.now()
      
      // Find the first ticket that is currently valid (not expired, not too early)
      let ticket = null
      for (const t of data.tickets) {
        if (now >= t.valid_from && now <= t.valid_until) {
          ticket = t
          break
        }
      }
      
      // If no valid ticket found, check if all are expired or not yet valid
      if (!ticket) {
        const allExpired = data.tickets.every(t => now > t.valid_until)
        const allTooEarly = data.tickets.every(t => now < t.valid_from)
        
        setStatus('invalid')
        if (allExpired) {
          setErrorMessage('All tickets on card are expired')
        } else if (allTooEarly) {
          setErrorMessage('Tickets not yet valid')
        } else {
          setErrorMessage('No valid tickets found on card')
        }
        setTicketInfo(data.tickets[0]) // Show first ticket for reference
        setTimeout(reset, 5000)
        return
      }
      
      console.log('[VALIDATOR] Selected ticket:', {
        ticket_id: ticket.ticket_id.substring(0, 20) + '...',
        valid_from: new Date(ticket.valid_from).toLocaleString(),
        valid_until: new Date(ticket.valid_until).toLocaleString(),
        total_tickets_on_card: data.tickets.length
      })

      // Check expiry
      if (now > ticket.valid_until) {
        setStatus('invalid')
        setErrorMessage('Ticket expired')
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Check validity start
      if (now < ticket.valid_from) {
        setStatus('invalid')
        setErrorMessage('Ticket not yet valid')
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 3: Verify signature (offline)
      const publicKey = await getPublicKey()
      
      console.log('DEBUG: Verifying ticket:', {
        ticket_id: ticket.ticket_id?.substring(0, 20) + '...',
        signature: ticket.signature,
        signatureType: typeof ticket.signature,
        publicKey
      })
      
      const signatureValid = verifySignature(ticket.ticket_id, ticket.signature, publicKey)
      
      console.log('DEBUG: Signature valid?', signatureValid)

      if (!signatureValid) {
        setStatus('invalid')
        setErrorMessage(`Invalid signature (sig: ${ticket.signature?.substring(0, 20)}...)`)
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 4: Online validation (check for duplicates, fraud)
      const validatorId = 'VAL-ZH-CENTRAL-001' // Mock validator ID
      const location = 'Zurich HB Platform 4'

      let onlineResult = null
      let usedOfflineMode = false

      if (isOnline) {
        try {
          setValidationMode('online')
          onlineResult = await validateTicketOnline(ticket, validatorId, location, 'platform')
          
          console.log('[ONLINE] Validation result:', onlineResult)

          if (!onlineResult.valid) {
            setStatus('invalid')
            setErrorMessage(onlineResult.message || 'Ticket rejected by server')
            setTicketInfo(ticket)
            
            // Record for statistics
            recordValidation(ticket, validatorId, location, 'platform')
            
            setTimeout(reset, 5000)
            return
          }

          // Record successful validation
          recordValidation(ticket, validatorId, location, 'platform')

          // Show warning for day passes with excessive use
          if (onlineResult.warning) {
            console.warn(`[WARNING] ${onlineResult.message}`)
          }

        } catch (error) {
          console.warn('[ONLINE] Validation failed, falling back to offline:', error)
          setIsOnline(false) // Treat as offline for this session
          usedOfflineMode = true
        }
      }

      // Offline fallback: Local bloom filter check
      if (!isOnline || usedOfflineMode) {
        setValidationMode('offline')
        console.log('[OFFLINE] Using local validation')

        // For single tickets: Check local bloom filter
        if (ticket.ticket_type === 'single') {
          const bloomFilter = getLocalBloomFilter()
          if (bloomFilter.has(ticket.ticket_id)) {
            setStatus('invalid')
            setErrorMessage('Ticket already used (offline check)')
            setTicketInfo(ticket)
            
            // Queue for backend review when online
            queueOfflineValidation(ticket, validatorId, location, 'duplicate_offline')
            
            setTimeout(reset, 5000)
            return
          }
          bloomFilter.add(ticket.ticket_id)
          saveLocalBloomFilter(bloomFilter)
        }

        // Queue validation for backend sync
        queueOfflineValidation(ticket, validatorId, location, 'valid_offline')
        recordValidation(ticket, validatorId, location, 'platform')
      }

      // SUCCESS
      setStatus('valid')
      setTicketInfo({
        ...ticket,
        validation_mode: validationMode,
        online_result: onlineResult
      })

      // Reset after 4 seconds
      setTimeout(reset, 4000)

    } catch (error) {
      console.error('Validation error:', error)
      setStatus('invalid')
      setErrorMessage('System error: ' + error.message)
      setTimeout(reset, 3000)
    }
  }

  const reset = () => {
    setStatus('idle')
    setCardData(null)
    setTicketInfo(null)
    setErrorMessage('')
    setTapCardId('')
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Bloom filter helpers (simple Set for demo)
  const getLocalBloomFilter = () => {
    const stored = localStorage.getItem('bloom_filter')
    return stored ? new Set(JSON.parse(stored)) : new Set()
  }

  const saveLocalBloomFilter = (bloomFilter) => {
    localStorage.setItem('bloom_filter', JSON.stringify([...bloomFilter]))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🎫 Platform Validator</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-sm text-gray-300">
                {isOnline ? '🌐 Online Mode' : '📡 Offline Mode'} 
                {!isOnline && ' - Validations queued for sync'}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/kiosk" className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              ← Back to Kiosk
            </Link>
            <Link to="/validator" className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
              Conductor Handheld
            </Link>
          </div>
        </div>

        {/* Main Validator Display */}
        <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden border-4 border-slate-700 min-h-[500px]">
          
          {/* Status Header */}
          <div className={`p-4 ${
            status === 'valid' ? 'bg-green-600' :
            status === 'invalid' ? 'bg-red-600' :
            status === 'reading' || status === 'validating' ? 'bg-yellow-600' :
            'bg-slate-700'
          } transition-colors duration-300`}>
            <div className="text-center">
              <p className="text-white text-xl font-semibold">
                {status === 'idle' && '⏳ Waiting for Card Tap'}
                {status === 'reading' && '📖 Reading Card...'}
                {status === 'validating' && '🔍 Validating Ticket...'}
                {status === 'valid' && '✅ TICKET VALID - WELCOME'}
                {status === 'invalid' && '❌ ACCESS DENIED'}
              </p>
            </div>
          </div>

          {/* Main Display Area */}
          <div className="p-8">
            
            {/* Idle State - Tap Prompt */}
            {status === 'idle' && (
              <div className="text-center py-12">
                <div className="text-9xl mb-6 animate-pulse">📱</div>
                <h2 className="text-4xl font-bold text-white mb-4">Validate Your Ticket</h2>
                
                <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-6 max-w-lg mx-auto mb-8">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className="text-5xl">📶</span>
                    <span className="text-5xl">💳</span>
                    <span className="text-5xl">�</span>
                  </div>
                  <p className="text-yellow-300 text-lg font-semibold mb-2">
                    Tap Card or Phone on NFC Target
                  </p>
                  <p className="text-yellow-400 text-sm">
                    Brief tap (less than 1 second) - touch and lift
                  </p>
                </div>

                {/* Demo Input */}
                <div className="max-w-md mx-auto bg-slate-700 p-6 rounded-lg">
                  <p className="text-gray-300 text-sm mb-3">🎮 Demo Mode: Enter Virtual Card ID</p>
                  <input
                    type="text"
                    value={tapCardId}
                    onChange={(e) => setTapCardId(e.target.value)}
                    placeholder="Card ID (from kiosk)"
                    className="w-full px-4 py-2 bg-slate-800 text-white border border-slate-600 rounded-lg mb-3 font-mono text-sm"
                  />
                  <button
                    onClick={() => handleTapCard()}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    📱 Simulate Tap
                  </button>
                </div>
              </div>
            )}

            {/* Reading/Validating State */}
            {(status === 'reading' || status === 'validating') && (
              <div className="text-center py-16">
                <div className="animate-spin text-8xl mb-6">⚙️</div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {status === 'reading' ? 'Reading NFC Card...' : 'Verifying Signature...'}
                </h2>
                <div className="space-y-2 text-gray-400">
                  {status === 'reading' && (
                    <>
                      <p>✓ Card detected</p>
                      <p>→ Reading ticket data...</p>
                    </>
                  )}
                  {status === 'validating' && (
                    <>
                      <p>✓ Ticket data read</p>
                      <p>✓ Checking expiry...</p>
                      <p>→ Verifying HSM signature...</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Valid State - Green Screen */}
            {status === 'valid' && ticketInfo && (
              <div className="text-center py-12">
                <div className="text-9xl mb-6 animate-bounce">✅</div>
                <h2 className="text-5xl font-bold text-green-400 mb-6">VALID TICKET</h2>
                
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
                  </div>
                </div>

                <div className="text-gray-400 text-sm mb-4">
                  {/* PRIVACY: Don't show card UID - only ticket info */}
                  <p>Tickets found: {cardData.tickets.length}</p>
                </div>

                {/* Validation Logged */}
                <div className="mt-8 bg-green-900/30 border border-green-500 rounded-lg p-6">
                  <p className="text-green-300 text-lg font-semibold mb-2">
                    ✅ Validation Logged {ticketInfo.validation_mode === 'online' ? '🌐' : '📡'}
                  </p>
                  <p className="text-green-400 text-sm">
                    {ticketInfo.validation_mode === 'online' 
                      ? 'Ticket validated online. Backend confirmed - no duplicates detected.'
                      : 'Ticket validated offline. Will sync with backend when connection available.'
                    }
                  </p>
                  {ticketInfo.online_result?.warning && (
                    <p className="text-yellow-400 text-sm mt-2">
                      ⚠️ {ticketInfo.online_result.message}
                    </p>
                  )}
                  {ticketInfo.online_result?.validation_count > 1 && ticketInfo.ticket_type === 'day' && (
                    <p className="text-blue-400 text-xs mt-2">
                      📊 Day pass - Validation #{ticketInfo.online_result.validation_count} today
                    </p>
                  )}
                  <p className="text-green-500 text-xs mt-3">
                    Honor system: Random conductor checks may occur during ride.
                  </p>
                </div>
              </div>
            )}

            {/* Invalid State - Red Screen */}
            {status === 'invalid' && (
              <div className="text-center py-12">
                <div className="text-9xl mb-6">❌</div>
                <h2 className="text-5xl font-bold text-red-400 mb-6">ACCESS DENIED</h2>
                
                <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-6 max-w-xl mx-auto mb-6">
                  <p className="text-red-300 text-xl font-semibold mb-3">{errorMessage}</p>
                  
                  {ticketInfo && (
                    <div className="text-left text-sm space-y-2 text-red-200 border-t border-red-700 pt-4 mt-4">
                      <p>Ticket ID: {ticketInfo.ticket_id?.substring(0, 16)}...</p>
                      <p>Route: {ticketInfo.route}</p>
                      <p>Valid From: {formatTime(ticketInfo.valid_from)}</p>
                      <p>Valid Until: {formatTime(ticketInfo.valid_until)}</p>
                      <p className="font-semibold text-red-300">
                        {Date.now() > ticketInfo.valid_until ? '⚠️ EXPIRED' : ''}
                      </p>
                    </div>
                  )}

                  {cardData && (
                    <div className="text-sm text-yellow-200 border-t border-red-700 pt-3 mt-3">
                      {/* PRIVACY: Don't show card UID */}
                      {cardData.credits > 0 && (
                        <p className="mt-2 text-yellow-300 font-semibold">
                          💰 Card Balance: CHF {cardData.credits}
                        </p>
                      )}
                      {cardData.credits > 0 && errorMessage.includes('no ticket') && (
                        <p className="mt-2 text-yellow-400 text-xs">
                          ℹ️ You have credits but need to purchase a ticket at the kiosk first
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {cardData && cardData.credits > 0 && errorMessage.includes('no ticket') ? (
                  <Link
                    to={`/kiosk?cardId=${tapCardId}`}
                    className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    → Purchase Ticket at Kiosk (CHF {cardData.credits} available)
                  </Link>
                ) : (
                  <p className="text-gray-400">Please contact station staff</p>
                )}
              </div>
            )}
          </div>

          {/* Status LEDs */}
          <div className="bg-slate-900 p-4 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${
                status === 'valid' ? 'bg-green-500 animate-pulse' : 'bg-gray-700'
              }`}></div>
              <span className="text-gray-400 text-sm">Valid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${
                status === 'reading' || status === 'validating' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-700'
              }`}></div>
              <span className="text-gray-400 text-sm">Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${
                status === 'invalid' ? 'bg-red-500 animate-pulse' : 'bg-gray-700'
              }`}></div>
              <span className="text-gray-400 text-sm">Invalid</span>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 text-sm">
            <h3 className="font-semibold text-blue-300 mb-2">✅ Validation Process:</h3>
            <ol className="text-blue-200 space-y-1 list-decimal list-inside text-xs">
              <li>Read ticket from NFC card (ISO 14443-A)</li>
              <li>Check expiry (current_time &lt; valid_until)</li>
              <li>Verify HSM signature (offline, cached public key)</li>
              <li><strong>🌐 Online check:</strong> Duplicate detection, fraud scoring</li>
              <li><strong>📡 Offline fallback:</strong> Local Bloom filter + queue for sync</li>
              <li>Grant access if valid (&lt;500ms online, &lt;200ms offline)</li>
            </ol>
          </div>

          <div className="bg-purple-900/50 border border-purple-700 rounded-lg p-4 text-sm">
            <h3 className="font-semibold text-purple-300 mb-2">🔐 Fraud Detection:</h3>
            <ul className="text-purple-200 space-y-1 text-xs">
              <li>🌐 <strong>Online:</strong> Real-time duplicate detection across all validators</li>
              <li>📊 Day pass rate limiting (max 20 validations/day)</li>
              <li>🚨 Single ticket reuse detection (same ticket, multiple validators)</li>
              <li>📡 <strong>Offline:</strong> Local Bloom filter + deferred sync</li>
              <li>⚡ Fraud reported to backend when connection available</li>
              <li>✅ Privacy preserved: Only ticket_id logged, not identity</li>
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 bg-slate-800 rounded-lg p-4">
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Reset
            </button>
            <Link
              to="/kiosk"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Buy Another Ticket
            </Link>
            <button
              onClick={() => {
                syncPendingValidations()
                alert('Sync initiated. Check console for results.')
              }}
              disabled={!isOnline}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition"
            >
              🔄 Sync Now
            </button>
            <button
              onClick={() => {
                const newStatus = !isOnline
                setIsOnline(newStatus)
                window.dispatchEvent(new Event(newStatus ? 'online' : 'offline'))
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs"
            >
              🔧 Simulate {isOnline ? 'Offline' : 'Online'}
            </button>
          </div>
        </div>

        {/* Debug Panel - Offline Queue & Fraud Detection */}
        <div className="mt-4 bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-white mb-3">🔧 Debug: Validation Queue & Fraud Detection</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Pending Validations */}
            <div className="bg-slate-700 rounded p-3">
              <p className="text-yellow-300 font-semibold mb-2">📡 Pending Sync</p>
              <div className="font-mono text-xs text-gray-300 max-h-32 overflow-auto">
                {(() => {
                  const pending = JSON.parse(localStorage.getItem('pending_validations') || '[]');
                  const unsynced = pending.filter(v => !v.synced);
                  if (unsynced.length === 0) {
                    return <p className="text-gray-500">No pending validations</p>;
                  }
                  return (
                    <div className="space-y-1">
                      {unsynced.map((v, i) => (
                        <div key={i} className="border-l-2 border-yellow-500 pl-2">
                          <p>Ticket: {v.ticket_id?.substring(0, 12)}...</p>
                          <p className="text-gray-400 text-xs">
                            {new Date(v.timestamp).toLocaleTimeString()} - {v.local_result}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Fraud Log */}
            <div className="bg-slate-700 rounded p-3">
              <p className="text-red-300 font-semibold mb-2">🚨 Fraud Detected</p>
              <div className="font-mono text-xs text-gray-300 max-h-32 overflow-auto">
                {(() => {
                  const fraudLog = JSON.parse(localStorage.getItem('fraud_log') || '[]');
                  if (fraudLog.length === 0) {
                    return <p className="text-gray-500">No fraud detected</p>;
                  }
                  return (
                    <div className="space-y-1">
                      {fraudLog.slice(-5).map((f, i) => (
                        <div key={i} className="border-l-2 border-red-500 pl-2">
                          <p className="text-red-400">{f.fraud_type}</p>
                          <p className="text-gray-400 text-xs">
                            {f.ticket_id?.substring(0, 12)}... at {f.location}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            💾 Offline validations are queued and synced when network available. Fraud detected during sync.
          </p>
        </div>
      </div>
    </div>
  )
}
