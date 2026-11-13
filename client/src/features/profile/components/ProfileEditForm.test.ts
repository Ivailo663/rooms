import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import PrimeVue from "primevue/config";
import { Select } from "primevue";
import { AxiosError, AxiosHeaders } from "axios";
import type { Account } from "@football/shared";
import { api } from "@/axios";
import ProfileEditForm from "./ProfileEditForm.vue";

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
  wrapper = mount(ProfileEditForm, {
    global: {
      plugins: [PrimeVue, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
  return wrapper;
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
  store.account = { ...baseAccount };
  vi.spyOn(api, "get").mockResolvedValue({ data: ["Sofia", "Varna"] });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const patchAnswering = () =>
  vi.spyOn(api, "patch").mockImplementation(async (_url, body) => ({
    data: { ...store.account, ...(body as object) },
  }));

type Exposed = {
  dirty: boolean;
  valid: boolean;
  save: () => Promise<boolean>;
};
const exposed = (w: VueWrapper) => w.vm as unknown as Exposed;

describe("ProfileEditForm (the Edit dialog)", () => {
  it("PROF-28: has the fields PROF-21 allows, and no email", async () => {
    const w = mountView();
    await flushPromises();

    const fields = w
      .findAll("[data-field]")
      .map((f) => f.attributes("data-field"));
    expect(fields).toEqual(["name", "position", "city", "bio"]);
    expect(w.text()).not.toContain("ana@example.test");
  });

  it("PROF-28: typing saves nothing; it only marks the form changed", async () => {
    const patch = patchAnswering();
    const w = mountView();
    expect(exposed(w).dirty).toBe(false);

    await w.find("#profile-name").setValue("Ana P");
    await flushPromises();

    expect(exposed(w).dirty).toBe(true);
    expect(patch).not.toHaveBeenCalled();
  });

  it("PROF-28: typing back to the saved value isn't a change", async () => {
    const w = mountView();
    await w.find("#profile-name").setValue("Ana P");
    await w.find("#profile-name").setValue("Ana Petrova");
    expect(exposed(w).dirty).toBe(false);
  });

  it("PROF-28: saving sends only the changed fields, in one request", async () => {
    const patch = patchAnswering();
    const w = mountView();
    await flushPromises();

    await w.find("#profile-bio").setValue("Left foot only");
    const [position] = w.findAllComponents(Select);
    position!.vm.$emit("update:modelValue", "defender");
    await flushPromises();

    expect(await exposed(w).save()).toBe(true);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("/user", {
      bio: "Left foot only",
      position: "defender",
    });
    expect(store.account!.bio).toBe("Left foot only");
  });

  it("PROF-28: opening again starts from the saved values", async () => {
    const first = mountView();
    await first.find("#profile-name").setValue("Not saved");
    first.unmount();

    const again = mountView();
    expect(
      (again.find("#profile-name").element as HTMLInputElement).value
    ).toBe("Ana Petrova");
  });

  it("PROF-76: a refusal keeps the dialog open, keeps what was typed and shows the server's message above the fields", async () => {
    vi.spyOn(api, "patch").mockRejectedValue(refusal("Name is taken"));
    const w = mountView();

    await w.find("#profile-name").setValue("Ana");
    expect(await exposed(w).save()).toBe(false);
    await flushPromises();

    expect(w.find("[data-server-error]").text()).toBe("Name is taken");
    expect((w.find("#profile-name").element as HTMLInputElement).value).toBe(
      "Ana"
    );
    expect(store.account!.name).toBe("Ana Petrova");
  });

  it("PROF-23, PROF-76: an empty or over-long name shows its limit and can't be saved", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-name").setValue("");
    expect(w.find('[data-error="name"]').text()).toBe("Name is required");
    expect(exposed(w).valid).toBe(false);

    const long = "a".repeat(55);
    await w.find("#profile-name").setValue(long);
    expect(w.find('[data-error="name"]').text()).toBe(
      "Name must be at most 50 characters"
    );
    expect((w.find("#profile-name").element as HTMLInputElement).value).toBe(
      long
    );
    expect(await exposed(w).save()).toBe(false);
    expect(patch).not.toHaveBeenCalled();
  });

  it("PROF-23, PROF-76: an over-long bio shows its limit and can't be saved", async () => {
    const patch = patchAnswering();
    const w = mountView();

    await w.find("#profile-bio").setValue("b".repeat(301));

    expect(w.find('[data-error="bio"]').text()).toBe(
      "Bio must be at most 300 characters"
    );
    expect(await exposed(w).save()).toBe(false);
    expect(patch).not.toHaveBeenCalled();
  });
});
