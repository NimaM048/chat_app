import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useChatUiStore } from '@/stores/chat-ui-store'
import { useToastStore } from '@/stores/toast-store'
import {
  patchMessageInInfinite,
  setMessagesInfinite,
  upsertMessageInInfinite,
} from '@/lib/messages-cache'
import type { ChatMessage, Conversation } from '@/types/chat'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

export function useChatSocket(enabled: boolean) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const setTyping = useChatUiStore((state) => state.setTyping)
  const setUserOnline = useChatUiStore((state) => state.setUserOnline)
  const activeConversationId = useChatUiStore(
    (state) => state.activeConversationId,
  )
  const activeConversationIdRef = useRef(activeConversationId)
  activeConversationIdRef.current = activeConversationId

  useEffect(() => {
    if (!enabled || !accessToken) {
      setConnected(false)
      return
    }

    const socket = io(`${SOCKET_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    })

    socketRef.current = socket
    useChatUiStore.getState().setConnectionState('connecting')

    const onConnect = () => {
      setConnected(true)
      useChatUiStore.getState().setConnectionState('connected')
      const activeId = activeConversationIdRef.current
      if (activeId) {
        socket.emit('conversation:join', { conversationId: activeId })
      }
    }

    const onDisconnect = () => {
      setConnected(false)
      useChatUiStore.getState().setConnectionState('disconnected')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    socket.on('message:new', (message: ChatMessage) => {
      setMessagesInfinite(queryClient, message.conversationId, (current) =>
        upsertMessageInInfinite(current, message),
      )

      const myId = useAuthStore.getState().user?.id
      const isActive =
        activeConversationIdRef.current === message.conversationId
      const muted = Boolean(
        useChatUiStore.getState().mutedConversationIds[message.conversationId],
      )

      queryClient.setQueryData<Conversation[]>(['conversations'], (current) => {
        if (!current) return current
        return current
          .map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                  unreadCount:
                    isActive
                      ? 0
                      : conversation.unreadCount +
                        (message.senderId === myId ? 0 : 1),
                }
              : conversation,
          )
          .sort((a, b) => {
            const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
            const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
            return bTime - aTime
          })
      })

      if (myId && message.senderId !== myId && !isActive && !muted) {
        const conversations =
          queryClient.getQueryData<Conversation[]>(['conversations']) ?? []
        const chat = conversations.find(
          (item) => item.id === message.conversationId,
        )
        const title = chat?.title || message.sender.displayName || 'New message'
        const envelope = message as ChatMessage & {
          suppressNotification?: boolean
          notificationPreview?: string | null
          soundEnabled?: boolean
        }
        const body =
          envelope.notificationPreview === null
            ? 'New message'
            : message.type === 'VOICE'
              ? 'Voice message'
              : message.type === 'IMAGE'
                ? 'Photo'
                : message.type === 'FILE'
                  ? message.fileName || 'File'
                  : message.content || 'New message'

        if (!envelope.suppressNotification) {
          useToastStore.getState().pushToast({
            title,
            body,
            conversationId: message.conversationId,
          })
          void import('@/lib/notifications').then(({ notifyDesktop }) =>
            notifyDesktop({
              title,
              body,
              playSound: envelope.soundEnabled !== false,
            }),
          )
        }
      }
    })

    socket.on('message:updated', (message: ChatMessage) => {
      setMessagesInfinite(queryClient, message.conversationId, (current) =>
        upsertMessageInInfinite(current, message),
      )
      void queryClient.invalidateQueries({
        queryKey: ['pinned', message.conversationId],
      })
    })

    socket.on('message:status', (message: ChatMessage) => {
      setMessagesInfinite(queryClient, message.conversationId, (current) =>
        patchMessageInInfinite(current, message.id, {
          status: message.status,
        }),
      )
    })

    socket.on(
      'conversation:seen',
      (payload: { conversationId: string; seenBy: string }) => {
        setMessagesInfinite(queryClient, payload.conversationId, (current) => {
          if (!current) return current
          const myId = useAuthStore.getState().user?.id
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.senderId === myId && payload.seenBy !== myId
                  ? { ...item, status: 'SEEN' as const }
                  : item,
              ),
            })),
          }
        })
      },
    )

    socket.on(
      'typing:update',
      (payload: {
        conversationId: string
        userId: string
        username: string
        isTyping: boolean
      }) => {
        const myId = useAuthStore.getState().user?.id
        if (payload.userId === myId) return
        setTyping(
          payload.conversationId,
          payload.isTyping ? payload.username : null,
        )
      },
    )

    socket.on(
      'presence:update',
      (payload: {
        userId: string
        online: boolean
        lastSeenAt?: string | null
      }) => {
        setUserOnline(payload.userId, payload.online, payload.lastSeenAt ?? null)
      },
    )

    socket.on('conversation:updated', (payload?: Conversation | { conversationId: string }) => {
      if (payload && 'id' in payload && payload.id) {
        queryClient.setQueryData<Conversation[]>(['conversations'], (current) => {
          if (!current) return current
          return current.map((item) =>
            item.id === payload.id ? { ...item, ...payload } : item,
          )
        })
        if ('isMuted' in payload) {
          useChatUiStore
            .getState()
            .setMuted(payload.id, Boolean(payload.isMuted))
        }
        if ('draft' in payload) {
          if (payload.draft) {
            useChatUiStore.getState().setDraft(payload.id, payload.draft)
          } else {
            useChatUiStore.getState().clearDraft(payload.id)
          }
        }
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    socket.on(
      'draft:updated',
      (payload: {
        conversationId: string
        content: string | null
        updatedAt: string | null
      }) => {
        if (payload.content) {
          useChatUiStore
            .getState()
            .setDraft(payload.conversationId, payload.content)
        } else {
          useChatUiStore.getState().clearDraft(payload.conversationId)
        }
        queryClient.setQueryData<Conversation[]>(['conversations'], (current) => {
          if (!current) return current
          return current.map((item) =>
            item.id === payload.conversationId
              ? { ...item, draft: payload.content }
              : item,
          )
        })
      },
    )

    socket.on(
      'session:revoked',
      (payload: {
        sessionId: string | null
        others?: boolean
        currentSessionId?: string | null
      }) => {
        const mySessionId = useAuthStore.getState().sessionId
        if (payload.others) {
          if (
            payload.currentSessionId &&
            mySessionId &&
            payload.currentSessionId !== mySessionId
          ) {
            useAuthStore.getState().clearSession()
            useToastStore.getState().pushToast({
              title: 'Signed out',
              body: 'This session was ended from another device.',
            })
          }
          return
        }
        if (payload.sessionId && payload.sessionId === mySessionId) {
          useAuthStore.getState().clearSession()
          useToastStore.getState().pushToast({
            title: 'Signed out',
            body: 'This session was revoked.',
          })
        }
      },
    )

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
      useChatUiStore.getState().setConnectionState('disconnected')
    }
  }, [accessToken, enabled, queryClient, setTyping, setUserOnline])

  return useMemo(
    () => ({
      connected,
      joinConversation(conversationId: string) {
        socketRef.current?.emit('conversation:join', { conversationId })
      },
      startTyping(conversationId: string) {
        socketRef.current?.emit('typing:start', { conversationId })
      },
      stopTyping(conversationId: string) {
        socketRef.current?.emit('typing:stop', { conversationId })
      },
      markDelivered(messageId: string) {
        socketRef.current?.emit('message:delivered', { messageId })
      },
      markSeen(conversationId: string) {
        socketRef.current?.emit('conversation:seen', { conversationId })
      },
    }),
    [connected],
  )
}
