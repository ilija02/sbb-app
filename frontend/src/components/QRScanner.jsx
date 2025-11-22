/**
 * QRScanner Component
 * 
 * MOCK IMPLEMENTATION - Simulates QR scanning for POC
 * In production, implement webcam access with @zxing/library or jsQR
 */

import { useState, useEffect, useRef } from 'react'

export default function QRScanner({ onScan, onError, isScanning }) {
  const videoRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)

  useEffect(() => {
    if (!isScanning) {
      stopCamera()
      return
    }

    startCamera()

    return () => stopCamera()
  }, [isScanning])

  const startCamera = async () => {
    try {
      // TODO: In production, implement actual webcam access
      // const stream = await navigator.mediaDevices.getUserMedia({ 
      //   video: { facingMode: 'environment' } 
      // })
      // if (videoRef.current) {
      //   videoRef.current.srcObject = stream
      // }
      
      setCameraActive(true)
      
      // TODO: Implement QR detection with @zxing/library
      // Example:
      // const codeReader = new BrowserQRCodeReader()
      // codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
      //   if (result) {
      //     onScan(result.getText())
      //   }
      // })
      
    } catch (error) {
      console.error('Camera access failed:', error)
      if (onError) {
        onError('Camera access denied. Please allow camera permissions.')
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject
      const tracks = stream.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video element (hidden in mock mode) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        style={{ display: cameraActive ? 'block' : 'none' }}
      />

      {/* Mock camera view */}
      {!cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-sm text-gray-400">
              Camera scanning not yet implemented
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Add @zxing/library for QR scanning
            </p>
          </div>
        </div>
      )}

      {/* Scanning overlay */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Scanning frame */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            <div className="absolute inset-0 border-4 border-blue-500 rounded-lg animate-pulse" />
            
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
          </div>

          {/* Instruction text */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white text-center">
            <p className="text-sm font-semibold">Position QR code in frame</p>
          </div>
        </div>
      )}
    </div>
  )
}
