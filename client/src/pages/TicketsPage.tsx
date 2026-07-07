import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import {
  createTicketSchema,
  ticketCategories,
  ticketStatuses,
  type CreateTicketInput,
  type UpdateTicketStatusInput,
} from 'core'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Status = (typeof ticketStatuses)[number]
type Category = (typeof ticketCategories)[number]

interface Ticket {
  id: number
  subject: string
  status: Status
  category: Category
  requesterName: string | null
  requesterEmail: string | null
  createdAt: string
}

type SortKey = 'status' | 'subject' | 'category' | 'requesterEmail' | 'createdAt'
type SortDirection = 'asc' | 'desc'

function compareTickets(a: Ticket, b: Ticket, key: SortKey) {
  if (key === 'createdAt') {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }
  const aValue = a[key] ?? ''
  const bValue = b[key] ?? ''
  return aValue.localeCompare(bValue)
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
}) {
  const isActive = sort.key === sortKey
  return (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? (
          sort.direction === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  )
}

function TicketsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'createdAt',
    direction: 'desc',
  })
  const [addOpen, setAddOpen] = useState(false)

  const {
    data: tickets = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => (await api.get<Ticket[]>('/tickets')).data,
    retry: false,
  })

  const addForm = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: '', category: 'OTHER', requesterName: '', requesterEmail: '' },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: UpdateTicketStatusInput }) =>
      (await api.patch<Ticket>(`/tickets/${id}`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const createTicketMutation = useMutation({
    mutationFn: async (values: CreateTicketInput) =>
      (await api.post<Ticket>('/tickets', values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      addForm.reset()
      setAddOpen(false)
    },
  })

  function onAddOpenChange(nextOpen: boolean) {
    setAddOpen(nextOpen)
    if (!nextOpen) {
      addForm.reset()
      createTicketMutation.reset()
    }
  }

  function onAddSubmit(values: CreateTicketInput) {
    createTicketMutation.mutate(values)
  }

  const addSubmitError = isAxiosError<{ message?: string }>(createTicketMutation.error)
    ? createTicketMutation.error.response?.data?.message
    : createTicketMutation.isError
      ? 'Unable to create ticket'
      : undefined

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = tickets.filter((ticket) => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false
      if (categoryFilter !== 'ALL' && ticket.category !== categoryFilter) return false
      if (query) {
        const haystack = `${ticket.subject} ${ticket.requesterName ?? ''} ${ticket.requesterEmail ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })

    return filtered.sort((a, b) => {
      const result = compareTickets(a, b, sort.key)
      return sort.direction === 'asc' ? result : -result
    })
  }, [tickets, search, statusFilter, categoryFilter, sort])

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 text-left">
      <h1 className="mb-6 font-heading text-3xl font-medium tracking-tight text-foreground">
        Tickets
      </h1>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="font-heading text-xl tracking-tight">All tickets</CardTitle>
          <CardDescription>{tickets.length} total</CardDescription>
          <CardAction>
            <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
              <DialogTrigger asChild>
                <Button>Add ticket</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add ticket</DialogTitle>
                  <DialogDescription>
                    Create a ticket, optionally on behalf of the person who reported it.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} noValidate>
                  <FieldGroup>
                    <Field data-invalid={!!addForm.formState.errors.subject}>
                      <FieldLabel htmlFor="ticket-subject">Subject</FieldLabel>
                      <Input
                        id="ticket-subject"
                        aria-invalid={!!addForm.formState.errors.subject}
                        {...addForm.register('subject')}
                      />
                      <FieldError
                        errors={
                          addForm.formState.errors.subject
                            ? [addForm.formState.errors.subject]
                            : undefined
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ticket-category">Category</FieldLabel>
                      <Controller
                        control={addForm.control}
                        name="category"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="ticket-category" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ticketCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field data-invalid={!!addForm.formState.errors.requesterName}>
                      <FieldLabel htmlFor="ticket-requester-name">Sender name (optional)</FieldLabel>
                      <Input id="ticket-requester-name" {...addForm.register('requesterName')} />
                    </Field>
                    <Field data-invalid={!!addForm.formState.errors.requesterEmail}>
                      <FieldLabel htmlFor="ticket-requester-email">Sender email (optional)</FieldLabel>
                      <Input
                        id="ticket-requester-email"
                        type="email"
                        aria-invalid={!!addForm.formState.errors.requesterEmail}
                        {...addForm.register('requesterEmail')}
                      />
                      <FieldError
                        errors={
                          addForm.formState.errors.requesterEmail
                            ? [addForm.formState.errors.requesterEmail]
                            : undefined
                        }
                      />
                    </Field>
                    {addSubmitError && <FieldError>{addSubmitError}</FieldError>}
                  </FieldGroup>
                  <DialogFooter className="mt-2">
                    <Button type="submit" disabled={createTicketMutation.isPending}>
                      {createTicketMutation.isPending ? 'Creating…' : 'Create ticket'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject or sender"
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as Status | 'ALL')}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {ticketStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as Category | 'ALL')}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {ticketCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPending ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="py-2 text-sm text-destructive">Failed to load tickets.</p>
          ) : tickets.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tickets yet.</p>
          ) : visibleTickets.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tickets match your filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                  <SortableHead
                    label="Subject"
                    sortKey="subject"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Category"
                    sortKey="category"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Sender"
                    sortKey="requesterEmail"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Created"
                    sortKey="createdAt"
                    sort={sort}
                    onSort={handleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Select
                        value={ticket.status}
                        onValueChange={(value) =>
                          updateStatusMutation.mutate({
                            id: ticket.id,
                            values: { status: value as Status },
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-28" aria-label={`Status for ${ticket.subject}`}>
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
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs tracking-tight text-muted-foreground">
                          #{ticket.id}
                        </span>{' '}
                        {ticket.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ticket.requesterName || ticket.requesterEmail ? (
                        <div className="flex flex-col">
                          {ticket.requesterName && <span className="text-foreground">{ticket.requesterName}</span>}
                          {ticket.requesterEmail && (
                            <span className="text-xs text-muted-foreground">{ticket.requesterEmail}</span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default TicketsPage
