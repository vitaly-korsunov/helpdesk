import { Link } from 'react-router-dom'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

interface NavBarProps {
  userName?: string
  isAdmin?: boolean
}

function NavBar({ userName, isAdmin }: NavBarProps) {
  return (
    <nav className="flex items-center justify-between border-b-2 border-primary/30 bg-card px-5 py-4">
      <span className="flex items-center gap-2 font-heading text-xl font-semibold tracking-wide text-foreground uppercase">
        <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        HelpDesk
      </span>
      {userName && (
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              to="/user"
              className="text-sm font-medium text-secondary-foreground hover:text-foreground"
            >
              Users
            </Link>
          )}
          <span className="font-mono text-sm text-muted-foreground">{userName}</span>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      )}
    </nav>
  )
}

export default NavBar
