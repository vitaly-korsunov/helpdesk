import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { createUserSchema, type CreateUserInput } from 'core'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT'
  emailVerified: boolean
  createdAt: string
}

function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const {
    data: users = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    retry: false,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) })

  const createUserMutation = useMutation({
    mutationFn: async (values: CreateUserInput) =>
      (await api.post<User>('/users', values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      setOpen(false)
    },
  })

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      reset()
      createUserMutation.reset()
    }
  }

  function onSubmit(values: CreateUserInput) {
    createUserMutation.mutate(values)
  }

  const submitError = isAxiosError<{ message?: string }>(createUserMutation.error)
    ? createUserMutation.error.response?.data?.message
    : createUserMutation.isError
      ? 'Unable to create user'
      : undefined

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 text-left">
      <h1 className="mb-6 font-heading text-3xl font-medium tracking-tight text-foreground">
        Users
      </h1>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="font-heading text-xl tracking-tight">All users</CardTitle>
          <CardDescription>{users.length} total</CardDescription>
          <CardAction>
            <Dialog open={open} onOpenChange={onOpenChange}>
              <DialogTrigger asChild>
                <Button>Add user</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add user</DialogTitle>
                  <DialogDescription>
                    Create an account for a new admin or agent.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <FieldGroup>
                    <Field data-invalid={!!errors.name}>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        id="name"
                        autoComplete="name"
                        aria-invalid={!!errors.name}
                        {...register('name')}
                      />
                      <FieldError errors={errors.name ? [errors.name] : undefined} />
                    </Field>
                    <Field data-invalid={!!errors.email}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        {...register('email')}
                      />
                      <FieldError errors={errors.email ? [errors.email] : undefined} />
                    </Field>
                    <Field data-invalid={!!errors.password}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        aria-invalid={!!errors.password}
                        {...register('password')}
                      />
                      <FieldError errors={errors.password ? [errors.password] : undefined} />
                    </Field>
                    {submitError && <FieldError>{submitError}</FieldError>}
                  </FieldGroup>
                  <DialogFooter className="mt-2">
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? 'Creating…' : 'Create user'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="py-2 text-sm text-destructive">Failed to load users.</p>
          ) : users.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
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

export default UsersPage
