import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { api } from "@/axios";
import SettingsView from "./SettingsView.vue";

// The account as the auth store holds it: before POST /user answers there's
// only the Firebase half, with no `id`.
const auth = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const mountView = () =>
  mount(SettingsView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsView", () => {
  it("SET-11: a caller with no tenant fetches nothing, saves nothing, and renders nothing", async () => {
    auth.user = { id: 7, tenantid: null };
    const get = vi.spyOn(api, "get");
    const post = vi.spyOn(api, "post");

    const wrapper = mountView();
    await flushPromises();

    // Blank rather than explained: the page neither checks the role nor reads
    // a 403, because SET-10 keeps anyone the server would refuse from ever
    // reaching it.
    expect(wrapper.text()).toBe("");
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("SET-11: nothing renders while the account is still loading", async () => {
    auth.user = { uid: "firebase-only" };
    const get = vi.spyOn(api, "get");

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toBe("");
    expect(get).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
