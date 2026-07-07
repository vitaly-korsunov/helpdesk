import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  ticketCategories,
  ticketStatuses,
  type UpdateTicketStatusInput,
} from 'core'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

type Status = (typeof ticketStatuses)[number]
type Category = (typeof ticketCategories)[number]

interface TicketMessage {
  id: number
  fromEmail: string
  body: string
  createdAt: string
}

interface Ticket {
  id: number
  subject: string
  status: Status
  category: Category
  requesterName: string | null
  requesterEmail: string | null
  createdAt: string
  messages: TicketMessage[]
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const {
    data: ticket,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get<Ticket>(`/tickets/${id}`)).data,
    retry: false,
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (values: UpdateTicketStatusInput) =>
      (await api.patch<Ticket>(`/tickets/${id}`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const notFound =
    isError && (error as { response?: { status?: number } })?.response?.status === 404

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 text-left">
      <Link
        to="/tickets"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to tickets
      </Link>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : notFound ? (
        <p className="py-2 text-sm text-muted-foreground">
          This ticket doesn&apos;t exist. It may have been removed.
        </p>
      ) : isError || !ticket ? (
        <p className="py-2 text-sm text-destructive">Failed to load ticket.</p>
      ) : (
        <>
          <Card className="mb-6 border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl tracking-tight">
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm tracking-tight text-muted-foreground">
                  #{ticket.id}
                </span>
                {ticket.subject}
              </CardTitle>
              <CardAction>
                <Select
                  value={ticket.status}
                  onValueChange={(value) =>
                    updateStatusMutation.mutate({ status: value as Status })
                  }
                >
                  <SelectTrigger size="sm" className="w-32" aria-label="Ticket status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Category</dt>
                <dd>
                  <Badge variant="outline">{ticket.category}</Badge>
                </dd>
                <dt className="text-muted-foreground">Requester</dt>
                <dd className="text-foreground">
                  {ticket.requesterName || ticket.requesterEmail ? (
                    <span>
                      {ticket.requesterName && <span>{ticket.requesterName} </span>}
                      {ticket.requesterEmail && (
                        <span className="text-muted-foreground">
                          {ticket.requesterName
                            ? `<${ticket.requesterEmail}>`
                            : ticket.requesterEmail}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">{formatDateTime(ticket.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg tracking-tight">
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.messages.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No messages on this ticket yet.
                </p>
              ) : (
                <ol className="space-y-4">
                  {ticket.messages.map((message, index) => (
                    <li key={message.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {message.fromEmail}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDateTime(message.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {message.body}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}

export default TicketDetailPage
