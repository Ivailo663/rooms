import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import PrimeVue from "primevue/config";
import AppSidebar from "./AppSidebar.vue";
import { useMenuExpanded } from "@/composables/useMenuExpanded";

const store = vi.hoisted(() => ({
  user: { email: "ana@example.test" },
  account: {
    id: 7,
    name: "Ana Petrova",
    picture_url: null as string | null,
  },
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
      { path: "/profiles/:id", name: "player-profile", component: Blank },
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
  vi.unstubAllGlobals();
  window.history.replaceState(null, "");
});

describe("AppSidebar user section", () => {
  it.each([true, false])(
    "PROF-26: the player's own avatar opens their /profiles/:id (expanded: %s)",
    async (expanded) => {
      const { wrapper, router } = await mountSidebar(expanded);

      const link = profileLink(wrapper);
      expect(link.attributes("href")).toBe("/profiles/7");
      expect(link.text()).toContain("AP");
      expect(link.find(".fa-user").exists()).toBe(false);

      await link.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe("/profiles/7");
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

// useSwipe reads only the first touch's coordinates, so a plain Event carrying
// them is enough; jsdom has no Touch constructor.
const swipe = (fromX: number, toX: number, y = 300) => {
  const start = Object.assign(new Event("touchstart"), {
    touches: [{ clientX: fromX, clientY: y }],
  });
  const end = Object.assign(new Event("touchend"), {
    changedTouches: [{ clientX: toX, clientY: y }],
  });
  window.dispatchEvent(start);
  window.dispatchEvent(end);
};

const PHONE = 390;

const onPhone = (standalone = false) => {
  vi.stubGlobal("innerWidth", PHONE);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: standalone && query === "(display-mode: standalone)",
  }));
};

describe("AppSidebar phone gestures", () => {
  it("NAV-10: the drawer and its handle sit on the right on a phone", async () => {
    onPhone();
    const { wrapper } = await mountSidebar(false);

    const handle = wrapper.find('button[aria-label="Open menu"]');
    expect(handle.classes()).toContain("right-0");
    expect(handle.classes()).not.toContain("left-0");
    expect(handle.find("span").classes()).toContain("rounded-l-full");

    const container = wrapper.find("#app-sidebar").element.parentElement!;
    expect(container.className).toContain("right-0");
    expect(container.className).toContain("translate-x-full");
    expect(container.className).not.toContain("-translate-x-full");
    wrapper.unmount();
  });

  it("NAV-10: a leftward swipe from the right edge opens the drawer", async () => {
    onPhone();
    const { wrapper } = await mountSidebar(false);

    swipe(PHONE - 4, PHONE - 200);
    await flushPromises();

    expect(useMenuExpanded().value).toBe(true);
    expect(wrapper.find('button[aria-label="Close menu"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("NAV-10: a swipe from the left edge or the middle doesn't open it", async () => {
    onPhone();
    const { wrapper } = await mountSidebar(false);

    swipe(4, 200);
    swipe(PHONE / 2, 20);
    await flushPromises();

    expect(useMenuExpanded().value).toBe(false);
    wrapper.unmount();
  });

  it("NAV-10: a rightward swipe across the open drawer closes it", async () => {
    onPhone();
    const { wrapper } = await mountSidebar(true);

    swipe(60, 300);
    await flushPromises();

    expect(useMenuExpanded().value).toBe(false);
    wrapper.unmount();
  });

  it("NAV-10: the desktop sidebar stays on the left and ignores swipes", async () => {
    const { wrapper } = await mountSidebar(false);

    const container = wrapper.find("#app-sidebar").element.parentElement!;
    expect(container.className).not.toContain("right-0");
    expect(wrapper.find('button[aria-label="Open menu"]').exists()).toBe(false);
    swipe(window.innerWidth - 4, 200);
    await flushPromises();
    expect(useMenuExpanded().value).toBe(false);
    wrapper.unmount();
  });

  it("NAV-11: installed, a rightward swipe from the left edge goes back", async () => {
    onPhone(true);
    window.history.replaceState({ back: "/" }, "");
    const { wrapper, router } = await mountSidebar(false);
    const back = vi.spyOn(router, "back").mockImplementation(() => {});

    swipe(4, 200);

    expect(back).toHaveBeenCalledTimes(1);
    expect(useMenuExpanded().value).toBe(false);
    wrapper.unmount();
  });

  it("NAV-11: in a browser tab the app leaves back to the browser", async () => {
    onPhone(false);
    window.history.replaceState({ back: "/" }, "");
    const { wrapper, router } = await mountSidebar(false);
    const back = vi.spyOn(router, "back").mockImplementation(() => {});

    swipe(4, 200);

    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("NAV-11: with nothing to go back to, nothing happens", async () => {
    onPhone(true);
    window.history.replaceState({ back: null }, "");
    const { wrapper, router } = await mountSidebar(false);
    const back = vi.spyOn(router, "back").mockImplementation(() => {});

    swipe(4, 200);

    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("NAV-11: closing the open drawer from the left edge doesn't also go back", async () => {
    onPhone(true);
    window.history.replaceState({ back: "/" }, "");
    const { wrapper, router } = await mountSidebar(true);
    const back = vi.spyOn(router, "back").mockImplementation(() => {});

    swipe(4, 200);
    await flushPromises();

    expect(useMenuExpanded().value).toBe(false);
    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
