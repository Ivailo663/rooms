import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import SlotAvatars from "./SlotAvatars.vue";

const players = [
  { id: 1, name: "Ana Petrova" },
  { id: 2, name: "Boris" },
];

const card = () => document.body.querySelector("[data-player-details-card]");

let wrapper: VueWrapper | undefined;

const mountAvatars = () => {
  wrapper = mount(SlotAvatars, {
    props: { players, currentUserId: 2 },
    attachTo: document.body,
  });
  return wrapper;
};

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("SlotAvatars details card", () => {
  it("CARD-24: every player avatar is a button labelled with the player's name", () => {
    const buttons = mountAvatars().findAll("button");
    expect(buttons.map((b) => b.attributes("aria-label"))).toEqual([
      "You",
      "Ana Petrova",
    ]);
    expect(buttons.every((b) => b.attributes("title") === undefined)).toBe(true);
  });

  it("PROF-05: tapping an avatar opens that player's card, tapping outside closes it", async () => {
    const w = mountAvatars();
    expect(card()).toBeNull();

    await w.findAll("button")[1]!.trigger("click");
    expect(card()?.textContent).toContain("Ana Petrova");

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await w.vm.$nextTick();
    expect(card()).toBeNull();
  });

  it("PROF-05: tapping another avatar moves the card to that player", async () => {
    const w = mountAvatars();
    const [me, ana] = w.findAll("button");

    await ana!.trigger("click");
    await me!.trigger("click");
    expect(card()?.textContent).toContain("Boris");
    expect(document.body.querySelectorAll("[data-player-details-card]")).toHaveLength(1);
  });

  it("CARD-12: a tap on an avatar doesn't reach the tile around it", async () => {
    let tileTapped = false;
    const host = document.createElement("div");
    host.addEventListener("click", () => (tileTapped = true));
    document.body.appendChild(host);
    wrapper = mount(SlotAvatars, { props: { players }, attachTo: host });

    await wrapper.find("button").trigger("click");
    expect(tileTapped).toBe(false);
    host.remove();
  });
});
