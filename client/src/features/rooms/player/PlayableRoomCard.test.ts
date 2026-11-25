import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

// jsdom does no layout, so the card's height is whatever the test says.
const cardHeight = ref(0);
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useElementSize: () => ({ width: ref(0), height: cardHeight }),
}));
vi.mock("embla-carousel-vue", async () => (await import("./fakeEmbla")).module);
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));
// The join in flight, as the real mutation reports it.
const joinPending = ref(false);
const joinVariables = ref<number | undefined>(undefined);
const joinMutate = vi.fn();
vi.mock("../composables/queries", () => ({
  useGetJoinedSlots: () => ({ data: ref([]) }),
  useJoinTimeslot: () => ({
    mutate: joinMutate,
    isPending: joinPending,
    variables: joinVariables,
  }),
  useLeaveTimeslot: () => ({
    mutate: vi.fn(),
    isPending: ref(false),
    variables: ref(undefined),
  }),
}));

import PlayableRoomCard from "./PlayableRoomCard.vue";
import { fakeEmbla } from "./fakeEmbla";

beforeEach(() => fakeEmbla.reset());

const room = {
  id: 1,
  name: "Depot",
  description: "Floodlit pitch behind the old railway depot.",
  address: "Rail St 1",
  price: null,
  deniedMessage: null,
  lateJoinCutoff: 0,
  allowJoinOnLive: false,
  timeslots: [
    {
      id: 10,
      name: "18:00",
      label: "18:00",
      message: "Bring a dark shirt",
      price: null,
      features: ["ball", "showers", "parking"],
      playersCount: 0,
      max_players: 10,
      status: "scheduled",
      day: "su",
      start_time: 1080,
      players: [],
      requestStatusForCurrentUser: null,
    },
  ],
};

let wrapper: VueWrapper | undefined;
const mountCard = (height: number, roomProp: object = room) => {
  cardHeight.value = height;
  wrapper = mount(PlayableRoomCard, {
    props: { room: roomProp } as never,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
  return wrapper;
};

const description = (w: VueWrapper) => w.find("[data-header] p");

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("PlayableRoomCard header steps", () => {
  it.skip("CARD-05: roomy shows the description on two lines, and the slot message", () => {
    const w = mountCard(540);
    expect(w.find(".room-card").attributes("data-header-size")).toBe("roomy");
    expect(description(w).classes()).toContain("line-clamp-2");
    expect(w.text()).toContain("Bring a dark shirt");
  });

  it.skip("CARD-05: compact cuts the description to one line and keeps the rest", () => {
    const w = mountCard(375);
    expect(w.find(".room-card").attributes("data-header-size")).toBe("compact");
    expect(description(w).classes()).toContain("line-clamp-1");
    expect(w.text()).toContain("Bring a dark shirt");
  });

  it("CARD-05: tight drops the description and the slot message", () => {
    const w = mountCard(345);
    expect(w.find(".room-card").attributes("data-header-size")).toBe("tight");
    expect(description(w).exists()).toBe(false);
    expect(w.text()).not.toContain("railway depot");
    expect(w.text()).not.toContain("Bring a dark shirt");
  });

  it("CARD-01: the header holds the title, address and description, never features", () => {
    for (const height of [540, 375, 345]) {
      const w = mountCard(height);
      expect(w.find("[data-header]").text()).toContain("Depot");
      expect(w.find("[data-header]").text()).toContain("Rail St 1");
      expect(w.find("[data-header]").text()).not.toMatch(
        /ball|showers|parking/
      );
      expect(w.find("[data-header] .rounded-full").exists()).toBe(false);
      w.unmount();
    }
  });

  it("CARD-11: the features are on the slot's tile instead", () => {
    const w = mountCard(540);
    expect(w.find(".slot-tile [data-features]").text()).toContain("showers");
  });

  it("CARD-06: the header is shrinkable and clipped, so it gives way before the picker", () => {
    const w = mountCard(345);
    const header = w.find("[data-header]");
    expect(header.classes()).toEqual(
      expect.arrayContaining(["shrink", "min-h-0", "overflow-hidden"])
    );
  });
});

describe("PlayableRoomCard action follows the swipe", () => {
  const slotOf = (id: number, extra: object = {}) => ({
    ...room.timeslots[0]!,
    id,
    label: `${10 + id}:00`,
    // Far future, so the join gates stay open whatever day the suite runs.
    ...extra,
  });
  const twoSlots = {
    ...room,
    deniedMessage: "Sorry, we're full of regulars",
    timeslots: [
      slotOf(1, { requestStatusForCurrentUser: "denied" }),
      slotOf(2, { requestStatusForCurrentUser: "pending" }),
      slotOf(3, { players: [{ id: 1, name: "Me" }] }),
    ],
  };

  // The strip moves to a slide mid-swipe: its position changes, nothing settles.
  const swipeTo = async (_w: VueWrapper, index: number) => {
    fakeEmbla.swipeTo(index);
    await nextTick();
  };
  const line = (w: VueWrapper, index: number) =>
    w.findAll(".slot-tile")[index]!.find(".slot-hint");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    joinPending.value = false;
    joinVariables.value = undefined;
    joinMutate.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CARD-38: each tile carries its own slot's line, and the denial note follows the centred tile", async () => {
    const w = mountCard(540, twoSlots);
    expect(line(w, 0).text()).toBe("Not accepted");
    expect(line(w, 1).text()).toBe("Awaiting approval");
    expect(line(w, 2).text()).toBe("Hold to leave");
    expect(w.text()).toContain("Sorry, we're full of regulars");

    // Mid-swipe, before the strip settles, the note has already gone.
    await swipeTo(w, 1);
    expect(w.text()).not.toContain("Sorry, we're full of regulars");
    await swipeTo(w, 0);
    expect(w.text()).toContain("Sorry, we're full of regulars");
  });

  it("CARD-39: the slot in flight is the one that spins, wherever the strip is centred", async () => {
    const joinable = {
      ...room,
      timeslots: [slotOf(1), slotOf(2)],
    };
    const w = mountCard(540, joinable);
    joinPending.value = true;
    joinVariables.value = 1;
    await nextTick();
    expect(line(w, 0).text()).toBe("Joining…");

    await swipeTo(w, 1);
    expect(line(w, 1).text()).toBe("Hold to join");
    expect(w.find(".slot-press").attributes("aria-disabled")).toBe("true");
    expect(joinMutate).not.toHaveBeenCalled();
  });

  it("CARD-39: a hold joins the slot it was made on, not the settled one", async () => {
    const joinable = { ...room, timeslots: [slotOf(1), slotOf(2)] };
    const w = mountCard(540, joinable);
    await swipeTo(w, 1);
    w.find(".slot-press").element.dispatchEvent(
      new MouseEvent("pointerdown", { button: 0, bubbles: true })
    );
    await nextTick();
    vi.advanceTimersByTime(1000);
    expect(joinMutate).toHaveBeenCalledWith(2, expect.anything());
  });
});
