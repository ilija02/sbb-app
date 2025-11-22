import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { readFromCard } from '../lib/nfcSimulator'
import { verifySignature } from '../lib/crypto'
import { getPublicKey } from '../lib/api'

export default function TrainValidator() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('idle') // idle | reading | validating | valid | invalid
  const [cardData, setCardData] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [tapCardId, setTapCardId] = useState(searchParams.get('cardId') || '')

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

      if (!data.tickets || data.tickets.length === 0) {
        setStatus('invalid')
        setErrorMessage('No tickets on card')
        setTimeout(reset, 3000)
        return
      }

      setCardData(data)

      // Step 2: Validate first ticket
      setStatus('validating')
      await delay(200)

      const ticket = data.tickets[0]
      const now = Date.now()

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
      const signatureValid = verifySignature(ticket.ticket_id, ticket.signature, publicKey)

      if (!signatureValid) {
        setStatus('invalid')
        setErrorMessage('Invalid signature')
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // Step 4: Check revocation list (mock - always pass)
      const isRevoked = false // TODO: Check against cached revocation list

      if (isRevoked) {
        setStatus('invalid')
        setErrorMessage('Ticket has been revoked')
        setTicketInfo(ticket)
        setTimeout(reset, 4000)
        return
      }

      // SUCCESS - Log validation
      setStatus('valid')
      setTicketInfo(ticket)

      // Log to bloom filter (prevent reuse)
      console.log(`[BLOOM FILTER] Logged ticket_id: ${ticket.ticket_id}`)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">🎫 Platform Validator</h1>
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
                  <p>Card: {cardData.cardUid}</p>
                  <p>Tickets on card: {cardData.tickets.length}</p>
                </div>

                {/* Validation Logged */}
                <div className="mt-8 bg-green-900/30 border border-green-500 rounded-lg p-6">
                  <p className="text-green-300 text-lg font-semibold mb-2">✅ Validation Logged</p>
                  <p className="text-green-400 text-sm">
                    Ticket validated and recorded to bloom filter. Proceed to board train.
                  </p>
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
                    <div className="text-sm text-red-200 mt-3">
                      <p>Card: {cardData.cardUid}</p>
                    </div>
                  )}
                </div>

                <p className="text-gray-400">Please contact station staff</p>
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
              <li>Check revocation list (cached, 60KB)</li>
              <li>Grant access if valid (&lt;300ms total)</li>
            </ol>
          </div>

          <div className="bg-purple-900/50 border border-purple-700 rounded-lg p-4 text-sm">
            <h3 className="font-semibold text-purple-300 mb-2">🔐 Privacy:</h3>
            <ul className="text-purple-200 space-y-1 text-xs">
              <li>✅ Validator sees ticket_id only</li>
              <li>✅ Cannot link to payment method</li>
              <li>✅ Cannot link to purchase location</li>
              <li>✅ Validation logged but unlinkable</li>
              <li>✅ Works offline (cached public key)</li>
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
          </div>
        </div>
      </div>
    </div>
  )
}
