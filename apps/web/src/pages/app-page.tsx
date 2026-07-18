import { useMutation, useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'

import { Navigate } from 'react-router-dom'

import { TelegramShell } from '@/components/layout/telegram-shell'

import { api } from '@/lib/api'

import { useAuthStore } from '@/stores/auth-store'



export function AppPage() {

  const user = useAuthStore((state) => state.user)

  const accessToken = useAuthStore((state) => state.accessToken)

  const refreshToken = useAuthStore((state) => state.refreshToken)

  const setUser = useAuthStore((state) => state.setUser)

  const clearSession = useAuthStore((state) => state.clearSession)



  const meQuery = useQuery({

    queryKey: ['me'],

    enabled: Boolean(accessToken),

    queryFn: () => api.me(accessToken!),

    staleTime: 60_000,

  })



  useEffect(() => {

    if (meQuery.data) setUser(meQuery.data)

  }, [meQuery.data, setUser])



  const logoutMutation = useMutation({

    mutationFn: async () => {

      if (refreshToken) {

        await api.logout(refreshToken)

      }

    },

    onSettled: () => {

      clearSession()

    },

  })



  if (!user) {

    return <Navigate to="/login" replace />

  }



  return (

    <TelegramShell

      user={user}

      onLogout={() => {

        logoutMutation.mutate()

      }}

    />

  )

}


