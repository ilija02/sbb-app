/**
 * Backend Tab - View keys, invalidated tickets, user balances, token purchases
 */

import { useState, useEffect } from 'react'
import {
  getAllCryptographicKeys,
  getAllInvalidatedTickets,
  getAllUserBalances,
  getAllTokenPurchases,
  getActiveCryptographicKey,
  subscribeToChanges
} from '../lib/storage'

export default function BackendTab({ validatorTime }) {
  console.log('[BackendTab] Component rendering...')
  
  const [keys, setKeys] = useState([])
  const [invalidatedTickets, setInvalidatedTickets] = useState([])
  const [userBalances, setUserBalances] = useState([])
  const [tokenPurchases, setTokenPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('balances') // balances, invalidated, purchases

  useEffect(() => {
    console.log('[BackendTab] useEffect triggered')
    loadData()
  }, []) // Only load once on mount, validatorTime changes don't require reload

  // Listen for cross-tab changes - update incrementally without loading state
  useEffect(() => {
    let updateTimeout = null
    let maxUpdateTimeout = null
    let lastNotificationTime = 0
    
    const unsubscribe = subscribeToChanges((change) => {
      // Update data when any backend store changes (without loading spinner)
      if (change.store === 'cryptographicKeys' || 
          change.store === 'invalidatedTickets' || 
          change.store === 'userBalances' || 
          change.store === 'tokenPurchases') {
        console.log('[BackendTab] Cross-tab change detected, updating data...', change)
        
        // Ignore 'clear' operations - we'll update when seed data sends 'update' notifications
        // This prevents showing 0 keys after restart before seed data is loaded
        if (change.operation === 'clear') {
          console.log('[BackendTab] Ignoring clear operation, waiting for seed data updates...')
          return
        }
        
        lastNotificationTime = Date.now()
        
        // Clear any existing timeout
        if (updateTimeout) {
          clearTimeout(updateTimeout)
        }
        
        // Schedule update - debounce rapid notifications
        updateTimeout = setTimeout(() => {
          console.log('[BackendTab] Executing debounced update...')
          updateDataIncrementally()
          if (maxUpdateTimeout) {
            clearTimeout(maxUpdateTimeout)
            maxUpdateTimeout = null
          }
        }, 200)
        
        // Also set a maximum timeout - if notifications keep coming, force update after 1 second
        // This ensures we always update even if notifications keep resetting the debounce
        if (!maxUpdateTimeout) {
          maxUpdateTimeout = setTimeout(() => {
            console.log('[BackendTab] Maximum timeout reached, forcing update...')
            if (updateTimeout) {
              clearTimeout(updateTimeout)
            }
            updateDataIncrementally()
            maxUpdateTimeout = null
          }, 1000)
        }
      }
    })
    return () => {
      unsubscribe()
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
      if (maxUpdateTimeout) {
        clearTimeout(maxUpdateTimeout)
      }
    }
  }, [])

  // Incremental update without loading state (preserves scroll position)
  const updateDataIncrementally = async () => {
    setError(null)
    try {
      console.log('[BackendTab] Updating data incrementally...')
      
      const [keysData, invalidatedData, balancesData, purchasesData] = await Promise.allSettled([
        getAllCryptographicKeys(),
        getAllInvalidatedTickets(),
        getAllUserBalances(),
        getAllTokenPurchases()
      ])
      
      if (keysData.status === 'fulfilled') {
        // Sort keys by createdAt descending (newest first)
        const sortedKeys = keysData.value.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        console.log('[BackendTab] Loaded keys:', sortedKeys.length)
        setKeys(sortedKeys)
      }
      if (invalidatedData.status === 'fulfilled') setInvalidatedTickets(invalidatedData.value)
      if (balancesData.status === 'fulfilled') setUserBalances(balancesData.value)
      if (purchasesData.status === 'fulfilled') setTokenPurchases(purchasesData.value)
    } catch (error) {
      console.error('[BackendTab] Error updating data:', error)
      setError(error.message)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('[BackendTab] Loading data...')
      const [keysData, ticketsData, balancesData, purchasesData] = await Promise.all([
        getAllCryptographicKeys().catch(err => {
          console.error('[BackendTab] Error loading keys:', err)
          return []
        }),
        getAllInvalidatedTickets().catch(err => {
          console.error('[BackendTab] Error loading invalidated tickets:', err)
          return []
        }),
        getAllUserBalances().catch(err => {
          console.error('[BackendTab] Error loading balances:', err)
          return []
        }),
        getAllTokenPurchases().catch(err => {
          console.error('[BackendTab] Error loading purchases:', err)
          return []
        })
      ])
      
      console.log('[BackendTab] Data loaded:', {
        keys: keysData?.length || 0,
        tickets: ticketsData?.length || 0,
        balances: balancesData?.length || 0,
        purchases: purchasesData?.length || 0
      })
      
      // Sort keys by creation date (newest first)
      if (Array.isArray(keysData)) {
        keysData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        setKeys(keysData)
      } else {
        setKeys([])
      }
      
      // Sort invalidated tickets by invalidation date (newest first)
      if (Array.isArray(ticketsData)) {
        ticketsData.sort((a, b) => (b.invalidatedAt || 0) - (a.invalidatedAt || 0))
        setInvalidatedTickets(ticketsData)
      } else {
        setInvalidatedTickets([])
      }
      
      // Sort balances by balance amount (highest first)
      if (Array.isArray(balancesData)) {
        balancesData.sort((a, b) => (b.balance || 0) - (a.balance || 0))
        setUserBalances(balancesData)
      } else {
        setUserBalances([])
      }
      
      // Sort purchases by timestamp (newest first)
      if (Array.isArray(purchasesData)) {
        purchasesData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        setTokenPurchases(purchasesData)
      } else {
        setTokenPurchases([])
      }
    } catch (error) {
      console.error('[BackendTab] Error loading backend data:', error)
      setError(error.message || 'Failed to load backend data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatTimeRemaining = (expiresAt) => {
    const now = validatorTime || Date.now()
    const remaining = expiresAt - now
    
    if (remaining < 0) return 'Expired'
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    
    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  const getKeyStatus = (key) => {
    const now = validatorTime || Date.now()
    if (!key.isActive) return { label: 'Inactive', color: 'gray' }
    if (key.expiresAt < now) return { label: 'Expired', color: 'red' }
    return { label: 'Active', color: 'green' }
  }

  // Note: Key rotation has been removed as we use signed expiry dates for security
  // Keys are created at startup and remain valid for their lifetime

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin text-4xl mb-4">⚙️</div>
        <p className="text-gray-600">Loading backend data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Safety check - ensure we have valid data structures
  const safeKeys = Array.isArray(keys) ? keys : []
  const safeInvalidatedTickets = Array.isArray(invalidatedTickets) ? invalidatedTickets : []
  const safeUserBalances = Array.isArray(userBalances) ? userBalances : []
  const safeTokenPurchases = Array.isArray(tokenPurchases) ? tokenPurchases : []

  const sections = [
    { id: 'balances', name: '💰 Balances', count: safeUserBalances.length },
    { id: 'invalidated', name: '🚫 Invalidated', count: safeInvalidatedTickets.length },
    { id: 'purchases', name: '🛒 Purchases', count: safeTokenPurchases.length },
  ]

  try {
    return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🖥️ Backend Dashboard</h1>
        <p className="text-sm text-gray-600">User balances, invalidated tickets, and purchase history</p>
      </div>

      {/* Section Tabs */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="flex border-b border-gray-200">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 px-4 py-3 font-semibold text-sm transition-colors ${
                activeSection === section.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {section.name} <span className="ml-1 text-xs opacity-75">({section.count})</span>
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="p-4">
          {/* User Balances */}
          {activeSection === 'balances' && (
            <div className="space-y-2">
              {safeUserBalances.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No user balances found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {safeUserBalances.map(balance => (
                    <div
                      key={balance.cardId}
                      className="border border-blue-200 rounded-lg p-4 bg-blue-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold">{balance.cardId}</span>
                        <span className="text-lg font-bold text-blue-700">CHF {balance.balance.toFixed(2)}</span>
                      </div>
                      {balance.updatedAt && (
                        <p className="text-xs text-gray-600">Updated: {formatDate(balance.updatedAt)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invalidated Tickets */}
          {activeSection === 'invalidated' && (
            <div className="space-y-2">
              {safeInvalidatedTickets.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No invalidated tickets found</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {safeInvalidatedTickets.map(ticket => (
                    <div
                      key={ticket.ticketId}
                      className="border border-red-200 rounded-lg p-3 bg-red-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-semibold">{ticket.ticketId.substring(0, 24)}...</span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-200 text-red-800">
                              Invalidated
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <p>Key ID: <span className="font-mono">{ticket.keyId}</span></p>
                            <p>Invalidated: {formatDate(ticket.invalidatedAt)}</p>
                            {ticket.validatorId && <p>Validator: {ticket.validatorId}</p>}
                            {ticket.location && <p>Location: {ticket.location}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Token Purchases */}
          {activeSection === 'purchases' && (
            <div className="space-y-2">
              {safeTokenPurchases.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No purchase history found</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {safeTokenPurchases.map(purchase => (
                    <div
                      key={purchase.id}
                      className="border border-green-200 rounded-lg p-3 bg-green-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold">{purchase.accountId || 'N/A'}</span>
                            <span className="text-lg font-bold text-green-700">CHF {purchase.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            <p>Date: {formatDate(purchase.timestamp)}</p>
                            {purchase.paymentMethod && <p>Method: {purchase.paymentMethod}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{safeKeys.filter(k => getKeyStatus(k).color === 'green').length}</div>
            <div className="text-xs text-gray-600">Active Keys</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              CHF {safeUserBalances.reduce((sum, b) => sum + (b.balance || 0), 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Total Balances</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{safeInvalidatedTickets.length}</div>
            <div className="text-xs text-gray-600">Invalidated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{safeTokenPurchases.length}</div>
            <div className="text-xs text-gray-600">Purchases</div>
          </div>
        </div>
      </div>
    </div>
    )
  } catch (renderError) {
    console.error('[BackendTab] Render error:', renderError)
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Rendering Backend Tab</h1>
        <p className="text-gray-600 mb-4">{renderError.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    )
  }
}
