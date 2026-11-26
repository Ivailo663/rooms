import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "./App.vue";

// Signed in, as Firebase reports it before POST /user answers and the app
// moves off /auth.
const store = vi.hoisted(() => ({
  initialized: true,
  needsTerms: false,
  user: { email: "ana@example.test" },
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => store }));
vi.mock("@/stores/role", () => ({
  useRoleStore: () => ({ can: () => false }),
  Cap: { rooms: { create: "rooms.create" } },
}));
vi.mock("./features/rooms/composables/useJoinRequestSync", () => ({
  useJoinRequestSync: () => {},
}));

const Blank = { template: "<div />" };

const mountAt = async (path: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: Blank },
      { path: "/auth", name: "auth", component: Blank },
    ],
  });
  await router.push(path);

  return mount(App, {
    global: {
      plugins: [router],
      stubs: { AppSidebar: true, TermsGate: true, ConfirmDialog: true },
    },
  });
};

describe("App sidebar", () => {
  it("NAV-15: no sidebar on the sign-in screen, even once signed in", async () => {
    const wrapper = await mountAt("/auth");

    expect(wrapper.findComponent({ name: "AppSidebar" }).exists()).toBe(false);
  });

  it("NAV-15: the sidebar shows once the app has moved to Home", async () => {
    const wrapper = await mountAt("/");

    expect(wrapper.findComponent({ name: "AppSidebar" }).exists()).toBe(true);
  });
});
