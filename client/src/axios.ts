import axios, { isAxiosError } from 'axios'
import { getAuth } from 'firebase/auth'

export const api = axios.create({
  baseURL: 'http://localhost:3000',
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
