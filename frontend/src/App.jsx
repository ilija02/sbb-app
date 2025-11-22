import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Validator from './pages/Validator'
import KioskPurchase from './pages/KioskPurchase'
import TrainValidator from './pages/TrainValidator'

function App() {
  return (
    <Router>
      <Routes>
        {/* V3.0 Routes - Physical Cards + NFC */}
        <Route path="/kiosk" element={<KioskPurchase />} />
        <Route path="/train-validator" element={<TrainValidator />} />
        
        {/* V2.0 Conductor Handheld */}
        <Route path="/validator" element={<Validator />} />
        
        {/* Default to V3.0 Kiosk */}
        <Route path="/" element={<Navigate to="/kiosk" replace />} />
      </Routes>
    </Router>
  )
}

export default App
