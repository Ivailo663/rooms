import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import PrimeVue from "primevue/config";
import { Select } from "primevue";
import { AxiosError, AxiosHeaders } from "axios";
import type { Account } from "@football/shared";
import { api } from "@/axios";
import ProfileView from "./ProfileView.vue";

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

const baseAccount = {
  id: 7,
  name: "Ana Petrova",
  email: "ana@example.test",
  picture_url: null,
  position: null,
  city: null,
  bio: null,
  created_at: new Date(2025, 2, 14).toISOString(),
  terms_accepted_at: new Date(2026, 10, 1).toISOString(),
} as unknown as Account;

// The server answers refusals as plain text (API-02).
const refusal = (message: string) =>
  new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    data: message,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

let wrapper: VueWrapper | undefined;

const mountView = () => {
  wrapper = mount(ProfileView, {
    global: {
      plugins: [PrimeVue, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
  return wrapper;
};

// Typing stops: the debounce runs out and the save settles.
const pause = async () => {
  await vi.advanceTimersByTimeAsync(1000);
  await flushPromises();
};

beforeEach(() => {
  // PrimeVue's Select listens for orientation changes and the Textarea
  // resizes itself; jsdom has neither matchMedia nor ResizeObserver.
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
  store.account = { ...baseAccount };
  vi.spyOn(api, "get").mockResolvedValue({ data: ["Sofia", "Varna"] });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const patchAnswering = () =>
  vi.spyOn(api, "patch").mockImplementation(async (_url, body) => ({
    data: { ...store.account, ...(body as object) },
  }));

describe("ProfileView", () => {
  it("PROF-26: shows every profile field, with member since read-only and no email", async () => {
    const w = mountView();
    await flushPromises();

    for (const field of ["name", "position", "city", "bio"]) {
      expect(w.find(`[data-field="${field}"]`).exists()).toBe(true);
    }
    expect(w.find("[data-member-since]").text()).toBe("Member since Mar 2025");
    expect(w.text()).toContain("AP");
    expect(w.text()).not.toContain("ana@example.test");
  });

  it("PROF-28: the name saves once typing stops, with no save button", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-name").setValue("Ana P");
    await vi.advanceTimersByTimeAsync(200);
    await w.find("#profile-name").setValue("Ana Petrova-Ivanova");
    expect(patch).not.toHaveBeenCalled();

    await pause();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("/user", {
      name: "Ana Petrova-Ivanova",
    });
    expect(w.find('button[type="submit"]').exists()).toBe(false);
    expect(w.find("[data-save-status]").text()).toBe("Saved");
  });

  it("PROF-28: the bio saves once typing stops, sending the saved name with it", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-bio").setValue("Left foot only");
    await pause();

    expect(patch).toHaveBeenCalledWith("/user", {
      name: "Ana Petrova",
      bio: "Left foot only",
    });
  });

  it("PROF-28: position and city save as soon as they're picked", async () => {
    const patch = patchAnswering();
    const w = mountView();
    await flushPromises();

    const [position, city] = w.findAllComponents(Select);
    position!.vm.$emit("update:modelValue", "defender");
    await flushPromises();
    city!.vm.$emit("update:modelValue", "Varna");
    await flushPromises();

    expect(patch).toHaveBeenNthCalledWith(1, "/user", {
      name: "Ana Petrova",
      position: "defender",
    });
    expect(patch).toHaveBeenNthCalledWith(2, "/user", {
      name: "Ana Petrova",
      city: "Varna",
    });
  });

  it("PROF-28: a refusal shows the server's message under the field and keeps what was typed", async () => {
    vi.spyOn(api, "patch").mockRejectedValue(refusal("Name is taken"));
    const w = mountView();

    await w.find("#profile-name").setValue("Ana");
    await pause();

    expect(w.find('[data-error="name"]').text()).toBe("Name is taken");
    expect((w.find("#profile-name").element as HTMLInputElement).value).toBe(
      "Ana"
    );
    expect(store.account!.name).toBe("Ana Petrova");
  });

  it("PROF-28: the next change after a refusal tries again", async () => {
    const patch = vi
      .spyOn(api, "patch")
      .mockRejectedValueOnce(refusal("Name is taken"))
      .mockImplementation(async (_url, body) => ({
        data: { ...store.account, ...(body as object) },
      }));
    const w = mountView();

    await w.find("#profile-name").setValue("Ana");
    await pause();
    await w.find("#profile-name").setValue("Ana P.");
    await pause();

    expect(patch).toHaveBeenCalledTimes(2);
    expect(w.find('[data-error="name"]').exists()).toBe(false);
    expect(store.account!.name).toBe("Ana P.");
  });

  it("PROF-23: an empty or over-long name is caught before sending, without cutting the input", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-name").setValue("");
    await pause();
    expect(w.find('[data-error="name"]').text()).toBe("Name is required");

    const long = "a".repeat(55);
    await w.find("#profile-name").setValue(long);
    await pause();
    expect(w.find('[data-error="name"]').text()).toBe(
      "Name must be at most 50 characters"
    );
    expect((w.find("#profile-name").element as HTMLInputElement).value).toBe(
      long
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it("PROF-23: an over-long bio is caught before sending", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-bio").setValue("b".repeat(301));
    await pause();

    expect(w.find('[data-error="bio"]').text()).toBe(
      "Bio must be at most 300 characters"
    );
    expect(patch).not.toHaveBeenCalled();
  });
});
