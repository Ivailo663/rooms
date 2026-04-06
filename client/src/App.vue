<template>
  <div v-if="!authStore.initialized">LOADING</div>

  <template v-else>
    <header class="mb-5!" v-if="authStore.initialized && authStore.user">
      <Menubar :model="items" :smobileActive="true">
        <template #item="{ item, props }">
          <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
            <a :href="href" v-bind="props.action" @click="navigate">
              <span :class="item.icon" />
              <span>{{ item.label }}</span>
            </a>
          </router-link>
        </template>

        <template #end>
          <div class="flex flex-wrap items-center gap-2">
            <p>Hi {{ authStore?.user?.email }}</p>

            <Button @click="handleLogout">Log out</Button>
          </div>
        </template>
      </Menubar>
    </header>

    <RouterView />
  </template>
</template>

<style scoped></style>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Menubar from 'primevue/menubar'
import { ref } from 'vue'
import { Button } from 'primevue'
import { useAuthStore } from './stores/auth'
import { signOut, getAuth } from 'firebase/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const auth = getAuth()
const router = useRouter()

const items = ref([
  {
    label: 'Home',
    icon: 'pi pi-home',
    route: '/',
  },
  {
    label: 'About',
    icon: 'pi pi-star',
    route: '/about',
  },
])

const handleLogout = async () => {
  await signOut(auth)
  router.push({ name: 'root' })
}
</script>
