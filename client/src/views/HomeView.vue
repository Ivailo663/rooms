<template>
  <main>
    <!-- <h1 v-if="Boolean(state.connected)">{{ state.connected }}</h1> -->

    <!-- <h2>{{ socketmsg }}</h2> -->

    <Tabs value="0">
      <TabList>
        <Tab value="0">Hosted</Tab>
        <Tab value="1">Others</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="0">
          <Button label="Create Playground" @click="visible = true" class="m-2!" />
        </TabPanel>
        <TabPanel value="1"> </TabPanel>
      </TabPanels>
    </Tabs>

    <div class="flex">
      <Card
        v-for="p in playgrounds"
        :key="p.id"
        style="width: 25rem; overflow: hidden"
        class="m-5! border"
      >
        <template #header>
          <img alt="user header" src="https://primefaces.org/cdn/primevue/images/usercard.png" />
        </template>
        <template #title>{{ p.name }}</template>
        <template #content>
          <p class="mb-2!">
            {{ p.description }}
          </p>

          <h2>players:</h2>
          <div v-for="player in p.players">
            {{ player.name }}
          </div>
        </template>
        <template #footer>
          <div class="flex gap-4 mt-1">
            <Button
              v-if="!p.players?.find((p) => p.id === authStore?.user.id)"
              @click="handleJoinPlayground(p)"
              class="w-full"
              >Join</Button
            >
            <Button v-else @click="handlePlaygroundLeave(p)" class="w-full">Leave</Button>
          </div>
        </template>
      </Card>
    </div>
  </main>

  <Dialog v-model:visible="visible" modal header="Edit Profile" :style="{ width: '25rem' }">
    <span class="text-surface-500 dark:text-surface-400 block mb-8!">Update your information.</span>
    <div class="flex items-center gap-4 mb-4!">
      <label for="name" class="font-semibold w-24">name</label>
      <InputText id="name" class="flex-auto" autocomplete="off" v-model="name" />
    </div>
    <div class="flex items-center gap-4 mb-4!">
      <label for="name" class="font-semibold w-24">description</label>
      <Textarea id="name" class="flex-auto" autocomplete="off" v-model="description" />
    </div>
    <div class="flex justify-end gap-2">
      <Button type="button" label="Cancel" severity="secondary" @click="visible = false"></Button>
      <Button type="button" label="Save" @click="handleCreatePlayground" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import {
  Card,
  Button,
  InputText,
  Textarea,
  Dialog,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from 'primevue'
import { socket } from '../socket'
import { api } from '@/axios'
import { useAuthStore } from '../stores/auth'
import { Player } from '@football/shared'

const authStore = useAuthStore()

const visible = ref(false)
const name = ref()
const description = ref()
const playgrounds = ref([])

onMounted(async () => {
  await getPlaygrounds()

  socket.on('playgrounds:updated', (data) => {
    playgrounds.value = data
  })
})

const handleCreatePlayground = async () => {
  await api.post('/playgrounds', {
    name: name?.value,
    description: description?.value,
    creator_id: authStore?.user?.id,
    host_id: authStore?.user?.id,
  })
}

const getPlaygrounds = async () => {
  const { data } = await api.get('/playgrounds')

  playgrounds.value = data
}

const handleJoinPlayground = async (playground: any) => {
  await api.post('join', {
    playground_id: playground.id,
    account_id: authStore?.user?.id,
    joined_at: new Date(),
  })
}

const handlePlaygroundLeave = async (playground) => {
  await api.post('leave', {
    playground_id: playground.id,
    account_id: authStore?.user?.id,
  })

  const a = 5
  const test = 'a'

  const myArray = [1, 2, 3]

  myArray.filter((e) => {
    console.log(e > 2)
  })
}
</script>

<style></style>
