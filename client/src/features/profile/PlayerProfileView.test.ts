import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createMemoryHistory, createRouter } from "vue-router";
import PrimeVue from "primevue/config";
import { AxiosError, AxiosHeaders } from "axios";
import type { Account, PlayerProfile } from "@football/shared";
import { api } from "@/axios";
import PlayerProfileView from "./PlayerProfileView.vue";

const store = vi.hoisted(() => ({
  account: null as Account | null,
  setAccount(next: Account) {
    store.account = next;
  },
}));

vi.mock("@/stores/auth", async () => {
  const { reactive } = await import("vue");
  const reactiveStore = reactive(store);
  return { useAuthStore: () => reactiveStore };
});

const profile: PlayerProfile = {
  id: 4,
  name: "Ana Petrova",
  picture_url: null,
  position: "midfielder",
  city: "Varna",
  bio: "Left foot only",
  created_at: new Date(2025, 2, 14).toISOString(),
};

const notFound = () =>
  new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    data: "Player not found",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", name: "home", component: { template: "<div />" } }],
});

let wrapper: VueWrapper | undefined;

const mountView = (id = 4) => {
  wrapper = mount(PlayerProfileView, {
    props: { id },
    global: {
      plugins: [
        PrimeVue,
        router,
        [VueQueryPlugin, { queryClient: new QueryClient() }],
      ],
    },
    attachTo: document.body,
  });
  return wrapper;
};

// The dialog is teleported to <body>.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const account = {
  ...profile,
  email: "ana@example.test",
  terms_accepted_at: new Date(2026, 10, 1).toISOString(),
} as unknown as Account;

beforeEach(() => {
  store.account = null;
  // PrimeVue's Select and Textarea (in the dialog) need these; jsdom has
  // neither.
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlayerProfileView", () => {
  it("PROF-29: shows the player from GET /players/:id", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    expect(get).toHaveBeenCalledWith("/players/4");
    expect(view.find("h1").text()).toBe("Ana Petrova");
  });

  it("PROF-29: an unknown id shows Player not found, without retrying", async () => {
    const get = vi.spyOn(api, "get").mockRejectedValue(notFound());

    const view = mountView(999);
    await flushPromises();

    expect(view.find("[data-not-found]").text()).toContain("Player not found");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("NAV-12: the page floats a back arrow, whether the player loads or not", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });
    const view = mountView();
    await flushPromises();
    expect(view.find('button[aria-label="Back"]').exists()).toBe(true);
    view.unmount();

    const missing = mountView(Number("abc"));
    await flushPromises();
    expect(missing.find('button[aria-label="Back"]').exists()).toBe(true);
  });

  it("PROF-29: an id that isn't a number shows Player not found and asks nothing", async () => {
    const get = vi.spyOn(api, "get");

    const view = mountView(Number("abc"));
    await flushPromises();

    expect(view.find("[data-not-found]").exists()).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it("PROF-70: a round picture, initials when there's none, and the details with icons", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    expect(view.find("img").exists()).toBe(false);
    expect(view.text()).toContain("AP");
    const meta = view.find("[data-profile-meta]");
    expect(meta.text()).toContain("Midfielder");
    expect(meta.text()).toContain("Varna");
    expect(meta.text()).toContain("Member since Mar 2025");
    expect(meta.findAll("i")).toHaveLength(3);
  });

  it("PROF-70: shows the picture when there is one", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, picture_url: "https://example.test/ana.jpg" },
    });

    const view = mountView();
    await flushPromises();

    expect(view.find("img").attributes("src")).toBe(
      "https://example.test/ana.jpg"
    );
  });

  it("PROF-70: an unset position or city drops out of the details", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, position: null, city: null },
    });

    const view = mountView();
    await flushPromises();

    const meta = view.find("[data-profile-meta]");
    expect(meta.findAll("li")).toHaveLength(1);
    expect(meta.text()).not.toContain("Not set");
  });

  it("PROF-32: never shows an email, even if one came back", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, email: "ana@example.test" },
    });

    const view = mountView();
    await flushPromises();

    expect(view.text()).not.toContain("ana@example.test");
  });

  it("PROF-74: your own page shows Edit and a disabled Add, even with an empty grid", async () => {
    store.account = { id: 4 } as Account;
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    const actions = view.find("[data-own-actions]");
    expect(actions.find("[data-edit-profile]").text()).toBe("Edit");
    const add = actions.find("[data-add-media]");
    expect(add.attributes("disabled")).toBeDefined();
    expect(actions.text()).toContain("Coming soon");
  });

  it("PROF-74: someone else's page has no Edit or Add", async () => {
    store.account = { id: 7 } as Account;
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    expect(view.find("[data-own-actions]").exists()).toBe(false);
    expect(view.find("[data-edit-profile]").exists()).toBe(false);
    expect(view.find("[data-add-media]").exists()).toBe(false);
  });

  it("PROF-28: Edit opens the dialog with the profile fields", async () => {
    store.account = { ...account };
    vi.spyOn(api, "get").mockImplementation(async (url) => ({
      data: url === "/cities" ? ["Varna"] : profile,
    }));

    const view = mountView();
    await flushPromises();
    expect(dialog()).toBeNull();

    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    expect(dialog()?.textContent).toContain("Edit profile");
    expect(
      dialog()?.querySelector<HTMLInputElement>("#profile-name")?.value
    ).toBe("Ana Petrova");
  });

  it("PROF-28: ✕ turns into ✓ on a change, and ✓ saves, closes and updates the page", async () => {
    store.account = { ...account };
    vi.spyOn(api, "get").mockImplementation(async (url) => ({
      data: url === "/cities" ? ["Varna"] : { ...profile, ...store.account },
    }));
    vi.spyOn(api, "patch").mockImplementation(async (_url, body) => ({
      data: { ...store.account, ...(body as object) },
    }));

    const view = mountView();
    await flushPromises();
    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    const input = dialog()!.querySelector<HTMLInputElement>("#profile-name")!;
    input.value = "Ana P.";
    expect(dialog()!.querySelector("[data-close]")).not.toBeNull();
    input.dispatchEvent(new Event("input"));
    await flushPromises();

    expect(dialog()!.querySelector("[data-close]")).toBeNull();
    dialog()!.querySelector<HTMLButtonElement>("[data-save]")!.click();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);

    expect(view.find("h1").text()).toBe("Ana P.");
    expect(dialog()).toBeNull();
  });

  it("PROF-28: closing with ✕ when nothing changed sends nothing", async () => {
    store.account = { ...account };
    vi.spyOn(api, "get").mockImplementation(async (url) => ({
      data: url === "/cities" ? ["Varna"] : { ...profile, ...store.account },
    }));
    const patch = vi.spyOn(api, "patch");

    const view = mountView();
    await flushPromises();
    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    dialog()!.querySelector<HTMLButtonElement>("[data-close]")!.click();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);

    expect(patch).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("PROF-75: your own empty grid says Add your first photo or clip, and nothing else", async () => {
    store.account = { id: 4 } as Account;
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    const grid = view.find("[data-profile-grid]");
    expect(grid.text()).toBe("Add your first photo or clip");
    expect(grid.find("button").exists()).toBe(false);
  });

  it("PROF-75: someone else's empty grid says No posts yet", async () => {
    store.account = { id: 7 } as Account;
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    const view = mountView();
    await flushPromises();

    const grid = view.find("[data-profile-grid]");
    expect(grid.text()).toContain("No posts yet");
    expect(grid.text()).not.toContain("Add your first photo or clip");
  });
});
