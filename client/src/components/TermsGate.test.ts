import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import { AxiosError, AxiosHeaders } from "axios";
import TermsGate from "./TermsGate.vue";

const TERMS_TEXT = "I'm 18 or over, and other players can rate me after games.";

const store = vi.hoisted(() => ({ acceptTerms: vi.fn() }));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => store }));
vi.mock("firebase/auth", () => ({ getAuth: () => ({}), signOut: vi.fn() }));

const mountGate = () =>
  mount(TermsGate, {
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  });

const continueButton = (w: ReturnType<typeof mountGate>) =>
  w.find('button[type="submit"]');

afterEach(() => {
  store.acceptTerms.mockReset();
  document.body.innerHTML = "";
});

describe("TermsGate", () => {
  it("AUTH-21: shows the sign-up checkbox, unticked, in the same words", () => {
    const w = mountGate();
    expect(w.text()).toContain(TERMS_TEXT);
    expect(
      (w.find("#terms-gate-tick").element as HTMLInputElement).checked
    ).toBe(false);
    w.unmount();
  });

  it("AUTH-24: can't continue until the box is ticked, then records the tick", async () => {
    store.acceptTerms.mockResolvedValue(undefined);
    const w = mountGate();

    expect(continueButton(w).attributes("disabled")).toBeDefined();
    await w.find("form").trigger("submit");
    expect(store.acceptTerms).not.toHaveBeenCalled();

    await w.find("#terms-gate-tick").setValue(true);
    expect(continueButton(w).attributes("disabled")).toBeUndefined();
    await w.find("form").trigger("submit");
    await flushPromises();

    expect(store.acceptTerms).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it("AUTH-24: a refusal shows the server's message and stays on the screen", async () => {
    store.acceptTerms.mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        data: "Tick the box to continue",
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    );
    const w = mountGate();

    await w.find("#terms-gate-tick").setValue(true);
    await w.find("form").trigger("submit");
    await flushPromises();

    expect(w.find("[data-terms-error]").text()).toBe(
      "Tick the box to continue"
    );
    w.unmount();
  });
});
