export type UserRole = 'collector' | 'admin'

export interface SessionUser {
  id: string
  name: string
  email: string
  username: string
  role: UserRole
}

export interface Session {
  token: string
  user: SessionUser
  expiresAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  name: string
  username: string
  email: string
  password: string
}

/** The account's own data (the login identity). The profile (name, bio, ENS, photo) lives in `domains/profile`. */
export interface UpdateAccountRequest {
  username: string
  email: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
