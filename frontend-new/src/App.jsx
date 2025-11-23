import { useState, useEffect } from 'react'
import BackendTab from './components/BackendTab'
import ValidatorTab from './components/ValidatorTab'
import UserDeviceTab from './components/UserDeviceTab'
import KioskTab from './components/KioskTab'
import { initializeSeedData, hasSeedData } from './lib/seedData'
import { broadcastValidatorTime, subscribeToValidatorTime, clearAllData, setRestarting } from './lib/storage'

function App() {
  const [activeTab, setActiveTab] = useState('kiosk')
  const [initialized, setInitialized] = useState(false)
  const [validatorTime, setValidatorTime] = useState(Date.now()) // Global validator time (can be adjusted)
  const [isPlaying, setIsPlaying] = useState(false) // Auto-advance time state

  // Initialize seed data on startup
  useEffect(() => {
    let mounted = true
    
    async function init() {
      try {
        console.log('[APP] Starting initialization...')
        
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          if (mounted) {
            console.warn('[APP] Initialization timeout, forcing completion')
            setInitialized(true)
          }
        }, 10000) // 10 second timeout
        
        let hasData = false
        try {
          hasData = await hasSeedData()
          console.log('[APP] Has seed data?', hasData)
        } catch (error) {
          console.warn('[APP] Error checking seed data, will initialize anyway:', error)
          hasData = false
        }
        
        if (!hasData) {
          console.log('[APP] No seed data found, initializing...')
          try {
            const success = await initializeSeedData()
            console.log('[APP] Initialization result:', success)
            if (!success) {
              console.error('[APP] Failed to initialize seed data')
            }
          } catch (error) {
            console.error('[APP] Error during seed data initialization:', error)
            console.error('[APP] Error details:', error.message, error.stack)
          }
        } else {
          console.log('[APP] Seed data already exists, skipping initialization')
        }
        
        clearTimeout(timeout)
        if (mounted) {
          console.log('[APP] Setting initialized to true')
          setInitialized(true)
        }
      } catch (error) {
        console.error('[APP] Fatal error during initialization:', error)
        console.error('[APP] Error stack:', error.stack)
        if (mounted) {
          setInitialized(true) // Always show UI even on error
        }
      }
    }
    
    init()
    
    return () => {
      mounted = false
    }
  }, [])

  const tabs = [
    { id: 'kiosk', name: '🏪 Kiosk', component: KioskTab },
    { id: 'user', name: '📱 User Device', component: UserDeviceTab },
    { id: 'validator', name: '🎫 Validator', component: ValidatorTab },
    { id: 'backend', name: '🖥️ Backend', component: BackendTab },
  ]

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || KioskTab

  const formatValidatorTime = () => {
    return new Date(validatorTime).toLocaleString()
  }

  // Listen for validator time changes from other windows
  useEffect(() => {
    const unsubscribe = subscribeToValidatorTime((newTime) => {
      console.log('[APP] Validator time changed from another window:', newTime)
      setValidatorTime(newTime)
    })
    return unsubscribe
  }, [])

  // Auto-advance time when playing (1 hour per second)
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      const newTime = validatorTime + (60 * 60 * 1000) // Add 1 hour
      setValidatorTime(newTime)
      broadcastValidatorTime(newTime) // Broadcast to other windows
    }, 1000) // Run every second

    return () => clearInterval(interval)
  }, [isPlaying, validatorTime])

  const handleTimeAdjust = (hours) => {
    setIsPlaying(false) // Pause auto-play when manually adjusting
    const newTime = validatorTime + (hours * 60 * 60 * 1000)
    setValidatorTime(newTime)
    broadcastValidatorTime(newTime) // Broadcast to other windows
  }

  const handleResetTime = () => {
    setIsPlaying(false) // Pause auto-play when resetting
    const newTime = Date.now()
    setValidatorTime(newTime)
    broadcastValidatorTime(newTime) // Broadcast to other windows
  }

  const handleRestart = async () => {
    try {
      // Pause auto-play
      setIsPlaying(false)
      
      // Set restarting flag to prevent auto-key creation
      setRestarting(true)
      
      // Clear all storage
      await clearAllData()
      
      // Reset validator time to current time
      const newTime = Date.now()
      setValidatorTime(newTime)
      broadcastValidatorTime(newTime)
      
      // Re-initialize seed data with fresh timestamps based on current time
      await initializeSeedData(newTime)
      
      // Wait a bit to ensure all seed data is saved
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Reload the page to ensure everything is fresh and all components load correctly
      window.location.reload()
    } catch (error) {
      console.error('[APP] Error during restart:', error)
      // Make sure to reset the flag even on error
      setRestarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Global Validator Clock */}
      <div className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleRestart}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
                title="Clear all data and reload from seed data"
              >
                🔄 Restart
              </button>
              <span className="text-sm font-semibold">🕐 System Time:</span>
              <div className="text-xl font-mono font-bold">
                {formatValidatorTime()}
              </div>
              {validatorTime !== Date.now() && (
                <div className="text-xs bg-blue-700 px-2 py-1 rounded">
                  Offset: {Math.round((validatorTime - Date.now()) / (60 * 60 * 1000) * 10) / 10}h
                </div>
              )}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  isPlaying
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                title={isPlaying ? 'Pause time advancement' : 'Play: advance 1 hour per second'}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTimeAdjust(-1)}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm font-semibold transition-colors"
                title="Go back 1 hour"
              >
                -1h
              </button>
              <button
                onClick={() => handleTimeAdjust(-0.5)}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm font-semibold transition-colors"
                title="Go back 30 minutes"
              >
                -30m
              </button>
              <button
                onClick={handleResetTime}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm font-semibold transition-colors"
                title="Reset to real time"
              >
                Reset
              </button>
              <button
                onClick={() => handleTimeAdjust(0.5)}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm font-semibold transition-colors"
                title="Go forward 30 minutes"
              >
                +30m
              </button>
              <button
                onClick={() => handleTimeAdjust(1)}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm font-semibold transition-colors"
                title="Go forward 1 hour"
              >
                +1h
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-8" key={activeTab}>
        {!initialized ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin text-4xl mb-4">⚙️</div>
            <p className="text-gray-600">Initializing demo data...</p>
          </div>
        ) : (
          <ActiveComponent validatorTime={validatorTime} key={activeTab} />
        )}
      </div>
    </div>
  )
}

export default App

