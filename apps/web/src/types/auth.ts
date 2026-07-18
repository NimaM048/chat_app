export interface User {
  id: string
  email: string
  username: string
  displayName: string
  bio?: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  sessionId: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface DevicePayload {
  deviceId?: string
  deviceName?: string
  platform?: 'web' | 'desktop' | 'android' | 'ios'
}

export interface LoginPayload extends DevicePayload {
  identifier: string
  password: string
}

export interface RegisterPayload extends DevicePayload {
  email: string
  username: string
  displayName: string
  password: string
}

export interface SessionInfo {
  id: string
  deviceId: string | null
  deviceName: string | null
  platform: string | null
  ip: string | null
  userAgent: string | null
  lastActiveAt: string
  createdAt: string
  isCurrent: boolean
}
