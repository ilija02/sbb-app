/**
 * RotatingQRCode Component
 * 
 * Displays a QR code that regenerates every 30-60 seconds with rotating proofs
 * to prevent screenshot sharing of day tickets
 */

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'
import { generateRotatingProof, generateQRPayload } from '../lib/crypto'

export default function RotatingQRCode({ token, masterSecret, epochDuration = 30000 }) {
  const [qrData, setQrData] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentProof, setCurrentProof] = useState(null)

  // Generate QR code with rotating proof
  useEffect(() => {
    if (!token) return

    const generateQR = async () => {
      // If token has a master secret (day ticket), generate rotating proof
      let proof = null
      let epoch = null
      
      if (masterSecret) {
        const proofData = await generateRotatingProof(masterSecret, epochDuration)
        proof = proofData.proof
        epoch = proofData.epoch
        setCurrentProof(proofData)
      }

      // Generate QR payload
      const payload = generateQRPayload({
        token: token.token,
        signature: token.signature,
        expiry: token.expiry,
        proof,
        epoch
      })

      setQrData(payload)
    }

    generateQR()

    // If using rotating proofs, regenerate periodically
    if (masterSecret) {
      const interval = setInterval(generateQR, epochDuration)
      return () => clearInterval(interval)
    }
  }, [token, masterSecret, epochDuration])

  // Update countdown timer
  useEffect(() => {
    if (!currentProof) return

    const updateTimer = () => {
      const remaining = Math.max(0, currentProof.expiresAt - Date.now())
      setTimeRemaining(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [currentProof])

  if (!qrData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-gray-400">Generating QR code...</div>
      </div>
    )
  }

  const timeRemainingSeconds = Math.ceil(timeRemaining / 1000)
  const isExpiringSoon = timeRemainingSeconds <= 5

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <QRCode
          value={qrData}
          size={256}
          level="M"
          includeMargin={true}
          renderAs="svg"
        />
      </div>

      {/* Rotating Proof Info */}
      {masterSecret && currentProof && (
        <div className="mt-4 text-center">
          <div className={`text-sm font-mono ${isExpiringSoon ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
            QR refreshes in {timeRemainingSeconds}s
          </div>
          {isExpiringSoon && (
            <div className="text-xs text-orange-500 mt-1">
              🔄 Regenerating...
            </div>
          )}
          <div className="text-xs text-gray-400 mt-2">
            Epoch: {currentProof.epoch}
          </div>
        </div>
      )}

      {/* Static Token Info */}
      {!masterSecret && (
        <div className="mt-4 text-center">
          <div className="text-xs text-gray-500">
            Single-use token
          </div>
        </div>
      )}

      {/* Anti-Screenshot Warning */}
      {masterSecret && (
        <div className="mt-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg max-w-xs">
          <p className="text-xs text-yellow-800 text-center">
            ⚠️ This QR code changes every {epochDuration / 1000}s to prevent sharing
          </p>
        </div>
      )}
    </div>
  )
}
