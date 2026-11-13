import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import PrimeVue from "primevue/config";
import AppSidebar from "./AppSidebar.vue";
import { useMenuExpanded } from "@/composables/useMenuExpanded";

const store = vi.hoisted(() => ({
  user: { email: "ana@example.test" },
  account: { name: "Ana Petrova", picture_url: null as string | null },
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => store }));
vi.mock("@/stores/role", () => ({
  useRoleStore: () => ({ managesVenue: false, can: () => false }),
  Cap: { rooms: { create: "rooms.create" } },
}));
vi.mock("firebase/auth", () => ({ getAuth: () => ({}), signOut: vi.fn() }));

const Blank = { template: "<div />" };

const mountSidebar = async (expanded: boolean) => {
  useMenuExpanded().value = expanded;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: Blank },
      { path: "/settings", name: "settings", component: Blank },
      { path: "/profile", name: "profile", component: Blank },
    ],
  });
  await router.push("/");
  const wrapper = mount(AppSidebar, {
    global: {
      plugins: [router, PrimeVue],
      stubs: { RoleGate: true },
      mocks: { $cap: { rooms: { create: "rooms.create" } } },
    },
  });
  return { wrapper, router };
};

const profileLink = (w: Awaited<ReturnType<typeof mountSidebar>>["wrapper"]) =>
  w.find('a[aria-label="Your profile"]');

afterEach(() => {
  store.account.picture_url = null;
});

describe("AppSidebar user section", () => {
  it.each([true, false])(
    "PROF-26: the player's own avatar opens /profile (expanded: %s)",
    async (expanded) => {
      const { wrapper, router } = await mountSidebar(expanded);

      const link = profileLink(wrapper);
      expect(link.attributes("href")).toBe("/profile");
      expect(link.text()).toContain("AP");
      expect(link.find(".fa-user").exists()).toBe(false);

      await link.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("profile");
      wrapper.unmount();
    }
  );

  it("PROF-26: a player with a picture shows it instead of initials", async () => {
    store.account.picture_url = "https://example.test/ana.jpg";
    const { wrapper } = await mountSidebar(true);

    expect(profileLink(wrapper).find("img").attributes("src")).toBe(
      "https://example.test/ana.jpg"
    );
    wrapper.unmount();
  });
});
