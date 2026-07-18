import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthForm } from '@/components/auth/auth-form'

describe('AuthForm', () => {
  it('renders login fields', () => {
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuthForm mode="login" />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByLabelText(/email or username/i)).toBeTruthy()
    expect(screen.getByLabelText(/password/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })
})
