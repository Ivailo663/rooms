<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { watchEffect } from 'vue'

const authStore = useAuthStore()
const router = useRouter()

watchEffect(() => {
  if (authStore.initialized && !authStore.user) {
    router.push({ name: 'auth' })
  }
})
</script>

<template>
  <RouterView v-if="authStore.user" />
</template>
