import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Listings from './pages/Listings'
import Groups from './pages/Groups'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/groups" element={<Groups />} />
      </Routes>
    </Layout>
  )
}

export default App
