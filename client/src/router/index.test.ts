import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Account } from "@football/shared";

const store = vi.hoisted(() => ({
  account: null as Account | null,
  ready: Promise.resolve(),
  user: {},
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => store }));
vi.mock("@/stores/role", () => ({ useRoleStore: () => ({}) }));

const Blank = { default: { template: "<div />" } };
vi.mock("@/views/ProtectedLayout.vue", () => ({
  default: { template: "<router-view />" },
}));
vi.mock("@/views/HomeView.vue", () => Blank);
vi.mock("@/features/profile/PlayerProfileView.vue", () => Blank);

const { default: router } = await import("./index");

beforeEach(async () => {
  await router.push("/");
});

describe("router", () => {
  it("PROF-26: /profile opens the player's own /profiles/:id", async () => {
    store.account = { id: 7 } as Account;

    await router.push("/profile");

    expect(router.currentRoute.value.fullPath).toBe("/profiles/7");
  });

  it("PROF-26: /profile without an account goes home", async () => {
    store.account = null;

    await router.push("/profile");

    expect(router.currentRoute.value.name).toBe("home");
  });
});
