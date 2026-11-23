import { describe, it, expect, vi, afterEach } from "vitest";
import { ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

const slot = {
  timeslotId: 1,
  roomId: 1,
  roomName: "Depot",
  address: "Rail St 1",
  label: "20:00",
  day: "fr",
  start_time: 1200,
  status: "scheduled",
  price: null,
  features: [],
  players: [{ id: 1, name: "Ivo" }],
  max_players: 12,
  membership: "joined",
  lateJoinCutoff: 120,
};

vi.mock("@/socket", () => ({ socket: { on: vi.fn(), off: vi.fn() } }));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));
vi.mock("../composables/queries", () => ({
  useGetJoinedSlots: () => ({ data: ref([slot]) }),
  useLeaveTimeslot: () => ({ mutate: vi.fn(), isPending: ref(false) }),
}));

import MyGameHub from "./MyGameHub.vue";

let wrapper: VueWrapper | undefined;

const mountHub = () => {
  wrapper = mount(MyGameHub, {
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
  });
  return wrapper;
};

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("MyGameHub status pill", () => {
  // jsdom does no layout, so this checks what decides the clipping rather
  // than the painted result: an absolutely positioned element is cut by any
  // ancestor that hides its overflow, whatever its z-index.
  it("CARD-37: the pill hangs outside the card, with nothing clipping it", () => {
    const w = mountHub();

    const pill = [...w.element.querySelectorAll("span")].find((span) =>
      span.textContent?.includes("You're in")
    )!;
    expect(pill).toBeTruthy();
    expect(pill.className).toContain("-translate-y-1/2");

    const clippers: string[] = [];
    for (let el = pill.parentElement; el; el = el.parentElement) {
      if (/overflow-(hidden|y-auto|x-auto|auto)/.test(el.className)) {
        clippers.push(el.className);
      }
    }
    expect(clippers).toEqual([]);

    // The card still clips its own glow, and the pill is its sibling rather
    // than its child — that shell is the only reason the pill survives.
    const card = w.element.querySelector(".hub-card")!;
    expect(card.className).toContain("overflow-hidden");
    expect(pill.parentElement).toBe(card.parentElement);
  });

  // Found by what it does rather than what it says, so renaming the label
  // doesn't turn this red.
  it("CARD-36: one control in the card's corner goes back to browsing", async () => {
    const w = mountHub();

    const browsers = [];
    for (const button of w.findAll("button")) {
      const before = w.emitted("browse")?.length ?? 0;
      await button.trigger("click");
      if ((w.emitted("browse")?.length ?? 0) > before) browsers.push(button);
    }

    expect(browsers).toHaveLength(1);
    // CARD-21's count lives in the roster header, so it isn't repeated here.
    expect(browsers[0]!.text()).not.toMatch(/\d+\s*\/\s*\d+/);
  });
});
