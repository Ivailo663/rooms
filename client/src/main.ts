import "./assets/main.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Lara from "@primeuix/themes/lara";
//@ts-ignore
import App from "./App.vue";
import router from "./router";
import "./firebase";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: Lara,
    options: {
      darkModeSelector: ".dark-system",
    },
  },
});

app.use(router);
app.use(createPinia());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
    },
  },
});

app.use(VueQueryPlugin, { queryClient });

const { init } = useAuthStore();

await init();

app.mount("#app");
