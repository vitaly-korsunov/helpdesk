import { signOut } from '../lib/auth-client'

interface NavBarProps {
  userName?: string
}

function NavBar({ userName }: NavBarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
      <span className="font-semibold text-gray-950 dark:text-gray-100">HelpDesk</span>
      {userName && (
        <div className="flex items-center gap-3">
          <span>{userName}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}

export default NavBar
