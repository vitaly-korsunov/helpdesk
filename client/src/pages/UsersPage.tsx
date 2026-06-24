import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Pencil, Trash2 } from 'lucide-react'
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from 'core'
import { api } from '@/lib/api'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [addOpen, setAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const {
    data: users = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    retry: false,
  })

  const addForm = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) })
  const editForm = useForm<UpdateUserInput>({ resolver: zodResolver(updateUserSchema) })

  const createUserMutation = useMutation({
    mutationFn: async (values: CreateUserInput) =>
      (await api.post<User>('/users', values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      addForm.reset()
      setAddOpen(false)
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateUserInput }) =>
      (await api.patch<User>(`/users/${id}`, values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      editForm.reset()
      setEditingUser(null)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeletingUser(null)
    },
  })

  function onAddOpenChange(nextOpen: boolean) {
    setAddOpen(nextOpen)
    if (!nextOpen) {
      addForm.reset()
      createUserMutation.reset()
    }
  }

  function onAddSubmit(values: CreateUserInput) {
    createUserMutation.mutate(values)
  }

  function openEditDialog(user: User) {
    setEditingUser(user)
    editForm.reset({ name: user.name, email: user.email, password: '' })
    updateUserMutation.reset()
  }

  function onEditOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEditingUser(null)
      editForm.reset()
      updateUserMutation.reset()
    }
  }

  function onEditSubmit(values: UpdateUserInput) {
    if (!editingUser) return
    updateUserMutation.mutate({ id: editingUser.id, values })
  }

  function onDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDeletingUser(null)
      deleteUserMutation.reset()
    }
  }

  function onDeleteConfirm() {
    if (!deletingUser) return
    deleteUserMutation.mutate(deletingUser.id)
  }

  const addSubmitError = isAxiosError<{ message?: string }>(createUserMutation.error)
    ? createUserMutation.error.response?.data?.message
    : createUserMutation.isError
      ? 'Unable to create user'
      : undefined

  const editSubmitError = isAxiosError<{ message?: string }>(updateUserMutation.error)
    ? updateUserMutation.error.response?.data?.message
    : updateUserMutation.isError
      ? 'Unable to update user'
      : undefined

  const deleteSubmitError = isAxiosError<{ message?: string }>(deleteUserMutation.error)
    ? deleteUserMutation.error.response?.data?.message
    : deleteUserMutation.isError
      ? 'Unable to delete user'
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
            <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
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
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} noValidate>
                  <FieldGroup>
                    <Field data-invalid={!!addForm.formState.errors.name}>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        id="name"
                        autoComplete="name"
                        aria-invalid={!!addForm.formState.errors.name}
                        {...addForm.register('name')}
                      />
                      <FieldError
                        errors={
                          addForm.formState.errors.name ? [addForm.formState.errors.name] : undefined
                        }
                      />
                    </Field>
                    <Field data-invalid={!!addForm.formState.errors.email}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        aria-invalid={!!addForm.formState.errors.email}
                        {...addForm.register('email')}
                      />
                      <FieldError
                        errors={
                          addForm.formState.errors.email ? [addForm.formState.errors.email] : undefined
                        }
                      />
                    </Field>
                    <Field data-invalid={!!addForm.formState.errors.password}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        aria-invalid={!!addForm.formState.errors.password}
                        {...addForm.register('password')}
                      />
                      <FieldError
                        errors={
                          addForm.formState.errors.password
                            ? [addForm.formState.errors.password]
                            : undefined
                        }
                      />
                    </Field>
                    {addSubmitError && <FieldError>{addSubmitError}</FieldError>}
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
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${user.name}`}
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${user.name}`}
                          disabled={user.role === 'ADMIN'}
                          title={user.role === 'ADMIN' ? 'Admin users cannot be deleted' : undefined}
                          onClick={() => setDeletingUser(user)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingUser !== null} onOpenChange={onEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update the user&apos;s details. Leave the password blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!editForm.formState.errors.name}>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  id="edit-name"
                  autoComplete="name"
                  aria-invalid={!!editForm.formState.errors.name}
                  {...editForm.register('name')}
                />
                <FieldError
                  errors={
                    editForm.formState.errors.name ? [editForm.formState.errors.name] : undefined
                  }
                />
              </Field>
              <Field data-invalid={!!editForm.formState.errors.email}>
                <FieldLabel htmlFor="edit-email">Email</FieldLabel>
                <Input
                  id="edit-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!editForm.formState.errors.email}
                  {...editForm.register('email')}
                />
                <FieldError
                  errors={
                    editForm.formState.errors.email ? [editForm.formState.errors.email] : undefined
                  }
                />
              </Field>
              <Field data-invalid={!!editForm.formState.errors.password}>
                <FieldLabel htmlFor="edit-password">Password</FieldLabel>
                <Input
                  id="edit-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  aria-invalid={!!editForm.formState.errors.password}
                  {...editForm.register('password')}
                />
                <FieldError
                  errors={
                    editForm.formState.errors.password
                      ? [editForm.formState.errors.password]
                      : undefined
                  }
                />
              </Field>
              {editSubmitError && <FieldError>{editSubmitError}</FieldError>}
            </FieldGroup>
            <DialogFooter className="mt-2">
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingUser !== null} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.name}? They will lose access
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteSubmitError && (
            <p className="text-sm text-destructive">{deleteSubmitError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteUserMutation.isPending}
              onClick={onDeleteConfirm}
            >
              {deleteUserMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default UsersPage
