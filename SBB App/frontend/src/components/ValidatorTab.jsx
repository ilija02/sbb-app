/**
 * Validator Tab - Validate and consume tickets
 */

import { useState, useEffect } from 'react'
import {
  getUserTicketsForCard,
  getValidUserTickets,
  isTicketInvalidated,
  saveInvalidatedTicket,
  saveUsageToken,
  deleteUserTicket,
  saveUserTicket,
  getActiveCryptographicKey,
  getAllCryptographicKeys,
  subscribeToChanges,
  queueValidatorInvalidation,
  getUnsyncedValidatorInvalidations,
  getAllValidatorInvalidations,
  markValidatorInvalidationSynced
} from '../lib/storage'
import { generateToken, blindToken, unblindSignature, verifySignature } from '../lib/crypto'
import { DEMO_CARD_IDS } from '../lib/seedData'

export default function ValidatorTab({ validatorTime = Date.now() }) {
  const [cardId, setCardId] = useState('')
  const [tickets, setTickets] = useState([])
  const [validTickets, setValidTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState(null)
  const [validatorId] = useState('VAL-001') // Mock validator ID
  const [location] = useState('Platform 1') // Mock location
  const [isOnline, setIsOnline] = useState(() => {
    // Load from localStorage, default to true
    const saved = localStorage.getItem('validatorIsOnline')
    return saved !== null ? saved === 'true' : true
  })
  const [queue, setQueue] = useState([]) // Offline invalidation queue
  const [fraudulentTickets, setFraudulentTickets] = useState([]) // Tickets that were already invalidated

  // Auto-load tickets when cardId changes
  useEffect(() => {
    loadTickets()
  }, [cardId])
  
  // When validatorTime changes, just update the filtered tickets without full reload
  useEffect(() => {
    if (cardId && tickets.length > 0) {
      // Just re-filter existing tickets without setting loading state
      const now = validatorTime
      const valid = tickets.filter(ticket => 
        ticket.validFrom <= now && ticket.validUntil >= now
      )
      setValidTickets(valid)
    }
  }, [validatorTime]) // Only depend on validatorTime, tickets will be filtered from state

  // Listen for cross-tab changes - update incrementally without loading state
  useEffect(() => {
    const unsubscribe = subscribeToChanges((change) => {
      if (change.store === 'userTickets' || change.store === 'invalidatedTickets') {
        if (cardId) {
          updateTicketsIncrementally()
        }
      }
      if (change.store === 'validatorInvalidationQueue') {
        loadQueue()
      }
    })
    return unsubscribe
  }, [cardId])

  // Load queue on mount and when online status changes
  useEffect(() => {
    loadQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const loadTickets = async () => {
    if (!cardId || cardId.trim() === '') {
      setTickets([])
      setValidTickets([])
      setSelectedTicket(null)
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // Get all tickets for the card
      const allTickets = await getUserTicketsForCard(cardId)
      setTickets(allTickets)

      // Filter valid tickets using validator time (not real time)
      const now = validatorTime
      const valid = allTickets.filter(ticket => 
        ticket.validFrom <= now && ticket.validUntil >= now
      )
      setValidTickets(valid)
    } catch (error) {
      console.error('Error loading tickets:', error)
      setMessage({ type: 'error', text: 'Failed to load tickets' })
    } finally {
      setLoading(false)
    }
  }

  // Incremental update without loading state (preserves scroll position)
  const updateTicketsIncrementally = async () => {
    if (!cardId || cardId.trim() === '') {
      return
    }

    try {
      // Get all tickets for the card
      const allTickets = await getUserTicketsForCard(cardId)
      setTickets(allTickets)

      // Filter valid tickets using validator time (not real time)
      const now = validatorTime
      const valid = allTickets.filter(ticket => 
        ticket.validFrom <= now && ticket.validUntil >= now
      )
      setValidTickets(valid)
    } catch (error) {
      console.error('Error updating tickets:', error)
    }
  }

  const loadQueue = async () => {
    try {
      const queueItems = await getUnsyncedValidatorInvalidations()
      setQueue(queueItems)
    } catch (error) {
      console.error('Error loading queue:', error)
    }
  }

  const handleCardIdChange = (e) => {
    const newCardId = e.target.value
    setCardId(newCardId)
    setSelectedTicket(null)
    setMessage(null)
    // Tickets will auto-load via useEffect
  }

  const handleToggleConnection = async () => {
    const newOnlineStatus = !isOnline
    setIsOnline(newOnlineStatus)
    
    // Persist to localStorage
    localStorage.setItem('validatorIsOnline', String(newOnlineStatus))
    
    // When going back online, process the queue
    if (newOnlineStatus) {
      await processQueue()
    }
  }

  const processQueue = async () => {
    try {
      const unsyncedItems = await getUnsyncedValidatorInvalidations()
      const fraudulent = []
      const synced = []
      
      for (const item of unsyncedItems) {
        // Check if ticket was already invalidated in the backend (fraud detection)
        const alreadyInvalidated = await isTicketInvalidated(item.ticketId)
        
        if (alreadyInvalidated) {
          // Fraud detected: ticket was already invalidated before this offline validation
          fraudulent.push({
            ...item,
            detectedAt: Date.now()
          })
        } else {
          // Normal case: invalidate the ticket in the backend
          await saveInvalidatedTicket({
            ticketId: item.ticketId,
            keyId: item.keyId,
            invalidatedAt: item.timestamp,
            validatorId: item.validatorId,
            location: item.location,
          })
          synced.push(item)
        }
        
        // Mark as synced regardless (fraudulent or not)
        await markValidatorInvalidationSynced(item.id)
      }
      
      // Update fraudulent tickets list
      if (fraudulent.length > 0) {
        setFraudulentTickets(prev => [...prev, ...fraudulent])
      }
      
      // Reload queue to reflect changes
      await loadQueue()
      
      // Show appropriate message
      if (fraudulent.length > 0 && synced.length > 0) {
        setMessage({
          type: 'error',
          text: `⚠️ Synced ${synced.length} validation(s). ${fraudulent.length} FRAUDULENT ticket(s) detected!`
        })
      } else if (fraudulent.length > 0) {
        setMessage({
          type: 'error',
          text: `🚨 ${fraudulent.length} FRAUDULENT ticket(s) detected! These tickets were already invalidated.`
        })
      } else if (synced.length > 0) {
        setMessage({
          type: 'success',
          text: `✅ Synced ${synced.length} queued validation(s) to backend`
        })
      }
      
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Error processing queue:', error)
      setMessage({
        type: 'error',
        text: `Failed to sync queue: ${error.message}`
      })
    }
  }

  const handleValidateTicket = async (ticket) => {
    setValidating(true)
    setMessage(null)

    try {
      const now = validatorTime
      
      // Check if ticket is still valid (not expired) using validator time
      if (now < ticket.validFrom || now > ticket.validUntil) {
        setMessage({ 
          type: 'error', 
          text: '❌ Ticket is expired or not yet valid!' 
        })
        setValidating(false)
        return
      }

      // When ONLINE: Check if ticket is already invalidated
      if (isOnline) {
        const alreadyInvalidated = await isTicketInvalidated(ticket.ticketId)
        if (alreadyInvalidated) {
          setMessage({ 
            type: 'error', 
            text: '❌ Ticket already invalidated! This ticket has already been used.' 
          })
          setValidating(false)
          return
        }
      } else {
        // When OFFLINE: Verify signature against active keys
        const allKeys = await getAllCryptographicKeys()
        const ticketKey = allKeys.find(k => k.keyId === ticket.keyId)
        
        if (!ticketKey) {
          setMessage({ 
            type: 'error', 
            text: '❌ Cannot verify ticket: signing key not found!' 
          })
          setValidating(false)
          return
        }
        
        // Check if key is active
        const isKeyActive = ticketKey.isActive && ticketKey.expiresAt > now
        if (!isKeyActive) {
          setMessage({ 
            type: 'error', 
            text: '❌ Cannot verify ticket: signing key is not active!' 
          })
          setValidating(false)
          return
        }
        
        // Verify signature (mock verification)
        const signatureValid = verifySignature(ticket.ticketId, ticket.signature, ticketKey.publicKey)
        if (!signatureValid) {
          setMessage({ 
            type: 'error', 
            text: '❌ Invalid ticket signature!' 
          })
          setValidating(false)
          return
        }
      }

      // Remove ticket from user's device
      await deleteUserTicket(ticket.ticketId)
      console.log('[Validator] Ticket removed from user device:', ticket.ticketId)

      // If ONLINE: Mark ticket as invalidated in backend immediately
      // If OFFLINE: Add to queue for later sync
      if (isOnline) {
        await saveInvalidatedTicket({
          ticketId: ticket.ticketId,
          keyId: ticket.keyId,
          invalidatedAt: validatorTime,
          validatorId: validatorId,
          location: location,
        })
      } else {
        // Queue for offline sync
        await queueValidatorInvalidation({
          ticketId: ticket.ticketId,
          keyId: ticket.keyId,
          validatorId: validatorId,
          location: location,
          oldTicketData: ticket,
        })
        await loadQueue() // Refresh queue display
      }

      // For daily tickets, create a usage token and save it to user device
      if (ticket.ticketType === 'day') {
        const usageToken = {
          ticketId: ticket.ticketId,
          cardId: cardId,
          usedAt: validatorTime,
          validatorId: validatorId,
          location: location,
          token: `usage_${validatorTime}_${generateToken().substring(0, 16)}`
        }
        await saveUsageToken(usageToken)
        console.log('[Validator] Usage token created and saved for daily ticket:', usageToken)
      }

      // If ticket is NOT single-use (i.e., daily) and hasn't expired, create a new ticket
      let newTicketCreated = false
      if (ticket.ticketType !== 'single' && now <= ticket.validUntil) {
        // Get the newest active key (not the original key, use newest for new tickets)
        const now = validatorTime
        const newestKey = await getActiveCryptographicKey(now)
        
        if (newestKey) {
          // Create a new ticket with the newest key and align expiration
          const newTicketId = generateToken() // Generate unique ticket ID (no prefix)
          const token = generateToken()
          const blindedToken = blindToken(token, newestKey.publicKey)
          
          // Mock signature (in production, this would be done by the backend)
          const signedBlindedToken = `signed_${blindedToken}`
          const signature = unblindSignature(signedBlindedToken, 'mock_blinding_factor')
          
          // Align expiration with key expiration
          let validUntil = newestKey.expiresAt
          // For single tickets, cap at 2 hours if key expires later
          if (ticket.ticketType === 'single') {
            const twoHoursFromNow = now + 2 * 60 * 60 * 1000
            validUntil = Math.min(newestKey.expiresAt, twoHoursFromNow)
          }
          
          const newTicket = {
            ticketId: newTicketId,
            cardId: cardId,
            route: ticket.route,
            class: ticket.class,
            validFrom: now,
            validUntil: validUntil, // Aligned with newest key expiration
            ticketType: ticket.ticketType,
            signature: signature,
            keyId: newestKey.keyId, // Use newest key
          }
          
          await saveUserTicket(newTicket)
          newTicketCreated = true
          console.log('[Validator] New ticket created for user:', newTicket)
        }
      }

      const statusText = isOnline 
        ? `✅ Ticket validated and consumed! ${ticket.ticketType === 'day' ? 'Usage token generated.' : 'Single journey ticket used.'}${newTicketCreated ? ' New ticket issued with same expiry.' : ''}`
        : `✅ Ticket validated (offline)! ${ticket.ticketType === 'day' ? 'Usage token generated.' : 'Single journey ticket used.'} Queued for backend sync.${newTicketCreated ? ' New ticket issued with same expiry.' : ''}`
      
      setMessage({ 
        type: 'success', 
        text: statusText
      })

      // Reload tickets to reflect the change
      await loadTickets()
      setSelectedTicket(null)

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (error) {
      console.error('Error validating ticket:', error)
      setMessage({ 
        type: 'error', 
        text: `Failed to validate ticket: ${error.message}` 
      })
    } finally {
      setValidating(false)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatTimeRemaining = (validUntil) => {
    const now = validatorTime
    const remaining = validUntil - now
    
    if (remaining < 0) return 'Expired'
    
    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className={`space-y-6 transition-colors duration-300 ${!isOnline ? 'bg-gray-900 min-h-screen -m-8 p-8' : ''}`}>
      {/* Header */}
      <div className={`rounded-lg shadow-lg p-6 transition-colors ${isOnline ? 'bg-white' : 'bg-gray-800 text-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold mb-2 ${isOnline ? 'text-gray-800' : 'text-white'}`}>🎫 Validator</h1>
            <p className={`text-sm ${isOnline ? 'text-gray-600' : 'text-gray-300'}`}>Validate and consume tickets from user cards</p>
          </div>
          <button
            onClick={handleToggleConnection}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              isOnline
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isOnline ? 'Turn off internet connection' : 'Turn on internet connection'}
          >
            {isOnline ? '🌐 Online' : '📴 Offline'}
          </button>
        </div>
      </div>

      {/* Offline Queue Display */}
      {!isOnline && queue.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-yellow-800">
              📋 Offline Queue ({queue.length} pending)
            </h3>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {queue.map((item) => (
              <div key={item.id} className="text-xs bg-yellow-100 p-2 rounded flex items-center justify-between">
                <span className="font-mono text-yellow-800">
                  {item.ticketId.substring(0, 20)}...
                </span>
                <span className="text-yellow-600">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fraudulent Tickets Display */}
      {fraudulentTickets.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-red-800">
              🚨 Fraudulent Tickets Detected ({fraudulentTickets.length})
            </h3>
            <button
              onClick={() => setFraudulentTickets([])}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {fraudulentTickets.map((item, index) => (
              <div key={`${item.ticketId}-${index}`} className="text-xs bg-red-100 p-2 rounded border border-red-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-red-800 font-semibold">
                    {item.ticketId.substring(0, 24)}...
                  </span>
                  <span className="text-red-600">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-red-700 text-xs mt-1">
                  ⚠️ Already invalidated before offline validation - Possible double-spending attempt
                </div>
                {item.validatorId && (
                  <div className="text-red-600 text-xs mt-1">
                    Validator: {item.validatorId} | Location: {item.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card ID Input */}
      <div className={`rounded-lg shadow-lg p-6 transition-colors ${isOnline ? 'bg-white' : 'bg-gray-800'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${isOnline ? 'text-gray-800' : 'text-white'}`}>Scan Card</h2>
        <div>
          <input
            type="text"
            value={cardId}
            onChange={handleCardIdChange}
            placeholder="Enter card ID (e.g., CARD_001_ABC123)"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono ${
              isOnline 
                ? 'border-gray-300 focus:ring-blue-500 bg-white text-gray-800' 
                : 'border-gray-600 focus:ring-blue-400 bg-gray-700 text-white placeholder-gray-400'
            }`}
          />
        </div>
        
        {/* Quick Card Selector */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Quick select:</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCardId(DEMO_CARD_IDS.USER_1)
                setSelectedTicket(null)
              }}
              className={`px-3 py-1 text-xs rounded font-mono ${
                isOnline 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {DEMO_CARD_IDS.USER_1}
            </button>
            <button
              onClick={() => {
                setCardId(DEMO_CARD_IDS.USER_2)
                setSelectedTicket(null)
              }}
              className={`px-3 py-1 text-xs rounded font-mono ${
                isOnline 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {DEMO_CARD_IDS.USER_2}
            </button>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Valid Tickets List */}
      {cardId && (
        <div className={`rounded-lg shadow-lg p-6 transition-colors ${isOnline ? 'bg-white' : 'bg-gray-800'}`}>
          <h2 className={`text-lg font-semibold mb-4 ${isOnline ? 'text-gray-800' : 'text-white'}`}>
            Valid Tickets ({validTickets.length})
          </h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">⚙️</div>
              <p className={isOnline ? 'text-gray-600' : 'text-gray-400'}>Loading tickets...</p>
            </div>
          ) : validTickets.length === 0 ? (
            <div className={`text-center py-8 ${isOnline ? 'text-gray-500' : 'text-gray-400'}`}>
              <p>No valid tickets found for this card.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {validTickets.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className={`border-2 rounded-lg p-4 transition-all ${
                    selectedTicket?.ticketId === ticket.ticketId
                      ? isOnline ? 'border-blue-500 bg-blue-50' : 'border-blue-400 bg-blue-900'
                      : isOnline ? 'border-gray-200 bg-gray-50 hover:border-gray-300' : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-lg font-bold ${isOnline ? 'text-gray-800' : 'text-white'}`}>
                          {ticket.ticketType === 'day' ? '🎫 Day Pass' : '🎟️ Single Journey'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.ticketType === 'day' 
                            ? 'bg-purple-200 text-purple-800' 
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {ticket.ticketType}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className={isOnline ? 'text-gray-600' : 'text-gray-400'}>Route:</span>
                          <span className={`font-semibold ml-2 ${isOnline ? 'text-gray-800' : 'text-white'}`}>{ticket.route}</span>
                        </div>
                        <div>
                          <span className={isOnline ? 'text-gray-600' : 'text-gray-400'}>Class:</span>
                          <span className={`font-semibold ml-2 ${isOnline ? 'text-gray-800' : 'text-white'}`}>{ticket.class}{ticket.class === 1 ? 'st' : 'nd'}</span>
                        </div>
                        <div>
                          <span className={isOnline ? 'text-gray-600' : 'text-gray-400'}>Valid Until:</span>
                          <span className={`font-mono text-xs ml-2 ${isOnline ? 'text-gray-800' : 'text-gray-300'}`}>{formatDate(ticket.validUntil)}</span>
                        </div>
                        <div>
                          <span className={isOnline ? 'text-gray-600' : 'text-gray-400'}>Time Left:</span>
                          <span className={`font-semibold ml-2 ${isOnline ? 'text-green-600' : 'text-green-400'}`}>{formatTimeRemaining(ticket.validUntil)}</span>
                        </div>
                      </div>
                      
                      <div className={`text-xs font-mono mb-3 ${isOnline ? 'text-gray-500' : 'text-gray-400'}`}>
                        Ticket ID: {ticket.ticketId.substring(0, 24)}...
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        if (selectedTicket?.ticketId === ticket.ticketId) {
                          setSelectedTicket(null)
                        } else {
                          setSelectedTicket(ticket)
                        }
                      }}
                      className={`ml-4 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        selectedTicket?.ticketId === ticket.ticketId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selectedTicket?.ticketId === ticket.ticketId ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validate Button */}
      {selectedTicket && (
        <div className={`rounded-lg shadow-lg p-6 border-2 transition-colors ${isOnline ? 'bg-white border-blue-200' : 'bg-gray-800 border-gray-600'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isOnline ? 'text-gray-800' : 'text-white'}`}>
            Validate Selected Ticket
          </h3>
          
          <div className={`rounded-lg p-4 mb-4 ${isOnline ? 'bg-blue-50' : 'bg-blue-900'}`}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={isOnline ? 'text-gray-600' : 'text-gray-300'}>Type:</span>
                <span className={`font-semibold ${isOnline ? 'text-gray-800' : 'text-white'}`}>
                  {selectedTicket.ticketType === 'day' ? 'Day Pass' : 'Single Journey'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isOnline ? 'text-gray-600' : 'text-gray-300'}>Route:</span>
                <span className={`font-semibold ${isOnline ? 'text-gray-800' : 'text-white'}`}>{selectedTicket.route}</span>
              </div>
              <div className="flex justify-between">
                <span className={isOnline ? 'text-gray-600' : 'text-gray-300'}>Class:</span>
                <span className={`font-semibold ${isOnline ? 'text-gray-800' : 'text-white'}`}>{selectedTicket.class}{selectedTicket.class === 1 ? 'st' : 'nd'}</span>
              </div>
              {selectedTicket.ticketType === 'day' && (
                <div className={`mt-2 pt-2 border-t ${isOnline ? 'border-blue-200' : 'border-blue-700'}`}>
                  <p className={`text-xs ${isOnline ? 'text-blue-700' : 'text-blue-300'}`}>
                    ℹ️ Daily tickets will generate a usage token for the user device
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleValidateTicket(selectedTicket)}
            disabled={validating}
            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validating ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2">⚙️</span>
                Validating...
              </span>
            ) : (
              '✅ Validate & Consume Ticket'
            )}
          </button>
        </div>
      )}

      {/* Validator Info */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p><span className="font-semibold">Validator ID:</span> {validatorId}</p>
        <p><span className="font-semibold">Location:</span> {location}</p>
      </div>
    </div>
  )
}
