import { useEffect, useState } from 'react'
import './App.css'
import NavBar from './components/NavBar'
import Login from './components/Login'
import { useSession } from './lib/auth-client'

interface Ticket {
  id: number
  subject: string
  status: 'open' | 'closed'
}

function App() {
  const { data: session, isPending } = useSession()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [subject, setSubject] = useState('')
  const [health, setHealth] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('unreachable'))
  }, [])

  useEffect(() => {
    if (!session) return
    fetch('/api/tickets')
      .then((res) => res.json())
      .then(setTickets)
  }, [session])

  async function addTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    const ticket = await res.json()
    setTickets((prev) => [...prev, ticket])
    setSubject('')
  }

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
      <NavBar userName={session.user.name} />
      <main>
        <h1>HelpDesk</h1>
        <p>API status: {health}</p>

        <form onSubmit={addTicket}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New ticket subject"
          />
          <button type="submit">Add ticket</button>
        </form>

        <ul>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <strong>#{ticket.id}</strong> {ticket.subject} —{' '}
              <em>{ticket.status}</em>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

export default App
