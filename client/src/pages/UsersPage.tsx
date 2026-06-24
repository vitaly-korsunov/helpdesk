import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  const {
    data: users = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    retry: false,
  })

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 text-left">
      <h1 className="mb-6 font-heading text-3xl font-medium tracking-tight text-foreground">
        Users
      </h1>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="font-heading text-xl tracking-tight">All users</CardTitle>
          <CardDescription>{users.length} total</CardDescription>
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
