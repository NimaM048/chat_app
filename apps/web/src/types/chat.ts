import type { User } from '@/types/auth'

export type MessageStatus = 'SENT' | 'DELIVERED' | 'SEEN'
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE'

export interface ChatUser {
  id: string
  email?: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio?: string | null
  lastSeenAt?: string | null
  isOnline?: boolean
  createdAt: string
  updatedAt: string
}

export interface MessageReplyPreview {
  id: string
  content: string
  senderId: string
  senderName: string
}

export interface MessageForwardPreview {
  id: string
  content: string
  senderName: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  content: string
  status: MessageStatus
  isPinned: boolean
  replyToId: string | null
  forwardedFromId: string | null
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  durationMs: number | null
  editedAt: string | null
  deletedAt: string | null
  reactions: MessageReactionSummary[]
  replyTo: MessageReplyPreview | null
  forwardedFrom: MessageForwardPreview | null
  createdAt: string
  updatedAt: string
  sender: ChatUser
  optimistic?: boolean
}

export interface MessageReactionSummary {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP' | 'SAVED'
  title: string
  peer: ChatUser | null
  members: ChatUser[]
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unreadCount: number
  isArchived: boolean
  isPinned?: boolean
  pinOrder?: number | null
  mutedUntil?: string | null
  isMuted?: boolean
  markedUnread?: boolean
  draft?: string | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface MessagesPage {
  items: ChatMessage[]
  nextCursor: string | null
}

export interface UploadResult {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface GlobalSearchResult {
  users: ChatUser[]
  conversations: Conversation[]
  messages: Array<ChatMessage & { conversationTitle: string }>
}

export type { User }
