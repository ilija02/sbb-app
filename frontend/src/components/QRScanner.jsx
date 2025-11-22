/**
 * QRScanner Component
 * 
 * Implements QR code scanning using @zxing/library with webcam access
 */

import { useState, useEffect, useRef } from 'react'
import { BrowserQRCodeReader } from '@zxing/library'

export default function QRScanner({ onScan, onError, isScanning }) {
  const videoRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const codeReaderRef = useRef(null)
  const scanningRef = useRef(false)

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
      // Create QR code reader
      const codeReader = new BrowserQRCodeReader()
      codeReaderRef.current = codeReader
      
      // Get video devices
      const videoInputDevices = await codeReader.listVideoInputDevices()
      
      if (videoInputDevices.length === 0) {
        throw new Error('No camera found')
      }
      
      // Use back camera if available, otherwise use first camera
      const selectedDevice = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      ) || videoInputDevices[0]
      
      console.log('Using camera:', selectedDevice.label)
      
      setCameraActive(true)
      scanningRef.current = true
      
      // Start decoding from video device
      await codeReader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current,
        (result, error) => {
          if (result && scanningRef.current) {
            console.log('QR Code detected:', result.getText())
            onScan(result.getText())
            scanningRef.current = false // Stop scanning after first successful scan
          }
          
          if (error && error.name !== 'NotFoundException') {
            // NotFoundException is expected when no QR code is in view
            console.error('Scanning error:', error)
          }
        }
      )
      
    } catch (error) {
      console.error('Camera access failed:', error)
      setCameraActive(false)
      if (onError) {
        onError(`Camera error: ${error.message}. Please allow camera permissions.`)
      }
    }
  }

  const stopCamera = () => {
    scanningRef.current = false
    
    // Stop the code reader
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
      codeReaderRef.current = null
    }
    
    // Stop video stream
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
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Loading state */}
      {!cameraActive && isScanning && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-center">
            <div className="text-6xl mb-4 animate-pulse">📷</div>
            <p className="text-sm text-gray-400">
              Requesting camera access...
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Please allow camera permissions
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
