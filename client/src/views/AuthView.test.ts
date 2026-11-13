import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import AuthView from "./AuthView.vue";

const TERMS_TEXT = "I'm 18 or over, and other players can rate me after games.";

const store = vi.hoisted(() => ({ acceptTermsOnSignIn: false }));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => store }));

const firebase = vi.hoisted(() => ({
  createUser: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  createUserWithEmailAndPassword: firebase.createUser,
  signInWithEmailAndPassword: firebase.signIn,
}));

const mountSignUp = async () => {
  const w = mount(AuthView, {
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  });
  const toggle = w
    .findAll("button")
    .find((b) => b.text().includes("Create an account"))!;
  await toggle.trigger("click");
  return w;
};

const createButton = (w: Awaited<ReturnType<typeof mountSignUp>>) =>
  w.findAll("button").find((b) => b.text().includes("Create account"))!;

afterEach(() => {
  store.acceptTermsOnSignIn = false;
  firebase.createUser.mockReset();
  firebase.signIn.mockReset();
  document.body.innerHTML = "";
});

describe("AuthView sign-up", () => {
  it("AUTH-20: signing up shows the unticked checkbox and can't continue without it", async () => {
    const w = await mountSignUp();

    expect(w.text()).toContain(TERMS_TEXT);
    expect((w.find("#sign-up-terms").element as HTMLInputElement).checked).toBe(
      false
    );
    expect(createButton(w).attributes("disabled")).toBeDefined();
    w.unmount();
  });

  it("AUTH-24: ticking it on the form carries the tick into the account's creation", async () => {
    firebase.createUser.mockResolvedValue({});
    const w = await mountSignUp();

    await w.find("#sign-up-terms").setValue(true);
    await createButton(w).trigger("click");
    await flushPromises();

    expect(firebase.createUser).toHaveBeenCalledTimes(1);
    expect(store.acceptTermsOnSignIn).toBe(true);
    w.unmount();
  });

  it("AUTH-20: signing in doesn't show the checkbox", () => {
    const w = mount(AuthView, { global: { plugins: [PrimeVue] } });
    expect(w.text()).not.toContain(TERMS_TEXT);
    w.unmount();
  });
});
