import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { api } from '@/lib/api'
import { getDeviceMeta } from '@/lib/device'
import { useAuthStore } from '@/stores/auth-store'
import type { LoginPayload, RegisterPayload } from '@/types/auth'

interface AuthFormProps {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: AuthFormProps) {
  const setSession = useAuthStore((state) => state.setSession)
  const [form, setForm] = useState<RegisterPayload>({
    email: '',
    username: '',
    displayName: '',
    password: '',
  })
  const [loginForm, setLoginForm] = useState<LoginPayload>({
    identifier: '',
    password: '',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const device = getDeviceMeta()
      if (mode === 'register') {
        return api.register({ ...form, ...device })
      }

      return api.login({ ...loginForm, ...device })
    },
    onSuccess: (data) => {
      setSession(data)
    },
  })

  const isRegister = mode === 'register'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--chat-bg)] px-4 py-10">
      <div className="telegram-pattern pointer-events-none absolute inset-0" />
      <div className="relative z-10 w-full max-w-[360px]">
        <div className="mb-5 flex items-center justify-end">
          <ThemeToggle />
        </div>

        <Card className="rounded-xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.18)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[20px] font-medium">
              {isRegister ? 'Sign up' : 'Log in to Chat App'}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? 'Enter your details to create an account.'
                : 'Please enter your email or username and password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate()
              }}
            >
              {isRegister ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          displayName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or username</Label>
                  <Input
                    id="identifier"
                    value={loginForm.identifier}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        identifier: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={isRegister ? form.password : loginForm.password}
                  onChange={(event) =>
                    isRegister
                      ? setForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      : setLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                  }
                  required
                  minLength={8}
                />
              </div>

              {mutation.error ? (
                <p className="text-sm text-red-500">
                  {mutation.error.message === 'Failed to fetch'
                    ? 'Cannot reach the API. Make sure the backend is running on port 3000, then refresh.'
                    : mutation.error.message}
                </p>
              ) : null}

              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? 'Please wait...'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                className="font-medium text-[var(--accent)] hover:underline"
                to={isRegister ? '/login' : '/register'}
              >
                {isRegister ? 'Sign in' : 'Sign up'}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
