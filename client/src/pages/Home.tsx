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
import { Skeleton } from '@/components/ui/skeleton'

interface TicketMessage {
  id: number
  fromEmail: string
  body: string
  createdAt: string
}

interface Ticket {
  id: number
  subject: string
  status: 'open' | 'closed'
  requesterEmail: string | null
  messages: TicketMessage[]
}

function Home() {
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const { data: health, isPending: healthPending } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string }>('/health')).data,
    retry: false,
  })

  const { data: tickets = [], isPending: ticketsPending } = useQuery({
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

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 text-left">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
          HelpDesk
        </h1>
        {healthPending ? (
          <Skeleton className="h-5 w-24 rounded-full" />
        ) : (
          <Badge variant={health?.status === 'ok' ? 'outline' : 'destructive'}>
            API: {health?.status ?? 'unreachable'}
          </Badge>
        )}
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
          {ticketsPending ? (
            <ul className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 pr-1">
                  <span className="flex items-center gap-2">
                    <Skeleton className="h-5 w-8 rounded-sm" />
                    <Skeleton className="h-4 w-40" />
                  </span>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </li>
              ))}
            </ul>
          ) : tickets.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="py-3 pr-1 text-sm text-foreground">
                  <div className="ticket-stub flex items-center justify-between gap-3">
                    <span>
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs tracking-tight text-muted-foreground">
                        #{ticket.id}
                      </span>{' '}
                      {ticket.subject}
                    </span>
                    <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                      {ticket.status}
                    </Badge>
                  </div>
                  {(ticket.requesterEmail || ticket.messages.length > 0) && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {ticket.requesterEmail && <span>via email · {ticket.requesterEmail}</span>}
                      {ticket.messages.length > 0 && (
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => toggleExpanded(ticket.id)}
                        >
                          {expandedIds.has(ticket.id) ? 'Hide' : 'Show'} {ticket.messages.length}{' '}
                          {ticket.messages.length === 1 ? 'message' : 'messages'}
                        </button>
                      )}
                    </div>
                  )}
                  {expandedIds.has(ticket.id) && (
                    <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
                      {ticket.messages.map((message) => (
                        <li key={message.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{message.fromEmail}</span>:{' '}
                          {message.body}
                        </li>
                      ))}
                    </ul>
                  )}
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
