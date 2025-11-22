import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Wallet from './pages/Wallet'
import Validator from './pages/Validator'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/validator" element={<Validator />} />
        <Route path="/" element={<Navigate to="/wallet" replace />} />
      </Routes>
    </Router>
  )
}

export default App
