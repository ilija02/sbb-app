import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import RotatingQRCode from '../components/RotatingQRCode'
import { generateToken, blindToken, unblindSignature } from '../lib/crypto'
import { getPublicKey, signBlindedToken } from '../lib/api'
import { saveToken, getAllTokens, deleteToken, saveMasterSecret } from '../lib/storage'

export default function Wallet() {
  const [tokens, setTokens] = useState([])
  const [generating, setGenerating] = useState(false)
  const [selectedToken, setSelectedToken] = useState(null)
  const [showQR, setShowQR] = useState(false)

  // Load tokens from IndexedDB on mount
  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    const storedTokens = await getAllTokens()
    setTokens(storedTokens)
  }

  const generateNewToken = async (ticketType = 'single') => {
    setGenerating(true)
    
    try {
      // 1. Generate random token T (256-bit)
      const token = generateToken()
      
      // 2. Fetch issuer public key
      const publicKey = await getPublicKey()
      
      // 3. Blind token B(T)
      const blindedToken = blindToken(token, publicKey)
      
      // 4. Send B(T) to backend (with mock payment proof)
      const paymentProof = 'mock_payment_' + Date.now()
      const signedBlindedToken = await signBlindedToken(blindedToken, paymentProof)
      
      // 5. Unblind to get Sig(T)
      const signature = unblindSignature(signedBlindedToken, 'blinding_factor')
      
      // 6. Create token record
      const expiryHours = ticketType === 'day' ? 24 : 2
      const tokenRecord = {
        id: Date.now().toString(),
        token,
        signature,
        ticketType,
        expiry: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
        created: new Date().toISOString(),
      }
      
      // If day ticket, generate and store master secret for rotating proofs
      if (ticketType === 'day') {
        const masterSecret = generateToken() // Use another random token as master secret
        tokenRecord.masterSecret = masterSecret
        await saveMasterSecret(tokenRecord.id, masterSecret)
      }
      
      // 7. Store in IndexedDB
      await saveToken(tokenRecord)
      
      // Update UI
      await loadTokens()
      
    } catch (error) {
      console.error('Failed to generate token:', error)
      alert('Failed to generate token: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleShowQR = (token) => {
    setSelectedToken(token)
    setShowQR(true)
  }

  const handleDeleteToken = async (tokenId) => {
    if (confirm('Delete this token?')) {
      await deleteToken(tokenId)
      await loadTokens()
      if (selectedToken?.id === tokenId) {
        setShowQR(false)
        setSelectedToken(null)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🎟️ Wallet</h1>
          <Link 
            to="/validator" 
            className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg shadow hover:shadow-md transition"
          >
            Switch to Validator →
          </Link>
        </div>

        {/* QR Code Modal */}
        {showQR && selectedToken && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Your Ticket</h2>
                <button
                  onClick={() => setShowQR(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <RotatingQRCode
                token={selectedToken}
                masterSecret={selectedToken.masterSecret}
                epochDuration={30000}
              />
              
              <div className="mt-6 text-center space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Type:</strong> {selectedToken.ticketType === 'day' ? 'Day Ticket (24h)' : 'Single Journey'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Expires:</strong> {new Date(selectedToken.expiry).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-4">
                  Show this QR code to the conductor for validation
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Token Buttons */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Purchase Ticket</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Generate a new anonymous ticket using blind signatures. Choose ticket type:
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => generateNewToken('single')}
              disabled={generating}
              className="px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              <div className="text-2xl mb-2">🎫</div>
              <div className="text-sm">Single Journey</div>
              <div className="text-xs opacity-75 mt-1">Valid 2 hours</div>
            </button>
            
            <button
              onClick={() => generateNewToken('day')}
              disabled={generating}
              className="px-6 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              <div className="text-2xl mb-2">🎟️</div>
              <div className="text-sm">Day Ticket</div>
              <div className="text-xs opacity-75 mt-1">Valid 24 hours</div>
            </button>
          </div>
          
          {generating && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Generating token... (blinding, signing, unblinding)
            </div>
          )}
        </div>

        {/* Token List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">My Tickets</h2>
          
          {tokens.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="text-gray-500">No tickets yet. Purchase your first ticket above.</p>
            </div>
          ) : (
            tokens.map((token) => {
              const isExpired = new Date(token.expiry) < new Date()
              const isDayTicket = token.ticketType === 'day'
              
              return (
                <div key={token.id} className={`bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition ${isExpired ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-lg font-semibold text-gray-800">
                        {isDayTicket ? '🎟️ Day Ticket' : '🎫 Single Journey'}
                      </span>
                      {isDayTicket && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          Rotating QR
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                      {isExpired ? '✗ Expired' : '✓ Valid'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p>Created: {new Date(token.created).toLocaleString()}</p>
                    <p>Expires: {new Date(token.expiry).toLocaleString()}</p>
                    <p className="text-xs font-mono bg-gray-50 p-2 rounded mt-2 truncate">
                      Token: {token.token.substring(0, 32)}...
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShowQR(token)}
                      disabled={isExpired}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      Show QR Code
                    </button>
                    <button
                      onClick={() => handleDeleteToken(token.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Status Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-blue-800 mb-2">✅ Implementation Status:</h3>
          <ul className="text-blue-700 space-y-1">
            <li>✅ Blind signature flow (MOCK - crypto utilities ready)</li>
            <li>✅ IndexedDB storage with persistence</li>
            <li>✅ QR code generation with qrcode.react</li>
            <li>✅ Rotating cryptographic proofs for day tickets (30s epochs)</li>
            <li>✅ Countdown timer for QR refresh</li>
            <li>⏳ Service worker for offline support (TODO)</li>
            <li>⏳ Backend API integration (using mock API for now)</li>
          </ul>
        </div>
        
        {/* Developer Notes */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
          <p><strong>Note:</strong> This is using mock implementations. When backend is ready:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Set <code>MOCK_MODE = false</code> in <code>src/lib/api.js</code></li>
            <li>Implement real RSA blinding in <code>src/lib/crypto.js</code></li>
            <li>Connect to backend endpoints</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
