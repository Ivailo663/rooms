import "./assets/main.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { createApp } from "vue";
import BasicWrapper from "./components/BasicWrapper.vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Lara from "@primeuix/themes/lara";
import App from "./App.vue";
import router from "./router";
import "./firebase";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { useAuthStore } from "./stores/auth";
import { definePreset } from "@primeuix/themes";
import RoleGate from "./components/RoleGate.vue";
import { Cap } from "./stores/role";

const app = createApp(App);

const MyPreset = definePreset(Lara, {
  semantic: {
    primary: {
      50: "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      300: "#a5b4fc",
      400: "#818cf8",
      500: "#6366f1",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
      950: "#1e1b4b",
    },
  },
  components: {
    card: {
      root: {
        shadow:
          "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        borderRadius: "0.875rem",
      },
      body: {
        padding: "0.85rem",
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
    },
  },
});
app.use(VueQueryPlugin, { queryClient });

app.use(createPinia());
app.use(router);
app.component("BasicWrapper", BasicWrapper);
app.component("RoleGate", RoleGate);
app.config.globalProperties.$cap = Cap;

const { init } = useAuthStore();

await init();

app.mount("#app");
