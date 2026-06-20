import { signOut } from '../lib/auth-client'

interface NavBarProps {
  userName?: string
}

function NavBar({ userName }: NavBarProps) {
  return (
    <nav className="navbar">
      <span className="navbar-brand">HelpDesk</span>
      {userName && (
        <div className="navbar-user">
          <span>{userName}</span>
          <button type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}

export default NavBar
