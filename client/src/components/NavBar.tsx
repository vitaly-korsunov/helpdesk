import { Link } from 'react-router-dom'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

interface NavBarProps {
  userName?: string
  isAdmin?: boolean
}

function NavBar({ userName, isAdmin }: NavBarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-border px-5 py-4">
      <span className="font-heading font-semibold text-foreground">HelpDesk</span>
      {userName && (
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link to="/user" className="text-sm text-muted-foreground hover:text-foreground">
              Users
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{userName}</span>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      )}
    </nav>
  )
}

export default NavBar
