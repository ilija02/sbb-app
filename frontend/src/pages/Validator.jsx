import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'

export default function Validator() {
  const [scanResult, setScanResult] = useState(null)
  const [status, setStatus] = useState('idle') // idle | scanning | valid | invalid
  const [offlineMode, setOfflineMode] = useState(false)
  const videoRef = useRef(null)

  const startScanning = () => {
    setStatus('scanning')
    // TODO: Implement QR scanning with @zxing/library
    // 1. Access webcam
    // 2. Scan QR code
    // 3. Parse payload {t, sig, exp, proof}
    // 4. Verify signature locally using public key
    // 5. Check Bloom filter if offline
    // 6. POST to /api/v1/redeem if online
    alert('QR scanning not yet implemented. Add @zxing/library and implement webcam access.')
  }

  const simulateValidScan = () => {
    setStatus('valid')
    setScanResult({
      token: 'abc123...',
      expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      validator: 'laptop-01',
    })
    setTimeout(() => {
      setStatus('idle')
      setScanResult(null)
    }, 3000)
  }

  const simulateInvalidScan = () => {
    setStatus('invalid')
    setScanResult({
      reason: 'Token already spent',
    })
    setTimeout(() => {
      setStatus('idle')
      setScanResult(null)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🔍 Validator</h1>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${offlineMode ? 'bg-orange-500' : 'bg-green-500'}`}></div>
              <span className="text-sm">{offlineMode ? 'Offline' : 'Online'}</span>
            </div>
            <Link 
              to="/wallet" 
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              ← Switch to Wallet
            </Link>
          </div>
        </div>

        {/* Main Scan Area */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 mb-6">
          {status === 'idle' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-64 h-64 mx-auto bg-gray-700 rounded-lg flex items-center justify-center">
                  <video 
                    ref={videoRef}
                    className="w-full h-full object-cover rounded-lg hidden"
                  />
                  <span className="text-gray-500 text-6xl">📷</span>
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-4">Ready to Scan</h2>
              <p className="text-gray-400 mb-6">Point camera at passenger's QR code</p>
              <button
                onClick={startScanning}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg text-xl font-semibold hover:bg-blue-700 transition"
              >
                Start Scanning
              </button>
              
              {/* Demo Buttons */}
              <div className="mt-8 pt-8 border-t border-gray-700">
                <p className="text-gray-500 text-sm mb-3">Demo Mode (for testing):</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={simulateValidScan}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Simulate Valid Ticket
                  </button>
                  <button
                    onClick={simulateInvalidScan}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Simulate Invalid Ticket
                  </button>
                </div>
              </div>
            </div>
          )}

          {status === 'scanning' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-64 h-64 mx-auto bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="animate-pulse text-6xl">📸</div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Scanning...</h2>
              <p className="text-gray-400">Position QR code in frame</p>
            </div>
          )}

          {status === 'valid' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-64 h-64 mx-auto bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-9xl">✓</span>
                </div>
              </div>
              <h2 className="text-4xl font-bold text-green-400 mb-4">TICKET VALID</h2>
              <p className="text-xl text-gray-300">Expires in 60 minutes</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-64 h-64 mx-auto bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-9xl">✗</span>
                </div>
              </div>
              <h2 className="text-4xl font-bold text-red-400 mb-4">INVALID</h2>
              <p className="text-xl text-gray-300">{scanResult?.reason || 'Token verification failed'}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOfflineMode(!offlineMode)}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            {offlineMode ? 'Go Online' : 'Go Offline'}
          </button>
          <button
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Sync Offline Logs (0)
          </button>
        </div>

        {/* Developer Notes */}
        <div className="mt-8 bg-yellow-900 border border-yellow-700 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-yellow-400 mb-2">🚧 Developer B - TODO:</h3>
          <ul className="text-yellow-300 space-y-1 list-disc list-inside">
            <li>Implement webcam QR scanning (@zxing/library or jsQR)</li>
            <li>Add RSA signature verification (client-side using public key)</li>
            <li>Implement Bloom filter download and checks</li>
            <li>Add online redemption (POST /api/v1/redeem)</li>
            <li>Implement offline log storage (IndexedDB)</li>
            <li>Add sync functionality (POST /api/v1/sync_offline)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
