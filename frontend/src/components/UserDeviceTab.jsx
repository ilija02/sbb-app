/**
 * User Device Tab - View tokens and tickets
 */

import { useState, useEffect } from 'react'
import { 
  getUserBalance,
  getUserTicketsForCard,
  getAllUserTickets,
  subscribeToChanges,
  deductFromUserBalance,
  saveUserTicket,
  getActiveCryptographicKey,
  saveTokenPurchase,
  getUsageTokensForCard
} from '../lib/storage'
import { DEMO_CARD_IDS, initializeSeedData } from '../lib/seedData'
import { generateToken, blindToken, unblindSignature } from '../lib/crypto'

export default function UserDeviceTab({ validatorTime }) {
  const [selectedCardId, setSelectedCardId] = useState(DEMO_CARD_IDS.USER_1)
  const [deviceType, setDeviceType] = useState('phone') // 'phone' or 'card'
  const [tickets, setTickets] = useState([])
  const [usageTokens, setUsageTokens] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseMessage, setPurchaseMessage] = useState(null)
  const [ticketType, setTicketType] = useState('single')
  const [route, setRoute] = useState('ZH-BE')
  const [ticketClass, setTicketClass] = useState(2)

  // Load data only when card changes or stores change (not on validatorTime)
  useEffect(() => {
    loadData()
  }, [selectedCardId])

  // Listen for cross-tab changes - update incrementally without loading state
  useEffect(() => {
    const unsubscribe = subscribeToChanges((change) => {
      // Update data when relevant stores change (without loading spinner)
      if (change.store === 'userTickets' || change.store === 'userBalances' || change.store === 'usageTokens') {
        console.log('[UserDevice] Cross-tab change detected, updating data...')
        updateDataIncrementally()
      }
    })
    return unsubscribe
  }, [selectedCardId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get card balance from backend (CHF)
      const cardBalance = await getUserBalance(selectedCardId)
      setBalance(cardBalance)
      
      // Load tickets for selected card
      const cardTickets = await getUserTicketsForCard(selectedCardId)
      console.log('[UserDevice] Loaded tickets for card', selectedCardId, ':', cardTickets.length, 'tickets')
      console.log('[UserDevice] Ticket details:', cardTickets)
      setTickets(cardTickets)

      // Load usage tokens for selected card
      const tokens = await getUsageTokensForCard(selectedCardId)
      setUsageTokens(tokens)
    } catch (error) {
      console.error('Error loading user device data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Incremental update without loading state (preserves scroll position)
  const updateDataIncrementally = async () => {
    try {
      // Get card balance from backend (CHF)
      const cardBalance = await getUserBalance(selectedCardId)
      setBalance(cardBalance)
      
      // Load tickets for selected card
      const cardTickets = await getUserTicketsForCard(selectedCardId)
      setTickets(cardTickets)

      // Load usage tokens for selected card
      const tokens = await getUsageTokensForCard(selectedCardId)
      setUsageTokens(tokens)
    } catch (error) {
      console.error('Error updating user device data:', error)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatTimeRemaining = (validUntil) => {
    const now = validatorTime || Date.now()
    const remaining = validUntil - now
    
    if (remaining < 0) return 'Expired'
    
    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const isTicketValid = (ticket) => {
    const now = validatorTime || Date.now()
    return now >= ticket.validFrom && now <= ticket.validUntil
  }

  const isTicketExpired = (ticket) => {
    const now = validatorTime || Date.now()
    return now > ticket.validUntil
  }

  const handlePurchaseTicket = async () => {
    setPurchasing(true)
    setPurchaseMessage(null)

    const ticketPrice = ticketType === 'single' ? 10 : 25

    try {
      // Check balance
      if (balance < ticketPrice) {
        setPurchaseMessage({ 
          type: 'error', 
          text: `Insufficient balance. Current: CHF ${balance.toFixed(2)}, Required: CHF ${ticketPrice.toFixed(2)}` 
        })
        setPurchasing(false)
        return
      }

      // Get newest active cryptographic key for signing (using validator time)
      const now = validatorTime || Date.now()
      const activeKey = await getActiveCryptographicKey(now)
      if (!activeKey) {
        setPurchaseMessage({ type: 'error', text: 'No active cryptographic key found' })
        setPurchasing(false)
        return
      }

      // Generate ticket token and create blind signature (mock)
      const ticketToken = generateToken()
      const blindedToken = blindToken(ticketToken, activeKey.publicKey)
      const signedBlindedToken = 'signed_blinded_' + blindedToken
      const signature = unblindSignature(signedBlindedToken, 'mock_blinding_factor')
      
      if (!signature || typeof signature !== 'string') {
        throw new Error('Failed to generate ticket signature')
      }

      // Calculate ticket validity - align with key expiration
      let validFrom = now
      // Ticket expires when the key expires (or earlier for single tickets)
      let validUntil = activeKey.expiresAt
      
      // For single tickets, cap at 2 hours from now if key expires later
      if (ticketType === 'single') {
        const twoHoursFromNow = now + 2 * 60 * 60 * 1000
        validUntil = Math.min(activeKey.expiresAt, twoHoursFromNow)
      }

      // Generate ticket ID
      const ticketId = generateToken()
      if (!ticketId || typeof ticketId !== 'string' || ticketId.length === 0) {
        throw new Error('Failed to generate valid ticket ID')
      }

      // Create ticket
      const ticket = {
        ticketId: ticketId,
        cardId: String(selectedCardId || '').trim(),
        route: String(route || '').trim(),
        class: Number(ticketClass) || 2,
          validFrom: Number(validFrom) || (validatorTime || Date.now()),
          validUntil: Number(validUntil) || (validatorTime || Date.now()),
        ticketType: String(ticketType || 'single').trim(),
        signature: String(signature || '').trim(),
        keyId: String(activeKey?.keyId || '').trim(),
      }

      // Validate ticket
      if (!ticket.ticketId || !ticket.cardId || !ticket.signature || !ticket.keyId) {
        throw new Error('Invalid ticket data: missing required fields')
      }

      // Save ticket and deduct balance
      await saveUserTicket(ticket)
      const newBalance = await deductFromUserBalance(selectedCardId, ticketPrice)
      
      // Record purchase
      try {
        await saveTokenPurchase({
          accountId: `account_${selectedCardId}`,
          amount: ticketPrice,
          paymentMethod: 'mobile_app',
            timestamp: validatorTime || Date.now(),
        })
      } catch (err) {
        console.error('Error recording purchase:', err)
      }
      
      setPurchaseMessage({ 
        type: 'success', 
        text: `Ticket purchased! ${ticketType === 'day' ? 'Day Pass' : 'Single Journey'} - ${route}, Class ${ticketClass}. New balance: CHF ${newBalance.toFixed(2)}` 
      })
      
      // Reload data
      await loadData()
      
      // Close form after a moment
      setTimeout(() => {
        setShowPurchaseForm(false)
        setPurchaseMessage(null)
      }, 3000)
    } catch (error) {
      console.error('Error purchasing ticket:', error)
      setPurchaseMessage({ type: 'error', text: error.message || 'Failed to purchase ticket' })
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin text-4xl mb-4">⚙️</div>
        <p className="text-gray-600">Loading user device data...</p>
      </div>
    )
  }

  const validTickets = tickets.filter(isTicketValid)
  const expiredTickets = tickets.filter(isTicketExpired)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">📱 User Device</h1>
        
        {/* Device Type Selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Device Type:
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="phone"
                checked={deviceType === 'phone'}
                onChange={(e) => {
                  setDeviceType(e.target.value)
                  setShowPurchaseForm(false) // Close form when switching
                }}
                className="mr-2"
              />
              <span className="text-lg">📱 Phone (Can buy tickets)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="card"
                checked={deviceType === 'card'}
                onChange={(e) => {
                  setDeviceType(e.target.value)
                  setShowPurchaseForm(false) // Close form when switching
                }}
                className="mr-2"
              />
              <span className="text-lg">💳 Card (Use kiosk)</span>
            </label>
          </div>
        </div>

        {/* Card Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Card:
          </label>
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          >
            <option value={DEMO_CARD_IDS.USER_1}>Card 1: {DEMO_CARD_IDS.USER_1}</option>
            <option value={DEMO_CARD_IDS.USER_2}>Card 2: {DEMO_CARD_IDS.USER_2}</option>
          </select>
        </div>

        {/* Card Balance Summary */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg p-6 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Card Balance</p>
              <p className="text-4xl font-bold text-green-600">CHF {balance.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">
                Available for ticket purchases
              </p>
            </div>
            <div className="text-6xl">💳</div>
          </div>
        </div>

        {/* Buy Ticket Button - Only for phones */}
        {deviceType === 'phone' && (
          <div className="mt-4">
            <button
              onClick={() => setShowPurchaseForm(!showPurchaseForm)}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              {showPurchaseForm ? '✕ Cancel' : '🎫 Buy Ticket'}
            </button>
          </div>
        )}

        {/* Card message - Only for cards */}
        {deviceType === 'card' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">💳 Card Device:</span> This device cannot purchase tickets directly. 
              Please visit a <span className="font-semibold">🏪 Kiosk</span> to purchase tickets.
            </p>
          </div>
        )}
      </div>

      {/* Purchase Ticket Form - Only for phones */}
      {deviceType === 'phone' && showPurchaseForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Purchase Ticket</h2>
          
          <div className="space-y-4">
            {/* Ticket Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ticket Type
              </label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="single">Single Journey (CHF 10)</option>
                <option value="day">Day Pass (CHF 25)</option>
              </select>
            </div>

            {/* Route */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Route
              </label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ZH-BE">Zurich - Bern</option>
                <option value="BE-ZH">Bern - Zurich</option>
                <option value="ZH-GE">Zurich - Geneva</option>
                <option value="GE-ZH">Geneva - Zurich</option>
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Class
              </label>
              <select
                value={ticketClass}
                onChange={(e) => setTicketClass(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1st Class</option>
                <option value={2}>2nd Class</option>
              </select>
            </div>

            {/* Price Display */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-semibold">Price:</span>
                <span className="text-2xl font-bold text-blue-600">
                  CHF {ticketType === 'single' ? '10.00' : '25.00'}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Current balance: CHF {balance.toFixed(2)}
              </div>
            </div>

            {/* Message Display */}
            {purchaseMessage && (
              <div className={`p-4 rounded-lg ${
                purchaseMessage.type === 'success' 
                  ? 'bg-green-100 border border-green-400 text-green-700' 
                  : 'bg-red-100 border border-red-400 text-red-700'
              }`}>
                {purchaseMessage.text}
              </div>
            )}

            {/* Purchase Button */}
            <button
              onClick={handlePurchaseTicket}
              disabled={purchasing || balance < (ticketType === 'single' ? 10 : 25)}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {purchasing ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⚙️</span>
                  Processing...
                </span>
              ) : (
                `Purchase for CHF ${ticketType === 'single' ? '10.00' : '25.00'}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Valid Tickets */}
      {validTickets.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>✅</span> Valid Tickets ({validTickets.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {validTickets.map((ticket) => (
              <div
                key={ticket.ticketId}
                className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-5 border-2 border-blue-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-gray-800">{ticket.ticketType === 'day' ? 'Day Pass' : 'Single Journey'}</p>
                    <p className="text-sm text-gray-600">{ticket.route}</p>
                  </div>
                  <div className="text-3xl">
                    {ticket.ticketType === 'day' ? '🎫' : '🎟️'}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Class:</span>
                    <span className="font-semibold">{ticket.class}{ticket.class === 1 ? 'st' : 'nd'} Class</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid From:</span>
                    <span className="font-mono text-xs">{formatDate(ticket.validFrom)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Until:</span>
                    <span className="font-mono text-xs">{formatDate(ticket.validUntil)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-gray-600">Time Remaining:</span>
                    <span className="font-bold text-green-600">{formatTimeRemaining(ticket.validUntil)}</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-gray-500 font-mono">
                    Ticket ID: {ticket.ticketId.substring(0, 16)}...
                  </p>
                  <p className="text-xs text-gray-500">
                    Signed with: {ticket.keyId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Tickets */}
      {expiredTickets.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>❌</span> Expired Tickets ({expiredTickets.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expiredTickets.map((ticket) => (
              <div
                key={ticket.ticketId}
                className="bg-gray-100 rounded-lg p-5 border-2 border-gray-300 opacity-75"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-gray-600">{ticket.ticketType === 'day' ? 'Day Pass' : 'Single Journey'}</p>
                    <p className="text-sm text-gray-500">{ticket.route}</p>
                  </div>
                  <div className="text-3xl">🗑️</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Class:</span>
                    <span className="text-gray-600">{ticket.class}{ticket.class === 1 ? 'st' : 'nd'} Class</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expired:</span>
                    <span className="font-mono text-xs text-red-600">{formatDate(ticket.validUntil)}</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-400 font-mono">
                    Ticket ID: {ticket.ticketId.substring(0, 16)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Tokens (for daily tickets) */}
      {usageTokens.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>🔖</span> Usage Tokens ({usageTokens.length})
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Daily ticket usage records
          </p>
          <div className="space-y-2">
            {usageTokens.map((token) => (
              <div
                key={token.id}
                className="bg-purple-50 border border-purple-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-purple-800">
                      Ticket used at {formatDate(token.usedAt)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Validator: {token.validatorId} • Location: {token.location}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      Token: {token.token}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Tickets Message */}
      {tickets.length === 0 && (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🎫</div>
          <p className="text-lg text-gray-600 mb-2">No tickets on this card</p>
          <p className="text-sm text-gray-500">
            Use your tokens at the Kiosk to purchase tickets
          </p>
        </div>
      )}

      {/* Debug Panel */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-yellow-800 mb-2">🔧 Debug Info</h3>
        <div className="space-y-1 text-yellow-700">
          <p>Selected Card: <span className="font-mono">{selectedCardId}</span></p>
          <p>Tickets found: {tickets.length}</p>
          <p>Valid tickets: {validTickets.length}</p>
          <p>Expired tickets: {expiredTickets.length}</p>
          <button
            onClick={async () => {
              const allTickets = await getAllUserTickets()
              console.log('All tickets in DB:', allTickets)
              alert(`Total tickets in database: ${allTickets.length}\nCheck console for details`)
            }}
            className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
          >
            Check All Tickets in DB
          </button>
          <button
            onClick={async () => {
              await initializeSeedData()
              await loadData()
              alert('Re-initialized seed data!')
            }}
            className="mt-2 ml-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Re-initialize Data
          </button>
        </div>
      </div>

      {/* Card Info Summary */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Card Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">CHF {balance}</p>
            <p className="text-sm text-gray-600">Card Balance</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{validTickets.length}</p>
            <p className="text-sm text-gray-600">Valid Tickets</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{expiredTickets.length}</p>
            <p className="text-sm text-gray-600">Expired</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Card ID:</span>{' '}
            <span className="font-mono text-gray-800">{selectedCardId}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
