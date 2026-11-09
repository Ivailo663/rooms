import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useRoleStore } from "../stores/role";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: () => import("@/views/ProtectedLayout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/views/HomeView.vue"),
        },
        {
          path: "settings",
          name: "settings",
          component: () => import("@/views/SettingsView.vue"),
          meta: { requiresVenue: true },
        },
      ],
    },
    {
      path: "/auth",
      name: "auth",
      component: () => import("@/views/AuthView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.user) {
    return "/";
  }

  // Settings is only for someone who manages a venue (SET-10). On a hard
  // refresh the account isn't loaded yet, so wait for it before deciding.
  if (to.meta.requiresVenue) {
    await authStore.ready;
    if (!useRoleStore().managesVenue) return { name: "home" };
  }
});

export default router;
