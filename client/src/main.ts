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
import { definePreset } from "@primeuix/themes";

const app = createApp(App);

const MyPreset = definePreset(Lara, {
  components: {
    card: {
      root: {
        shadow: "0px 1px 4px 0px {gray-200}",
      },
    },
  },
});

app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
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
