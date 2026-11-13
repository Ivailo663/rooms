import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { AxiosError, AxiosHeaders } from "axios";
import { api } from "@/axios";
import { useAuthStore } from "./auth";

const firebaseUser = { uid: "u1", getIdToken: async () => "token" };

vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  // Signs the Firebase user in as soon as the store starts listening.
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) =>
    callback(firebaseUser),
}));
vi.mock("vue-router", () => ({
  useRouter: () => ({
    currentRoute: { value: { name: "home" } },
    push: vi.fn(),
  }),
}));

const badRequest = (message: string) =>
  new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    data: message,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const account = (terms_accepted_at: string | null) => ({
  id: 7,
  name: "Ana",
  terms_accepted_at,
});

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());

describe("auth store", () => {
  it("AUTH-24: a signed-in user with no account sees the checkbox screen", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      badRequest("Tick the box to continue")
    );
    const store = useAuthStore();

    await store.init();

    expect(store.account).toBeNull();
    expect(store.needsTerms).toBe(true);
  });

  it("AUTH-21: an account that hasn't ticked the box sees it, one that has doesn't", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: account(null) });
    const store = useAuthStore();

    await store.init();
    expect(store.needsTerms).toBe(true);

    post.mockResolvedValueOnce({ data: account("2026-11-13T10:00:00Z") });
    await store.acceptTerms();
    await flushPromises();

    expect(post).toHaveBeenLastCalledWith("/user", { acceptTerms: true });
    expect(store.needsTerms).toBe(false);
  });

  it("AUTH-24: a sign-up that ticked the form's box sends the tick, so it isn't asked twice", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: account("2026-11-13T10:00:00Z") });
    const store = useAuthStore();
    store.acceptTermsOnSignIn = true;

    await store.init();

    expect(post).toHaveBeenCalledWith("/user", { acceptTerms: true });
    expect(store.needsTerms).toBe(false);
    expect(store.acceptTermsOnSignIn).toBe(false);
  });

  it("AUTH-24: an ordinary sign-in doesn't tick the box on the player's behalf", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: account(null) });
    const store = useAuthStore();

    await store.init();

    expect(post).toHaveBeenCalledWith("/user", {});
    expect(store.needsTerms).toBe(true);
  });
});
