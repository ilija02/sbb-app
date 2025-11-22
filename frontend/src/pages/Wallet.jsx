import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Wallet() {
  const [tokens, setTokens] = useState([])
  const [generating, setGenerating] = useState(false)

  const generateToken = async () => {
    setGenerating(true)
    
    // TODO: Implement full blind signature flow
    // 1. Generate random token T (256-bit)
    // 2. Fetch issuer public key from /api/keys/public
    // 3. Blind token B(T)
    // 4. Send B(T) to payment adapter
    // 5. Receive Sig(B(T))
    // 6. Unblind to get Sig(T)
    // 7. Store in IndexedDB
    
    // For now, generate a dummy token
    const dummyToken = {
      id: Date.now().toString(),
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''),
      signature: 'dummy-signature',
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created: new Date().toISOString(),
    }
    
    setTokens([...tokens, dummyToken])
    setGenerating(false)
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

        {/* Generate Token Button */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Purchase Token</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Generate a new anonymous token. In production, this would involve payment processing and blind signature issuance.
          </p>
          <button
            onClick={generateToken}
            disabled={generating}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {generating ? 'Generating...' : '+ Generate New Token'}
          </button>
        </div>

        {/* Token List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">My Tokens</h2>
          
          {tokens.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="text-gray-500">No tokens yet. Generate your first token above.</p>
            </div>
          ) : (
            tokens.map((token) => (
              <div key={token.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {token.token.substring(0, 16)}...
                  </span>
                  <span className="text-xs text-green-600 font-semibold">✓ Valid</span>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Created: {new Date(token.created).toLocaleString()}</p>
                  <p>Expires: {new Date(token.expiry).toLocaleString()}</p>
                </div>

                <button className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  Show QR Code
                </button>
              </div>
            ))
          )}
        </div>

        {/* Developer Notes */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-yellow-800 mb-2">🚧 Developer B - TODO:</h3>
          <ul className="text-yellow-700 space-y-1 list-disc list-inside">
            <li>Implement RSA blinding/unblinding utilities</li>
            <li>Integrate with backend `/api/keys/public` and `/api/v1/sign_blinded`</li>
            <li>Add IndexedDB storage for tokens</li>
            <li>Implement QR code generation (qrcode.react)</li>
            <li><strong>Implement rotating cryptographic proofs (RCP) for day tickets</strong> — QR code regenerates every 30-60s using HMAC(master_secret, current_epoch)</li>
            <li>Add countdown timer showing "QR refreshes in Xs..."</li>
            <li>Add service worker for offline support</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
