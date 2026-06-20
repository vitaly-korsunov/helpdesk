import { useEffect, useState } from 'react'
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
      <main className="mx-auto max-w-md px-5 py-8 text-left">
        <h1 className="my-8 text-5xl font-medium tracking-tight text-gray-950 max-md:my-5 max-md:text-4xl dark:text-gray-100">
          HelpDesk
        </h1>
        <p className="text-gray-500 dark:text-gray-400">API status: {health}</p>

        <form onSubmit={addTicket} className="mb-6 mt-4 flex gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New ticket subject"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-purple-500 px-4 py-2 font-semibold text-white hover:opacity-90 dark:bg-purple-400"
          >
            Add ticket
          </button>
        </form>

        <ul className="list-none p-0">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="border-b border-gray-200 py-2 dark:border-gray-800"
            >
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
