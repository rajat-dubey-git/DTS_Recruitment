import axios from 'axios'
import type { Role } from '../data/navigation'
import { http } from './http'

export type AuthUser = {
  userId: number
  fullName: string
  email: string
  role: Role
}

type UserResponse = { user: AuthUser }

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

export function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401
}

export const authApi = {
  async login(email: string, password: string) {
    try {
      const response = await http.post<UserResponse>('/auth/login', { email, password })
      return response.data.user
    } catch (error) {
      throw new Error(errorMessage(error, 'Unable to sign in. Please try again.'))
    }
  },

  async me() {
    try {
      const response = await http.get<UserResponse>('/auth/me')
      return response.data.user
    } catch (error) {
      if (isUnauthorized(error)) throw error
      throw new Error(errorMessage(error, 'Unable to verify your session.'))
    }
  },

  async acceptInvitation(token: string, password: string) {
    try {
      await http.post('/auth/invitations/accept', { token, password })
    } catch (error) {
      throw new Error(errorMessage(error, 'Unable to set your password. Request a new invitation.'))
    }
  },

  async logout() {
    try {
      await http.post('/auth/logout')
    } catch (error) {
      throw new Error(errorMessage(error, 'Unable to sign out.'))
    }
  },
}