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
  it("HEAD-02: with no game the island hugs the days, centred, and the block is absent", () => {
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes()).toContain("w-fit");
    // Centred by its own auto margins.
    expect(island.classes()).toContain("!mx-auto");
    expect(w.find("[data-my-games]").exists()).toBe(false);
    expect(island.element.firstElementChild).toBe(w.get("[data-days]").element);
  });

  it("HEAD-03: with a game the island still hugs and is centred, days first and the block right after", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes()).toContain("w-fit");
    expect(island.classes()).toContain("!mx-auto");
    // Not stretched to the deck's width, and nothing pushes the block away.
    expect(island.classes().join(" ")).not.toMatch(
      /\bw-\[|\bw-full|justify-between/
    );

    const days = w.get("[data-days]").element;
    const block = w.get("[data-my-games]").element;
    expect(island.element.firstElementChild).toBe(days);
    // The block sits in the Transition right after the days (test-utils
    // renders it as a stub element).
    expect(days.nextElementSibling?.contains(block)).toBe(true);
  });

  it("HEAD-04: the block comes and goes through a fade-and-slide Transition, the island's size doesn't animate", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();
    const island = w.get("[data-island]");

    expect(island.classes().join(" ")).not.toContain("transition-[width");
    const transition = w.findComponent({ name: "Transition" });
    const props = transition.props() as Record<string, string>;
    for (const cls of [props.enterActiveClass, props.leaveActiveClass]) {
      expect(cls).toContain("transition");
      // Reduced motion: no transition, so no duration and it just appears.
      expect(cls).toContain("motion-reduce:transition-none");
    }
    expect(props.enterFromClass).toContain("opacity-0");
    expect(props.enterFromClass).toContain("translate-x-");
    expect(props.leaveToClass).toContain("opacity-0");
    expect(props.leaveToClass).toContain("translate-x-");
  });

  it("HEAD-04: the days keep their size and never wrap while the block changes", async () => {
    const w = mountHeader();
    const days = w.get("[data-days]");
    expect(days.classes()).toContain("shrink-0");
    expect(days.classes()).not.toContain("flex-wrap");

    joinedSlots.value = [slot];
    await w.vm.$nextTick();
    expect(w.get("[data-days]").element).toBe(days.element);
    expect(w.find("[data-my-games]").exists()).toBe(true);
  });

  it("HEAD-04: losing the game takes the block away and the island still hugs", async () => {
    joinedSlots.value = [slot];
    const w = mountHeader();

    joinedSlots.value = [];
    await w.vm.$nextTick();

    // test-utils stubs transitions, so the leave completes at once.
    expect(w.find("[data-my-games]").exists()).toBe(false);
    expect(w.get("[data-island]").classes()).toContain("w-fit");
  });

  it("HEAD-10: with the block neither the day row nor either line of it can wrap, and the island fits", () => {
    joinedSlots.value = [slot];
    const w = mountHeader();

    expect(w.get("[data-days]").classes()).toContain("shrink-0");
    const block = w.get("[data-my-games]").classes();
    expect(block).toContain("whitespace-nowrap");
    expect(block).toContain("shrink-0");
    // Hugging, never wider than its contents; the 390px fit itself needs a
    // real browser, where the days (7 x 28px) plus the block are ~330px.
    expect(w.get("[data-island]").classes()).toContain("w-fit");
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
