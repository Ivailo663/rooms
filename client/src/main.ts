import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import App from './App.vue'
import router from './router'
import './firebase'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.use(router)
app.use(createPinia())

const { init } = useAuthStore()

await init()

app.mount('#app')
