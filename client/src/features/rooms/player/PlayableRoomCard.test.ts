import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

// jsdom does no layout, so the card's height is whatever the test says.
const cardHeight = ref(0);
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useElementSize: () => ({ width: ref(0), height: cardHeight }),
}));
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));
vi.mock("../composables/queries", () => ({
  useGetJoinedSlots: () => ({ data: ref([]) }),
  useJoinTimeslot: () => ({ mutate: vi.fn(), isPending: ref(false) }),
  useLeaveTimeslot: () => ({ mutate: vi.fn(), isPending: ref(false) }),
}));

import PlayableRoomCard from "./PlayableRoomCard.vue";

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
const mountCard = (height: number) => {
  cardHeight.value = height;
  wrapper = mount(PlayableRoomCard, {
    props: { room } as never,
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
    expect(w.find(".room-card").attributes("data-header-step")).toBe("roomy");
    expect(description(w).classes()).toContain("line-clamp-2");
    expect(w.text()).toContain("Bring a dark shirt");
  });

  it.skip("CARD-05: compact cuts the description to one line and keeps the rest", () => {
    const w = mountCard(375);
    expect(w.find(".room-card").attributes("data-header-step")).toBe("compact");
    expect(description(w).classes()).toContain("line-clamp-1");
    expect(w.text()).toContain("Bring a dark shirt");
  });

  it("CARD-05: tight drops the description and the slot message", () => {
    const w = mountCard(345);
    expect(w.find(".room-card").attributes("data-header-step")).toBe("tight");
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
