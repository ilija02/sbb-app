import { useState } from 'react'
import { Link } from 'react-router-dom'
import { generateToken, blindToken, unblindSignature } from '../lib/crypto'
import { getPublicKey, signBlindedToken } from '../lib/api'
import { writeToCard, generateVirtualCardId, addCredits, getBalance, deductCredits } from '../lib/nfcSimulator'

export default function KioskPurchase() {
  const [mode, setMode] = useState('menu') // menu | credits | ticket
  const [step, setStep] = useState('select') // select | payment | processing | write | card_write | success
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [selectedAmount, setSelectedAmount] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('credit_card')
  const [cardId, setCardId] = useState('')
  const [ticketData, setTicketData] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [balance, setBalance] = useState(0)

  const tickets = [
    { id: 'single', name: 'Single Journey', route: 'ZH-BE', price: 55, duration: 2, class: 2 },
    { id: 'day', name: 'Day Pass', route: 'ZH-BE', price: 85, duration: 24, class: 2 },
    { id: 'first', name: 'Single 1st Class', route: 'ZH-BE', price: 95, duration: 2, class: 1 },
  ]

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket)
    setStep('payment')
  }

  const handlePayment = async () => {
    setProcessing(true)
    setStep('processing')

    try {
      // Step 1: Check card balance
      if (!cardId) {
        throw new Error('Please enter your card ID')
      }

      const currentBalance = await getBalance(cardId)
      setBalance(currentBalance)

      if (currentBalance < selectedTicket.price) {
        throw new Error(`Insufficient credits. Balance: CHF ${currentBalance}, Required: CHF ${selectedTicket.price}`)
      }

      // Step 2: Generate blinded token on card (backend never sees original)
      const originalTicketId = generateToken()
      const publicKey = await getPublicKey()
      const blindedToken = blindToken(originalTicketId, publicKey)

      // Step 3: Backend signs blinded token (cannot link to payment or card!)
      const blindSignature = await signBlindedToken(blindedToken, `credits_${Date.now()}`)

      // Step 4: Unblind signature on card
      const signature = unblindSignature(blindSignature, 'blinding_factor')

      // Step 5: Create ticket data
      const now = Date.now()
      const ticket = {
        ticket_id: originalTicketId,
        route: selectedTicket.route,
        class: selectedTicket.class,
        valid_from: now,
        valid_until: now + selectedTicket.duration * 60 * 60 * 1000,
        ticket_type: selectedTicket.id
      }

      setTicketData({ ...ticket, signature })

      // Step 6: Deduct credits and write to card
      await deductCredits(cardId, selectedTicket.price)
      setStep('card_write')

    } catch (error) {
      console.error('Purchase failed:', error)
      alert('Purchase failed: ' + error.message)
      setStep('select')
    } finally {
      setProcessing(false)
    }
  }

  const handleWriteToCard = async () => {
    setProcessing(true)

    try {
      // Write to NFC card
      await writeToCard(cardId, ticketData, ticketData.signature)
      setStep('success')
    } catch (error) {
      console.error('Card write failed:', error)
      alert('Failed to write to card: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleCreditsPayment = async () => {
    setProcessing(true)
    setStep('processing')

    try {
      // Simulate payment processing
      await simulatePayment(selectedAmount)

      // Payment complete - now need to write to card
      setStep('write')
    } catch (error) {
      console.error('Credits purchase failed:', error)
      alert('Purchase failed: ' + error.message)
      setMode('menu')
      setStep('select')
    } finally {
      setProcessing(false)
    }
  }

  const handleWriteCreditsToCard = async () => {
    setWriting(true)

    try {
      // Simulate NFC write
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Generate card ID and add credits
      const newCardId = generateVirtualCardId()
      setCardId(newCardId)
      
      await addCredits(newCardId, selectedAmount)
      
      setStep('success')
    } catch (error) {
      console.error('Failed to write credits to card:', error)
      alert('Card write failed: ' + error.message)
      setStep('payment')
    } finally {
      setWriting(false)
    }
  }

  const handleCheckBalance = async () => {
    const existingCardId = prompt('Enter your card ID (or leave blank to create new):')
    if (existingCardId) {
      const cardBalance = await getBalance(existingCardId)
      setBalance(cardBalance)
      setCardId(existingCardId)
    }
  }

  const simulatePayment = (amount = null) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const amountToPay = amount || selectedTicket?.price
        console.log(`Payment processed: ${paymentMethod}, CHF ${amountToPay}`)
        resolve()
      }, 1500)
    })
  }

  const handleReset = () => {
    setMode('menu')
    setStep('select')
    setSelectedTicket(null)
    setSelectedAmount(null)
    setPaymentMethod('credit_card')
    setCardId('')
    setTicketData(null)
    setBalance(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🏪 Ticket Kiosk</h1>
          <div className="flex gap-3">
            <Link to="/train-validator" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Train Validator →
            </Link>
            <Link to="/validator" className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
              Conductor Handheld
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-2xl p-8 min-h-[600px]">
          
          {/* Main Menu */}
          {mode === 'menu' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Welcome</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <button
                  onClick={() => {
                    setMode('credits')
                    setStep('select')
                  }}
                  className="bg-gradient-to-br from-green-50 to-emerald-100 p-8 rounded-lg border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition"
                >
                  <div className="text-6xl mb-4">💳</div>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-3">Buy Credits</h3>
                  <p className="text-sm text-gray-600">Add funds to your card (anonymous, no route tracking)</p>
                </button>

                <button
                  onClick={() => {
                    setMode('ticket')
                    setStep('select')
                  }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition"
                >
                  <div className="text-6xl mb-4">🎫</div>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-3">Buy Ticket</h3>
                  <p className="text-sm text-gray-600">Purchase ticket using on-card credits</p>
                </button>
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={handleCheckBalance}
                  className="text-gray-600 hover:text-gray-800 underline"
                >
                  Check Card Balance
                </button>
                {balance > 0 && (
                  <p className="mt-2 text-lg font-semibold text-green-600">
                    Current Balance: CHF {balance}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Credits Mode - Select Amount */}
          {mode === 'credits' && step === 'select' && (
            <div>
              <button onClick={handleReset} className="text-gray-600 hover:text-gray-800 mb-4">← Back to Menu</button>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Amount</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[20, 50, 100, 200].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount)
                      setStep('payment')
                    }}
                    className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-lg border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition"
                  >
                    <div className="text-3xl mb-3">💰</div>
                    <div className="text-2xl font-bold text-green-600">CHF {amount}</div>
                  </button>
                ))}
              </div>
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">🔐 Maximum Privacy:</p>
                <p className="text-blue-700">
                  Credits are generic funds. The backend cannot link your payment to any specific route or ticket purchase.
                </p>
              </div>
            </div>
          )}

          {/* Credits Mode - Payment */}
          {mode === 'credits' && step === 'payment' && selectedAmount && (
            <div>
              <button onClick={() => setStep('select')} className="text-gray-600 hover:text-gray-800 mb-4">← Back</button>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Payment Method</h2>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-700">Amount:</span>
                  <span className="text-3xl font-bold text-gray-900">CHF {selectedAmount}</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { id: 'credit_card', name: '💳 Credit Card', desc: 'Visa, Mastercard' },
                  { id: 'cash', name: '💵 Cash', desc: 'Bills and coins' },
                  { id: 'twint', name: '📱 TWINT', desc: 'Mobile payment' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition ${
                      paymentMethod === method.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{method.name}</div>
                    <div className="text-sm text-gray-600">{method.desc}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleCreditsPayment}
                disabled={processing}
                className="w-full py-4 bg-green-600 text-white rounded-lg text-xl font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                Pay CHF {selectedAmount}
              </button>
            </div>
          )}

          {/* Ticket Mode - Select Ticket */}
          {mode === 'ticket' && step === 'select' && (
            <div>
              <button onClick={handleReset} className="text-gray-600 hover:text-gray-800 mb-4">← Back to Menu</button>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Your Ticket</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition"
                  >
                    <div className="text-4xl mb-3">🎫</div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{ticket.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{ticket.route} • {ticket.class}{ticket.class === 2 ? 'nd' : 'st'} Class</p>
                    <p className="text-sm text-gray-600 mb-3">Valid {ticket.duration}h</p>
                    <div className="text-3xl font-bold text-blue-600">CHF {ticket.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticket Mode - Confirm & Use Credits */}
          {mode === 'ticket' && step === 'payment' && selectedTicket && (
            <div>
              <button onClick={() => setStep('select')} className="text-gray-600 hover:text-gray-800 mb-4">← Back</button>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Confirm Purchase</h2>
              
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-lg font-semibold">{selectedTicket.name}</p>
                    <p className="text-sm text-gray-600">{selectedTicket.route} • {selectedTicket.class}{selectedTicket.class === 2 ? 'nd' : 'st'} Class</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">CHF {selectedTicket.price}</div>
                </div>
              </div>

              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">Enter your card ID to use on-card credits:</p>
                <input
                  type="text"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  placeholder="e.g., A1B2C3D4E5F6G7"
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                {balance > 0 && (
                  <p className="mt-2 text-sm font-semibold text-green-600">
                    Card Balance: CHF {balance}
                  </p>
                )}
              </div>

              <button
                onClick={handlePayment}
                disabled={processing || !cardId}
                className="w-full py-4 bg-blue-600 text-white rounded-lg text-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {!cardId ? 'Enter Card ID First' : `Use Credits (CHF ${selectedTicket.price})`}
              </button>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="text-center py-16">
              <div className="animate-spin text-6xl mb-6">⚙️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {mode === 'credits' ? 'Processing Payment...' : 'Generating Ticket...'}
              </h2>
              <div className="space-y-2 text-gray-600">
                {mode === 'credits' ? (
                  <>
                    <p>✓ Payment confirmed</p>
                    <p>✓ Adding credits to card...</p>
                  </>
                ) : (
                  <>
                    <p>✓ Checking card balance</p>
                    <p>✓ Generating blinded token...</p>
                    <p>✓ HSM signing...</p>
                    <p>✓ Unblinding signature...</p>
                    <p>✓ Deducting credits...</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 4a: Card Write (Credits Mode) */}
          {mode === 'credits' && step === 'write' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6 animate-pulse">📱</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Write Credits to Card</h2>
              
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6 max-w-md mx-auto">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-5xl">📶</span>
                  <span className="text-5xl">💳</span>
                  <span className="text-5xl">�</span>
                </div>
                <p className="text-yellow-900 font-semibold text-lg mb-2">
                  Tap Card or Phone on NFC Reader
                </p>
                <p className="text-yellow-700 text-sm">
                  Hold for 1-2 seconds until you hear a beep
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <p className="text-sm text-green-800 mb-2">💰 Writing to card:</p>
                <p className="text-2xl font-bold text-green-600">CHF {selectedAmount}</p>
                <p className="text-sm text-green-700 mt-2">Payment confirmed - ready to write</p>
              </div>

              <button
                onClick={handleWriteCreditsToCard}
                disabled={writing}
                className="px-8 py-4 bg-green-600 text-white rounded-lg text-xl font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                {writing ? '✍️ Writing to Card...' : '📱 Place Card & Write'}
              </button>
            </div>
          )}

          {/* Step 4b: Card Write (Ticket Mode) */}
          {mode === 'ticket' && step === 'card_write' && ticketData && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6 animate-pulse">📱</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Write Ticket to Card</h2>
              
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6 max-w-md mx-auto">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-5xl">📶</span>
                  <span className="text-5xl">💳</span>
                  <span className="text-5xl">�</span>
                </div>
                <p className="text-yellow-900 font-semibold text-lg mb-2">
                  Tap Card or Phone on NFC Reader
                </p>
                <p className="text-yellow-700 text-sm">
                  Hold for 1-2 seconds until you hear a beep
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <p className="text-sm text-blue-800 mb-2">Virtual Card ID:</p>
                <p className="font-mono text-xs text-blue-900">{cardId}</p>
                <p className="text-sm text-green-800 mt-2">Remaining Balance: CHF {balance}</p>
              </div>

              <button
                onClick={handleWriteToCard}
                disabled={processing}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg text-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {processing ? '✍️ Writing to Card...' : '📱 Simulate Card Tap'}
              </button>

              <div className="mt-6 bg-gray-50 rounded-lg p-4 text-xs font-mono text-left max-w-md mx-auto">
                <p className="text-gray-600 mb-2">Ticket Data (will be written):</p>
                <p className="text-gray-800">Ticket ID: {ticketData.ticket_id.substring(0, 16)}...</p>
                <p className="text-gray-800">Route: {ticketData.route}</p>
                <p className="text-gray-800">Class: {ticketData.class}</p>
                <p className="text-gray-800">Valid: {selectedTicket.duration}h</p>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">✅</div>
              <h2 className="text-3xl font-bold text-green-600 mb-4">
                {mode === 'credits' ? 'Credits Added!' : 'Ticket Purchased!'}
              </h2>
              <p className="text-xl text-gray-700 mb-6">
                {mode === 'credits' 
                  ? `CHF ${selectedAmount} added to your card`
                  : 'Your ticket has been written to the card'
                }
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto mb-6">
                <p className="text-sm text-green-800 mb-3">Card UID: <span className="font-mono">{cardId}</span></p>
                {mode === 'credits' ? (
                  <>
                    <p className="text-sm text-green-800 mb-3">New Balance: CHF {selectedAmount}</p>
                    <p className="text-sm text-green-800">Ready to purchase tickets anonymously</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-green-800 mb-3">Remaining Balance: CHF {balance}</p>
                    <p className="text-sm text-green-800">Ready for validation at train entrance</p>
                  </>
                )}
              </div>

              <div className="space-y-3">
                {mode === 'ticket' && (
                  <Link
                    to={`/train-validator?cardId=${cardId}`}
                    className="block w-full max-w-md mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Test at Train Validator →
                  </Link>
                )}
                <button
                  onClick={handleReset}
                  className="block w-full max-w-md mx-auto px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
                >
                  {mode === 'credits' ? 'Back to Menu' : 'Purchase Another Ticket'}
                </button>
              </div>

              <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-lg mx-auto text-sm text-left">
                <p className="font-semibold text-purple-800 mb-2">🔐 Privacy Protection:</p>
                {mode === 'credits' ? (
                  <ul className="text-purple-700 space-y-1 list-disc list-inside">
                    <li>Backend records: "Payment for {selectedAmount} CHF credits"</li>
                    <li>No route or ticket information linked to payment</li>
                    <li>Generic credits can be used for any ticket</li>
                  </ul>
                ) : (
                  <ol className="text-purple-700 space-y-1 list-decimal list-inside">
                    <li>Credits deducted from card</li>
                    <li>Card generated blinded token</li>
                    <li>HSM signed without seeing ticket_id or card_id</li>
                    <li>Card unblinded signature</li>
                    <li>Ticket + signature written to card</li>
                    <li><strong>Backend cannot link credits payment → route</strong></li>
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-blue-800 mb-2">✅ System Features:</h3>
          <ul className="text-blue-700 space-y-1">
            <li>✅ Two-step privacy system (credits → tickets)</li>
            <li>✅ Blind signatures (backend cannot link payment to routes)</li>
            <li>✅ Physical NFC card simulation (Mifare DESFire EV3)</li>
            <li>✅ On-card credit balance</li>
            <li>✅ Offline ticket validation (no tracking)</li>
            <li>⏳ Real NFC hardware integration (needs ACR122U reader)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
