import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { RoomView } from "@/constants";

const slot = {
  timeslotId: 1,
  roomId: 1,
  roomName: "Depot",
  address: "Rail St 1",
  label: "19:00",
  day: "th",
  start_time: 1140,
  status: "scheduled",
  price: null,
  features: [],
  players: [],
  max_players: 12,
  membership: "joined",
  lateJoinCutoff: 120,
};

const joinedSlots = ref<unknown[]>([]);
const view = ref<RoomView>(RoomView.Play);

vi.mock("../composables/queries", () => ({
  useGetJoinedSlots: () => ({ data: joinedSlots }),
}));
vi.mock("@/composables/useRoomView", () => ({ useRoomView: () => view }));

import RoomsHeader from "./RoomsHeader.vue";
import { useGameMode } from "../composables/useGameMode";

let wrapper: VueWrapper | undefined;

const mountHeader = () => {
  wrapper = mount(RoomsHeader, { props: { search: "" } });
  return wrapper;
};

beforeEach(() => {
  // A Thursday noon, so a 19:00 Thursday slot is upcoming.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 26, 12, 0));
  joinedSlots.value = [];
  view.value = RoomView.Play;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});

// jsdom does no layout, so the geometry below is read from the classes that
// decide it. What the painted island looks like needs a real browser.
describe("RoomsHeader island", () => {
  it("HEAD-02: with no game the island hugs the days and the block is absent", () => {
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes().join(" ")).toContain("w-[calc(");
    expect(island.classes()).not.toContain("w-[min(100%,42rem)]");
    expect(w.find("[data-my-games]").exists()).toBe(false);
    // Centred by its own auto margins, at either width.
    expect(island.classes()).toContain("mx-auto");
  });

  it("HEAD-03: with a game the island spans the deck, days at the left, block at the right", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes()).toContain("w-[min(100%,42rem)]");
    expect(island.classes()).toContain("justify-between");

    const days = w.get("[data-days]").element;
    const block = w.get("[data-my-games]").element;

    // The block follows the days in the row, so justify-between pins it right.
    expect(days.compareDocumentPosition(block)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(island.element.firstElementChild).toBe(days);
  });

  it("HEAD-04: the width transitions, the days never shrink, and reduced motion drops it", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes().join(" ")).toContain("transition-[width");
    expect(island.classes()).toContain("motion-reduce:transition-none");
    // The days keep their natural size, so they cannot re-wrap mid-resize.
    expect(w.get("[data-days]").classes()).toContain("shrink-0");
    expect(w.get("[data-days]").classes()).not.toContain("flex-wrap");
  });

  it("HEAD-04: losing the game goes back to the hugging width", async () => {
    joinedSlots.value = [slot];
    const w = mountHeader();

    joinedSlots.value = [];
    await w.vm.$nextTick();

    expect(w.get("[data-island]").classes()).not.toContain(
      "w-[min(100%,42rem)]"
    );
  });

  it("HEAD-10: neither the day row nor the block can wrap", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();

    expect(w.get("[data-days]").classes()).toContain("shrink-0");
    const block = w.get("[data-my-games]").classes();
    expect(block).toContain("whitespace-nowrap");
    expect(block).toContain("shrink-0");
  });

  it("HEAD-09: tapping the block brings the hub back", async () => {
    joinedSlots.value = [slot];
    const { showGameHub, browseGames } = useGameMode();
    const w = mountHeader();

    browseGames();
    expect(showGameHub.value).toBe(false);

    await w.get("[data-my-games]").trigger("click");

    expect(showGameHub.value).toBe(true);
  });

  it("HEAD-11: in Host view it is the title and subtitle only", () => {
    view.value = RoomView.Host;
    joinedSlots.value = [slot];
    const w = mountHeader();

    expect(w.get("h1").text()).toBe("Your Rooms");
    expect(w.text()).toContain("Manage and configure your hosted rooms");
    expect(w.find("[data-island]").exists()).toBe(false);
    expect(w.find("[data-days]").exists()).toBe(false);
    expect(w.find("[data-my-games]").exists()).toBe(false);
  });
});
