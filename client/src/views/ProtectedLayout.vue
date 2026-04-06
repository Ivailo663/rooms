<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AuthView from './AuthView.vue'

const authStore = useAuthStore()
console.log(authStore.user, 'auth store')
</script>

<template>
  <AuthView v-if="!authStore.user" />

  <RouterView v-else />
</template>
