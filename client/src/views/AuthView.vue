<template>
  <div class="auth-container flex flex-col gap-5">
    <InputText v-model="email" placeholder="Email" />

    <Password v-model="password" placeholder="Password" :feedback="false" toggleMask fluid />

    <Button @click="handleSubmit">
      {{ isLogin ? 'Log In' : 'Sign Up' }}
    </Button>

    <Button link @click="isLogin = !isLogin">
      {{ isLogin ? 'Create account' : 'Already have an account?' }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, InputText, Password } from 'primevue'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
// import { useRouter } from 'vue-router'
import { api } from '@/axios'

const email = ref('')
const password = ref('')
const isLogin = ref(true)
const isLoading = ref(false)

// const router = useRouter()

const handleSubmit = async () => {
  const auth = getAuth()

  try {
    isLoading.value = true

    if (isLogin.value) {
      await signInWithEmailAndPassword(auth, email.value, password.value)
      // router.push({ name: 'home' })
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value)
      await api.post('/user')
      // router.push({ name: 'home' })
    }
  } catch (err) {
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  width: 500px;
  margin: 5rem auto;
}
</style>
