import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { nextTick, type Ref } from "vue";
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
// The hub's joined slots and the leave call, which each test steers.
const { joined, leave } = vi.hoisted(() => ({
  joined: { value: null as unknown },
  leave: vi.fn(),
}));
vi.mock("../composables/queries", async () => {
  const { ref } = await import("vue");
  joined.value = ref([]);
  return {
    useGetJoinedSlots: () => ({ data: joined.value }),
    useLeaveTimeslot: () => ({ mutate: leave, isPending: ref(false) }),
  };
});

import MyGameHub from "./MyGameHub.vue";

let wrapper: VueWrapper | undefined;

const joinedSlots = () => joined.value as Ref<unknown[]>;

beforeEach(() => {
  joinedSlots().value = [slot];
  leave.mockReset();
});

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

describe("MyGameHub hold to leave", () => {
  // The roster locks only on the game's own day, so moving the game to a
  // day that isn't today keeps the seat leavable whenever this runs.
  const realDay = slot.day;
  beforeEach(() => {
    slot.day = new Date().getDay() === 1 ? "tu" : "mo";
  });
  afterEach(() => {
    slot.day = realDay;
  });

  it("CARD-35: holding Hold to leave fades the whole hub card to a veil that says Leaving game", async () => {
    const w = mountHub();
    const card = w.get(".hub-card");
    const wash = card.get("[data-hold-wash]");

    // A direct child of the card, so it spans the card, not the button.
    expect(wash.element.parentElement).toBe(card.element);
    expect(wash.attributes("data-hold-wash")).toBe("leave");
    expect(wash.classes()).not.toContain("hold-wash--active");
    expect(wash.text()).toContain("Leaving game");
    expect(wash.text()).toContain("(Keep holding)");
    // The card is its own stacking context, so the veil can't escape it.
    expect(card.classes()).toEqual(
      expect.arrayContaining(["relative", "isolate"])
    );

    const leave = card.get('button[aria-label="Leave game"]');
    leave.element.dispatchEvent(
      new MouseEvent("pointerdown", { button: 0, bubbles: true })
    );
    await nextTick();
    expect(wash.classes()).toContain("hold-wash--active");

    leave.element.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(wash.classes()).not.toContain("hold-wash--active");
  });

  describe("once the hold completes", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const fullHold = async (w: VueWrapper) => {
      w.get('button[aria-label="Leave game"]').element.dispatchEvent(
        new MouseEvent("pointerdown", { button: 0, bubbles: true })
      );
      await nextTick();
      vi.advanceTimersByTime(1000);
      await nextTick();
    };

    it("CARD-35: the card stays faded with a spinner and Leaving…, the button disabled and bare, until the hub moves on", async () => {
      const w = mountHub();
      await fullHold(w);

      expect(leave).toHaveBeenCalledTimes(1);
      const veil = w.get("[data-hold-wash]");
      expect(veil.classes()).toContain("hold-wash--active");
      expect(veil.text()).toContain("Leaving…");
      expect(veil.find("i.fa-spinner").exists()).toBe(true);
      expect(veil.text()).not.toContain("Keep holding");
      const button = w.get('button[aria-label="Leave game"]');
      expect(button.attributes("disabled")).toBeDefined();
      expect(button.find("i").exists()).toBe(false);

      // The call landing isn't enough: the hub still shows the old game.
      leave.mock.calls[0]![1].onSuccess?.();
      await nextTick();
      expect(veil.classes()).toContain("hold-wash--active");

      // The next game replaces it: the hub has moved on.
      joinedSlots().value = [{ ...slot, timeslotId: 2 }];
      await nextTick();
      const next = w.get("[data-hold-wash]");
      expect(next.classes()).not.toContain("hold-wash--active");
      expect(next.text()).toContain("(Keep holding)");
    });

    it("CARD-35: leaving the last game takes the hub away with the veil still up", async () => {
      const w = mountHub();
      await fullHold(w);
      joinedSlots().value = [];
      await nextTick();
      expect(w.find(".hub-card").exists()).toBe(false);
    });

    it("CARD-35: if the leave fails the card fades back and the button is live again", async () => {
      const w = mountHub();
      await fullHold(w);
      leave.mock.calls[0]![1].onError(new Error("locked"));
      await nextTick();

      const veil = w.get("[data-hold-wash]");
      expect(veil.classes()).not.toContain("hold-wash--active");
      expect(veil.text()).toContain("(Keep holding)");
      expect(
        w.get('button[aria-label="Leave game"]').attributes("disabled")
      ).toBeUndefined();
    });
  });
});
