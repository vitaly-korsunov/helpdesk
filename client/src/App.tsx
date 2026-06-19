import { useEffect, useState } from 'react'
import './App.css'

interface Ticket {
  id: number
  subject: string
  status: 'open' | 'closed'
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [subject, setSubject] = useState('')

  useEffect(() => {
    fetch('/api/tickets')
      .then((res) => res.json())
      .then(setTickets)
  }, [])

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

  return (
    <main>
      <h1>HelpDesk</h1>

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
  )
}

export default App
