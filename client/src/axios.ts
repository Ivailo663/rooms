import axios, { isAxiosError } from 'axios'
import { getAuth } from 'firebase/auth'

// APP-02: the server's address comes from the build (VITE_API_URL, set in the
// deploy workflows), never from the code. Without it, the local dev server.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use(async (config) => {
  const auth = getAuth()
  const user = auth.currentUser

  if (user) {
    const token = await user.getIdToken()
    config.headers.authorization = `Bearer ${token}`
  }

  return config
})

// The server answers errors with a plain-text message (API-02).
export const errorMessage = (error: unknown, fallback: string) => {
  const data = isAxiosError(error) ? error.response?.data : undefined
  return typeof data === 'string' && data.trim() ? data : fallback
}
