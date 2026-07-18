import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { ChatPanel } from '@/components/chat/chat-panel'
import { ConnectionBanner } from '@/components/layout/connection-banner'
import { ChatPanelEmpty, ChatSidebar } from '@/components/layout/chat-sidebar'
import { ToastHost } from '@/components/ui/toast-host'
import { useChatSocket } from '@/hooks/use-chat-socket'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatUiStore } from '@/stores/chat-ui-store'
import type { User } from '@/types/auth'

interface TelegramShellProps {
  user: User
  onLogout: () => void
}

export function TelegramShell({ user, onLogout }: TelegramShellProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const activeConversationId = useChatUiStore((state) => state.activeConversationId)
  const setActiveConversationId = useChatUiStore(
    (state) => state.setActiveConversationId,
  )
  const hydrateFromConversations = useChatUiStore(
    (state) => state.hydrateFromConversations,
  )
  const socketApi = useChatSocket(Boolean(accessToken))

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    enabled: Boolean(accessToken),
    queryFn: () => api.listConversations(accessToken!),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (conversationsQuery.data) {
      hydrateFromConversations(conversationsQuery.data)
    }
  }, [conversationsQuery.data, hydrateFromConversations])

  const activeConversation =
    conversationsQuery.data?.find((item) => item.id === activeConversationId) ??
    null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-screen w-full flex-col overflow-hidden bg-[var(--app-bg)]"
    >
      <ConnectionBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'h-full w-full md:w-auto',
            activeConversation ? 'hidden md:flex' : 'flex',
          )}
        >
          <ChatSidebar
            user={user}
            onLogout={onLogout}
            conversations={conversationsQuery.data ?? []}
            isLoading={conversationsQuery.isLoading}
          />
        </div>

        <div
          className={cn(
            'h-full flex-1',
            activeConversation ? 'flex' : 'hidden md:flex',
          )}
        >
          {activeConversation ? (
            <ChatPanel
              conversation={activeConversation}
              conversations={conversationsQuery.data ?? []}
              socketApi={socketApi}
              onBack={() => setActiveConversationId(null)}
            />
          ) : (
            <ChatPanelEmpty />
          )}
        </div>
      </div>
      <ToastHost />
    </motion.div>
  )
}
