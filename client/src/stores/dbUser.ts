import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useDbUserStore = defineStore('dbUserStore', () => {
  const userState = ref()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setDbUser = (user: any) => {
    userState.value = user
  }

  return { dbUser: userState, setDbUser }
})
