import axios from 'axios'
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
