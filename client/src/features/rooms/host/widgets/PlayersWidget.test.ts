import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import PlayersWidget from "./PlayersWidget.vue";
import SlotAvatars from "../../player/SlotAvatars.vue";

// The details card fetches the player's profile when it opens (PROF-11);
// these tests are about opening and closing it, so the fetch never settles.
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));

const queryPlugin = (): [typeof VueQueryPlugin, { queryClient: QueryClient }] => [
  VueQueryPlugin,
  { queryClient: new QueryClient() },
];

vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: null }) }));

const players = [
  { id: 1, name: "Ana Petrova" },
  { id: 2, name: "Boris" },
];

const card = () => document.body.querySelector("[data-player-details-card]");

let wrapper: VueWrapper | undefined;

const mountWidget = (props: InstanceType<typeof PlayersWidget>["$props"]) => {
  wrapper = mount(PlayersWidget, {
    props,
    attachTo: document.body,
    global: { plugins: [queryPlugin()] },
  });
  return wrapper;
};

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("PlayersWidget avatars", () => {
  it("HCARD-13: draws the roster with the shared avatar row", () => {
    const w = mountWidget({
      info: { count: 2, max: 10, gathered: false },
      players,
    });
    const row = w.findComponent(SlotAvatars);
    expect(row.exists()).toBe(true);
    expect(row.props("players")).toEqual(players);
    expect(
      w.findAll("button").map((b) => b.attributes("aria-label"))
    ).toEqual(["Ana Petrova", "Boris"]);
  });

  it("HCARD-13: hovering an avatar opens the player details card", async () => {
    const w = mountWidget({
      info: { count: 2, max: 10, gathered: false },
      players,
    });
    await w.findAll("button")[1]!.trigger("mouseenter");
    expect(card()?.textContent).toContain("Boris");
  });

  it("HCARD-13: tapping an avatar opens the player details card", async () => {
    const w = mountWidget({
      info: { count: 2, max: 10, gathered: false },
      players,
    });
    await w.findAll("button")[0]!.trigger("click");
    expect(card()?.textContent).toContain("Ana Petrova");
  });

  it("HCARD-13: an empty slot says No players yet", () => {
    const w = mountWidget({
      info: { count: 0, max: 10, gathered: false },
      players: [],
    });
    expect(w.text()).toContain("No players yet");
  });
});
