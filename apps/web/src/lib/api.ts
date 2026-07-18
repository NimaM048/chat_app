import type {
  ApiResponse,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types/auth'
import type { ChatMessage, Conversation, GlobalSearchResult, MessagesPage, UploadResult } from '@/types/chat'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = RequestInit & { skipAuthRefresh?: boolean }

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const { refreshToken, setSession, clearSession } = await import(
      '@/stores/auth-store'
    ).then((m) => m.useAuthStore.getState())

    if (!refreshToken) {
      clearSession()
      return null
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const payload = (await response.json().catch(() => null)) as
        | ApiResponse<AuthResponse>
        | null

      if (!response.ok || !payload || !('data' in payload) || !payload.data) {
        clearSession()
        return null
      }

      const data = payload.data
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      })
      return data.accessToken
    } catch {
      clearSession()
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  accessToken?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (
    response.status === 401 &&
    accessToken &&
    !options.skipAuthRefresh &&
    path !== '/auth/refresh' &&
    path !== '/auth/login' &&
    path !== '/auth/register'
  ) {
    const nextToken = await refreshAccessToken()
    if (nextToken) {
      return request<T>(
        path,
        { ...options, skipAuthRefresh: true },
        nextToken,
      )
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | { message?: string }
    | null

  if (!response.ok) {
    const raw =
      payload && 'message' in payload ? payload.message : undefined
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'string' && raw.trim()
        ? raw
        : 'Request failed'
    throw new ApiError(message, response.status)
  }

  if (!payload || !('data' in payload)) {
    throw new ApiError('Invalid API response', response.status)
  }

  return payload.data
}

export const api = {
  register(payload: RegisterPayload) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  login(payload: LoginPayload) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  refresh(refreshToken: string) {
    return request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  },

  logout(refreshToken: string) {
    return request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  },

  me(accessToken: string) {
    return request<User>('/auth/me', { method: 'GET' }, accessToken)
  },

  updateProfile(
    accessToken: string,
    payload: {
      displayName?: string
      username?: string
      avatarUrl?: string | null
      bio?: string | null
    },
  ) {
    return request<User>(
      '/users/me',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      accessToken,
    )
  },

  getPreferences(accessToken: string) {
    return request<import('@/stores/preferences-store').UserPreferences & { updatedAt?: string }>(
      '/users/me/preferences',
      { method: 'GET' },
      accessToken,
    )
  },

  updatePreferences(
    accessToken: string,
    payload: Partial<import('@/stores/preferences-store').UserPreferences>,
  ) {
    return request<import('@/stores/preferences-store').UserPreferences & { updatedAt?: string }>(
      '/users/me/preferences',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      accessToken,
    )
  },

  getPrivacy(accessToken: string) {
    return request<Record<string, string>>(
      '/users/me/privacy',
      { method: 'GET' },
      accessToken,
    )
  },

  updatePrivacy(
    accessToken: string,
    field: string,
    visibility: string,
  ) {
    return request<Record<string, string>>(
      '/users/me/privacy',
      {
        method: 'PATCH',
        body: JSON.stringify({ field, visibility }),
      },
      accessToken,
    )
  },

  listBlocks(accessToken: string) {
    return request<
      Array<{
        id: string
        blockedAt: string
        user: {
          id: string
          username: string
          displayName: string
          avatarUrl: string | null
          bio?: string | null
          createdAt: string
          updatedAt: string
        }
      }>
    >('/users/me/blocks', { method: 'GET' }, accessToken)
  },

  blockUser(accessToken: string, userId: string) {
    return request<{ blocked: boolean; userId: string }>(
      `/users/me/blocks/${userId}`,
      { method: 'POST' },
      accessToken,
    )
  },

  unblockUser(accessToken: string, userId: string) {
    return request<{ blocked: boolean; userId: string }>(
      `/users/me/blocks/${userId}`,
      { method: 'DELETE' },
      accessToken,
    )
  },

  getUserProfile(accessToken: string, userId: string) {
    return request<{
      id: string
      username: string
      displayName: string
      avatarUrl: string | null
      bio?: string | null
      lastSeenAt?: string | null
      isOnline?: boolean
      isBlocked: boolean
      hasBlockedYou: boolean
      createdAt: string
      updatedAt: string
    }>(`/users/${userId}`, { method: 'GET' }, accessToken)
  },

  deleteAccount(accessToken: string, password: string) {
    return request<{ deleted: true }>(
      '/users/me',
      {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      },
      accessToken,
    )
  },

  listConversations(accessToken: string) {
    return request<Conversation[]>('/conversations', { method: 'GET' }, accessToken)
  },

  createDirect(accessToken: string, peer: string) {
    return request<Conversation>(
      '/conversations/direct',
      {
        method: 'POST',
        body: JSON.stringify({ peer }),
      },
      accessToken,
    )
  },

  createGroup(accessToken: string, title: string, memberIds: string[]) {
    return request<Conversation>(
      '/conversations/group',
      {
        method: 'POST',
        body: JSON.stringify({ title, memberIds }),
      },
      accessToken,
    )
  },

  toggleArchive(accessToken: string, conversationId: string) {
    return request<Conversation>(
      `/conversations/${conversationId}/archive`,
      { method: 'PATCH' },
      accessToken,
    )
  },

  updateConversation(
    accessToken: string,
    conversationId: string,
    payload: {
      mutedUntil?: string | null
      isArchived?: boolean
      isPinned?: boolean
      markedUnread?: boolean
    },
  ) {
    return request<Conversation>(
      `/conversations/${conversationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      accessToken,
    )
  },

  upsertDraft(
    accessToken: string,
    conversationId: string,
    content: string,
    replyToId?: string | null,
  ) {
    return request<{
      conversationId: string
      content: string | null
      updatedAt: string | null
    }>(
      `/drafts/${conversationId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content, replyToId }),
      },
      accessToken,
    )
  },

  deleteDraft(accessToken: string, conversationId: string) {
    return request<{
      conversationId: string
      content: string | null
      updatedAt: string | null
    }>(`/drafts/${conversationId}`, { method: 'DELETE' }, accessToken)
  },

  listSessions(accessToken: string) {
    return request<
      Array<{
        id: string
        deviceId: string | null
        deviceName: string | null
        platform: string | null
        ip: string | null
        userAgent: string | null
        lastActiveAt: string
        createdAt: string
        isCurrent: boolean
      }>
    >('/auth/sessions', { method: 'GET' }, accessToken)
  },

  revokeSession(accessToken: string, sessionId: string) {
    return request<{ revokedSessionId: string }>(
      `/auth/sessions/${sessionId}`,
      { method: 'DELETE' },
      accessToken,
    )
  },

  revokeOtherSessions(accessToken: string) {
    return request<{ revokedCount: number }>(
      '/auth/sessions/revoke-others',
      { method: 'POST' },
      accessToken,
    )
  },

  getSavedConversation(accessToken: string) {
    return request<Conversation>(
      '/conversations/saved',
      { method: 'POST' },
      accessToken,
    )
  },

  getMessages(accessToken: string, conversationId: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return request<MessagesPage>(
      `/conversations/${conversationId}/messages${query}`,
      { method: 'GET' },
      accessToken,
    )
  },

  getPinned(accessToken: string, conversationId: string) {
    return request<ChatMessage[]>(
      `/conversations/${conversationId}/pinned`,
      { method: 'GET' },
      accessToken,
    )
  },

  sendMessage(
    accessToken: string,
    conversationId: string,
    payload: {
      content?: string
      replyToId?: string
      type?: ChatMessage['type']
      fileUrl?: string
      fileName?: string
      fileSize?: number
      mimeType?: string
      durationMs?: number
    },
  ) {
    return request<ChatMessage>(
      `/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      accessToken,
    )
  },

  async upload(accessToken: string, file: File | Blob, fileName?: string) {
    const form = new FormData()
    form.append('file', file, fileName ?? 'upload.bin')

    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    })

    const payload = (await response.json().catch(() => null)) as
      | { success: boolean; data: UploadResult; message?: string }
      | null

    if (!response.ok || !payload?.data) {
      throw new ApiError(payload?.message ?? 'Upload failed', response.status)
    }

    return payload.data
  },

  togglePin(accessToken: string, messageId: string) {
    return request<ChatMessage>(
      `/messages/${messageId}/pin`,
      { method: 'PATCH' },
      accessToken,
    )
  },

  editMessage(accessToken: string, messageId: string, content: string) {
    return request<ChatMessage>(
      `/messages/${messageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      },
      accessToken,
    )
  },

  deleteMessage(accessToken: string, messageId: string) {
    return request<ChatMessage>(
      `/messages/${messageId}`,
      { method: 'DELETE' },
      accessToken,
    )
  },

  reactMessage(accessToken: string, messageId: string, emoji: string) {
    return request<ChatMessage>(
      `/messages/${messageId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      },
      accessToken,
    )
  },

  forwardMessage(
    accessToken: string,
    messageId: string,
    targetConversationId: string,
  ) {
    return request<ChatMessage>(
      '/messages/forward',
      {
        method: 'POST',
        body: JSON.stringify({ messageId, targetConversationId }),
      },
      accessToken,
    )
  },

  batchForward(
    accessToken: string,
    messageIds: string[],
    targetConversationId: string,
  ) {
    return request<ChatMessage[]>(
      '/messages/batch-forward',
      {
        method: 'POST',
        body: JSON.stringify({ messageIds, targetConversationId }),
      },
      accessToken,
    )
  },

  batchDelete(accessToken: string, messageIds: string[]) {
    return request<ChatMessage[]>(
      '/messages/batch-delete',
      {
        method: 'POST',
        body: JSON.stringify({ messageIds }),
      },
      accessToken,
    )
  },

  searchUsers(accessToken: string, q: string) {
    return request<User[]>(
      `/users/search?q=${encodeURIComponent(q)}`,
      { method: 'GET' },
      accessToken,
    )
  },

  globalSearch(accessToken: string, q: string) {
    return request<GlobalSearchResult>(
      `/search?q=${encodeURIComponent(q)}`,
      { method: 'GET' },
      accessToken,
    )
  },
}

export { ApiError }
