import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import Login from './components/Login'
import Home from './pages/Home'
import TicketsPage from './pages/TicketsPage'
import UsersPage from './pages/UsersPage'
import { useSession } from './lib/auth-client'

function App() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <NavBar />
  }

  if (!session) {
    return (
      <>
        <NavBar />
        <Login />
      </>
    )
  }

  return (
    <>
      <NavBar userName={session.user.name} isAdmin={session.user.role === 'ADMIN'} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route
          path="/user"
          element={
            session.user.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </>
  )
}

export default App
