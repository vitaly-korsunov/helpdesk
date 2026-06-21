import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface Ticket {
  id: number
  subject: string
  status: 'open' | 'closed'
}

function Home() {
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')

  const { data: health, isPending: healthPending } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string }>('/health')).data,
    retry: false,
  })

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => (await api.get<Ticket[]>('/tickets')).data,
  })

  const addTicketMutation = useMutation({
    mutationFn: async (subject: string) => (await api.post<Ticket>('/tickets', { subject })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setSubject('')
    },
  })

  function addTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    addTicketMutation.mutate(subject)
  }

  const healthLabel = healthPending ? 'checking...' : health?.status ?? 'unreachable'

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 text-left">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
          HelpDesk
        </h1>
        <Badge variant={healthLabel === 'ok' ? 'outline' : 'destructive'}>
          API: {healthLabel}
        </Badge>
      </div>

      <Card className="mb-6 border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="font-heading text-xl tracking-tight">New ticket</CardTitle>
          <CardDescription>Describe the issue you&apos;re seeing</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addTicket} className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor="subject" className="sr-only">
                Subject
              </FieldLabel>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="New ticket subject"
              />
            </Field>
            <Button type="submit">Add ticket</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl tracking-tight">Tickets</CardTitle>
          <CardDescription>{tickets.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="ticket-stub flex items-center justify-between gap-3 py-3 pr-1 text-sm text-foreground"
                >
                  <span>
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs tracking-tight text-muted-foreground">
                      #{ticket.id}
                    </span>{' '}
                    {ticket.subject}
                  </span>
                  <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                    {ticket.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default Home
