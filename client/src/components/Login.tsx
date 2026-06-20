import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from '../lib/auth-client'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

function Login() {
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setError('')
    const { error: signInError } = await signIn.email(values)
    if (signInError) {
      setError(signInError.message ?? 'Unable to sign in')
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-9 text-center shadow-lg dark:border-gray-800 dark:bg-zinc-900">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/50 bg-purple-500/10 text-xl font-semibold text-purple-500 dark:border-purple-400/50 dark:bg-purple-400/15 dark:text-purple-400">
          H
        </div>
        <h1 className="mb-1.5 text-2xl font-medium text-gray-950 dark:text-gray-100">
          Welcome back
        </h1>
        <p className="mb-7 text-base text-gray-500 dark:text-gray-400">
          Sign in to manage your tickets
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col items-stretch gap-0 text-left">
          <div className="mb-4 flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-gray-950 dark:text-gray-100">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-950 transition focus:border-purple-500/50 focus:outline-none focus:ring-[3px] focus:ring-purple-500/10 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/15 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-100 dark:focus:border-purple-400/50 dark:focus:ring-purple-400/15"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="mb-4 flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-gray-950 dark:text-gray-100">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
              {...register('password')}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-950 transition focus:border-purple-500/50 focus:outline-none focus:ring-[3px] focus:ring-purple-500/10 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/15 dark:border-gray-800 dark:bg-zinc-900 dark:text-gray-100 dark:focus:border-purple-400/50 dark:focus:ring-purple-400/15"
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          {error && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-purple-500 py-3 text-base font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 dark:bg-purple-400"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login
