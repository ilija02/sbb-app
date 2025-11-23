/**
 * Kiosk Tab - Deposit money or buy tickets
 */

import { useState, useEffect } from 'react'
import { 
  addToUserBalance, 
  deductFromUserBalance,
  getUserBalance,
  saveUserTicket,
  getActiveCryptographicKey,
  saveTokenPurchase,
  subscribeToChanges
} from '../lib/storage'
import { DEMO_CARD_IDS } from '../lib/seedData'
import { generateToken, blindToken, unblindSignature } from '../lib/crypto'

export default function KioskTab({ validatorTime }) {
  const [cardId, setCardId] = useState(DEMO_CARD_IDS.USER_1)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('deposit') // 'deposit' or 'ticket'
  const [ticketType, setTicketType] = useState('single') // 'single' or 'day'
  const [route, setRoute] = useState('ZH-BE')
  const [ticketClass, setTicketClass] = useState(2)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [currentBalance, setCurrentBalance] = useState(0)

  // Load current balance when card changes
  useEffect(() => {
    loadBalance()
  }, [cardId])

  // Listen for cross-tab changes
  useEffect(() => {
    const unsubscribe = subscribeToChanges((change) => {
      // Reload balance when user balances change
      if (change.store === 'userBalances') {
        console.log('[Kiosk] Cross-tab change detected, reloading balance...')
        loadBalance()
      }
    })
    return unsubscribe
  }, [cardId])

  const loadBalance = async () => {
    try {
      const balance = await getUserBalance(cardId)
      setCurrentBalance(balance || 0)
    } catch (error) {
      console.error('Error loading balance:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' })
      setLoading(false)
      return
    }

    try {
      if (mode === 'deposit') {
        // Deposit money to card
        const newBalance = await addToUserBalance(cardId, amountNum)
        setMessage({ 
          type: 'success', 
          text: `Successfully deposited CHF ${amountNum.toFixed(2)}. New balance: CHF ${newBalance.toFixed(2)}` 
        })
        setAmount('')
        await loadBalance()
      } else {
        // Buy ticket
        // Check if balance is sufficient
        const balance = await getUserBalance(cardId)
        if (balance < amountNum) {
          setMessage({ 
            type: 'error', 
            text: `Insufficient balance. Current: CHF ${balance.toFixed(2)}, Required: CHF ${amountNum.toFixed(2)}` 
          })
          setLoading(false)
          return
        }

        // Get newest active cryptographic key for signing (using validator time)
        const now = validatorTime || Date.now()
        const activeKey = await getActiveCryptographicKey(now)
        if (!activeKey) {
          setMessage({ type: 'error', text: 'No active cryptographic key found' })
          setLoading(false)
          return
        }

        // Generate ticket token and create blind signature (mock)
        const ticketToken = generateToken()
        const blindedToken = blindToken(ticketToken, activeKey.publicKey)
        // Mock: In production, this would be sent to backend for signing
        const signedBlindedToken = 'signed_blinded_' + blindedToken
        const signature = unblindSignature(signedBlindedToken, 'mock_blinding_factor')
        
        // Ensure signature is a valid string
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

        // Create ticket - ensure all fields are properly formatted
        const ticket = {
          ticketId: ticketId,
          cardId: String(cardId || '').trim(), // Ensure string and not empty
          route: String(route || '').trim(), // Ensure string
          class: Number(ticketClass) || 2, // Ensure number, default to 2
          validFrom: Number(validFrom) || (validatorTime || Date.now()), // Ensure number
          validUntil: Number(validUntil) || (validatorTime || Date.now()), // Ensure number
          ticketType: String(ticketType || 'single').trim(), // Ensure string
          signature: String(signature || '').trim(), // Ensure string
          keyId: String(activeKey?.keyId || '').trim(), // Ensure string
        }

        // Validate ticket before saving
        if (!ticket.ticketId || ticket.ticketId.length === 0) {
          throw new Error('Invalid ticket data: ticketId is required')
        }
        if (!ticket.cardId || ticket.cardId.length === 0) {
          throw new Error('Invalid ticket data: cardId is required')
        }
        if (!ticket.signature || ticket.signature.length === 0) {
          throw new Error('Invalid ticket data: signature is required')
        }
        if (!ticket.keyId || ticket.keyId.length === 0) {
          throw new Error('Invalid ticket data: keyId is required')
        }
        if (isNaN(ticket.validFrom) || isNaN(ticket.validUntil)) {
          throw new Error('Invalid ticket data: validFrom and validUntil must be valid timestamps')
        }

        console.log('[Kiosk] Creating ticket:', ticket)

        // Save ticket and deduct balance
        try {
          await saveUserTicket(ticket)
          console.log('[Kiosk] Ticket saved successfully')
        } catch (saveError) {
          console.error('[Kiosk] Error saving ticket:', saveError)
          throw new Error(`Failed to save ticket: ${saveError.message}`)
        }
        
        const newBalance = await deductFromUserBalance(cardId, amountNum)
        
        // Record the purchase in backend (using cardId as accountId for demo)
        try {
          await saveTokenPurchase({
            accountId: `account_${cardId}`, // In production, this would be a private account ID
            amount: amountNum,
            paymentMethod: 'kiosk',
            timestamp: validatorTime || Date.now(),
          })
          console.log('[Kiosk] Purchase recorded successfully')
        } catch (purchaseError) {
          console.error('[Kiosk] Error recording purchase:', purchaseError)
          // Don't fail the transaction if purchase recording fails
        }
        
        setMessage({ 
          type: 'success', 
          text: `Ticket purchased successfully! Type: ${ticketType}, Route: ${route}, Class: ${ticketClass}. New balance: CHF ${newBalance.toFixed(2)}` 
        })
        setAmount('')
        await loadBalance()
      }
    } catch (error) {
      console.error('Error processing transaction:', error)
      setMessage({ type: 'error', text: error.message || 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🏪 Kiosk</h1>
        <p className="text-sm text-gray-600">Deposit money or purchase tickets</p>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card ID Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Card ID
            </label>
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value={DEMO_CARD_IDS.USER_1}>Card 1: {DEMO_CARD_IDS.USER_1}</option>
              <option value={DEMO_CARD_IDS.USER_2}>Card 2: {DEMO_CARD_IDS.USER_2}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Current balance: <span className="font-semibold">CHF {currentBalance.toFixed(2)}</span>
            </p>
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Transaction Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="deposit"
                  checked={mode === 'deposit'}
                  onChange={(e) => {
                    setMode(e.target.value)
                    setAmount('') // Clear amount when switching to deposit
                  }}
                  className="mr-2"
                />
                <span>💰 Deposit Money</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ticket"
                  checked={mode === 'ticket'}
                  onChange={(e) => {
                    setMode(e.target.value)
                    // Auto-fill with ticket price when switching to ticket mode
                    setAmount(ticketType === 'single' ? '10.00' : '25.00')
                  }}
                  className="mr-2"
                />
                <span>🎫 Buy Ticket</span>
              </label>
            </div>
          </div>

          {/* Ticket Options (only shown when buying ticket) */}
          {mode === 'ticket' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-blue-800">Ticket Details</h3>
              
              {/* Ticket Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ticket Type
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => {
                    setTicketType(e.target.value)
                    // Auto-fill amount with ticket price
                    setAmount(e.target.value === 'single' ? '10.00' : '25.00')
                  }}
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
              <div className="bg-white rounded p-3 border border-blue-300">
                <p className="text-sm text-gray-600">
                  Ticket Price: <span className="font-bold text-lg text-blue-700">
                    CHF {ticketType === 'single' ? '10.00' : '25.00'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {mode === 'deposit' ? 'Deposit Amount (CHF)' : 'Payment Amount (CHF)'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={mode === 'ticket' ? (ticketType === 'single' ? '10.00' : '25.00') : '0.00'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {mode === 'ticket' && (
              <p className="mt-1 text-xs text-gray-500">
                Suggested: CHF {ticketType === 'single' ? '10.00' : '25.00'}
              </p>
            )}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2">⚙️</span>
                Processing...
              </span>
            ) : (
              mode === 'deposit' ? '💰 Deposit Money' : '🎫 Purchase Ticket'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
