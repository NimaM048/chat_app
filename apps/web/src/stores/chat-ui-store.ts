import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, Conversation } from '@/types/chat'

interface ChatUiState {
  activeConversationId: string | null
  focusMessageId: string | null
  typingByConversation: Record<string, string | null>
  onlineUserIds: Record<string, boolean>
  lastSeenByUserId: Record<string, string | null>
  draftsByConversation: Record<string, string>
  mutedConversationIds: Record<string, boolean>
  connectionState: 'connected' | 'connecting' | 'disconnected'
  setActiveConversationId: (id: string | null) => void
  setFocusMessageId: (id: string | null) => void
  setTyping: (conversationId: string, username: string | null) => void
  setUserOnline: (
    userId: string,
    online: boolean,
    lastSeenAt?: string | null,
  ) => void
  setDraft: (conversationId: string, draft: string) => void
  clearDraft: (conversationId: string) => void
  setMuted: (conversationId: string, muted: boolean) => void
  toggleMute: (conversationId: string) => void
  hydrateFromConversations: (conversations: Conversation[]) => void
  setConnectionState: (
    state: 'connected' | 'connecting' | 'disconnected',
  ) => void
  patchConversationPreview: (
    conversationId: string,
    lastMessage: ChatMessage,
  ) => void
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set) => ({
      activeConversationId: null,
      focusMessageId: null,
      typingByConversation: {},
      onlineUserIds: {},
      lastSeenByUserId: {},
      draftsByConversation: {},
      mutedConversationIds: {},
      connectionState: 'disconnected',
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      setFocusMessageId: (id) => set({ focusMessageId: id }),
      setTyping: (conversationId, username) =>
        set((state) => ({
          typingByConversation: {
            ...state.typingByConversation,
            [conversationId]: username,
          },
        })),
      setUserOnline: (userId, online, lastSeenAt) =>
        set((state) => ({
          onlineUserIds: {
            ...state.onlineUserIds,
            [userId]: online,
          },
          lastSeenByUserId: {
            ...state.lastSeenByUserId,
            [userId]:
              lastSeenAt !== undefined
                ? lastSeenAt
                : online
                  ? null
                  : (state.lastSeenByUserId[userId] ?? null),
          },
        })),
      setDraft: (conversationId, draft) =>
        set((state) => ({
          draftsByConversation: {
            ...state.draftsByConversation,
            [conversationId]: draft,
          },
        })),
      clearDraft: (conversationId) =>
        set((state) => {
          const next = { ...state.draftsByConversation }
          delete next[conversationId]
          return { draftsByConversation: next }
        }),
      setMuted: (conversationId, muted) =>
        set((state) => ({
          mutedConversationIds: {
            ...state.mutedConversationIds,
            [conversationId]: muted,
          },
        })),
      toggleMute: (conversationId) =>
        set((state) => ({
          mutedConversationIds: {
            ...state.mutedConversationIds,
            [conversationId]: !state.mutedConversationIds[conversationId],
          },
        })),
      hydrateFromConversations: (conversations) =>
        set((state) => {
          const drafts = { ...state.draftsByConversation }
          const muted = { ...state.mutedConversationIds }
          for (const conversation of conversations) {
            if (conversation.draft) {
              drafts[conversation.id] = conversation.draft
            }
            muted[conversation.id] = Boolean(conversation.isMuted)
          }
          return {
            draftsByConversation: drafts,
            mutedConversationIds: muted,
          }
        }),
      setConnectionState: (connectionState) => set({ connectionState }),
      patchConversationPreview: () => undefined,
    }),
    {
      name: 'chat-ui-store',
      partialize: (state) => ({
        draftsByConversation: state.draftsByConversation,
        mutedConversationIds: state.mutedConversationIds,
      }),
    },
  ),
)

export type { Conversation }
