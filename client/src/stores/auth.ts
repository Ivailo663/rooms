import { defineStore } from 'pinia'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { api } from '@/axios'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const userAuthState = ref<User | null>(null)
  const userDBState = ref({})
  const initializedState = ref(false)

  const router = useRouter()

  const fetchUser = async () => {
    const { data } = await api.get('/user', {
      params: {
        email: userAuthState.value?.email,
      },
    })

    userDBState.value = data
  }

  const init = async () => {
    return new Promise<void>((resolve) => {
      const auth = getAuth()

      onAuthStateChanged(auth, async (userPayload) => {
        console.log(userPayload, 'user payload')

        userAuthState.value = userPayload
        initializedState.value = true

        if (userPayload) {
          await userPayload.getIdToken()

          await fetchUser()

          router.push({ name: 'home' })
        } else {
          userDBState.value = {}
          router.push({ name: 'root' })
        }

        resolve()
      })
    })
  }

  const user = computed(() => {
    const result = {
      ...userAuthState.value,
      ...userDBState.value,
    }

    return !Object.keys(result).length ? null : result
  })

  return { user, init, fetchUser, initialized: initializedState }
})
