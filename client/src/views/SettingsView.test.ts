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
  it("SET-11: a caller with no tenant sees the no-venue state and nothing is fetched or saved", async () => {
    auth.user = { id: 7, tenantid: null };
    const get = vi.spyOn(api, "get");
    const post = vi.spyOn(api, "post");

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find("[data-no-venue]").text()).toBe(
      "You don't manage a venue"
    );
    expect(wrapper.text()).not.toContain("Player Management");
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("SET-11: while the account is still loading, the no-venue state doesn't show", async () => {
    auth.user = { uid: "firebase-only" };
    const get = vi.spyOn(api, "get");

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find("[data-no-venue]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Player Management");
    expect(get).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
