import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatusWidget, { type PanelStatus } from "./StatusWidget.vue";

const COLOURS: Record<PanelStatus, string> = {
  live: "emerald",
  scheduled: "amber",
  inactive: "surface",
};

describe("StatusWidget panel", () => {
  for (const [status, colour] of Object.entries(COLOURS)) {
    it(`HCARD-02: the ${status} header fades from ${colour}-50 to white`, () => {
      const header = mount(StatusWidget, {
        props: { status: status as PanelStatus, label: "18:00" },
      }).find("[data-panel-header]");
      expect(header.classes()).toEqual(
        expect.arrayContaining([
          "bg-linear-to-b",
          `from-${colour}-50`,
          "to-white",
        ])
      );
    });

    it(`HCARD-03: the ${status} panel has a ${colour}-100 border`, () => {
      const panel = mount(StatusWidget, {
        props: { status: status as PanelStatus, label: "18:00" },
      });
      expect(panel.classes()).toContain(`border-${colour}-100`);
    });
  }

  it("HCARD-02: the body under the header has no wash of its own", () => {
    const wrapper = mount(StatusWidget, {
      props: { status: "scheduled", label: "18:00" },
      slots: { default: "<div>players</div>" },
    });
    expect(wrapper.classes()).toContain("bg-white");
    const body = wrapper.find("[data-panel-body]");
    expect(body.classes().some((c) => c.startsWith("bg-"))).toBe(false);
  });

  it("HCARD-07: a live hint renders after the slotted widgets", () => {
    const wrapper = mount(StatusWidget, {
      props: { status: "live", label: "18:00", hint: "Next: Today at 20:00" },
      slots: { default: "<div data-widget>players</div>" },
    });
    const body = wrapper.find("[data-panel-body]").element;
    expect(body.firstElementChild!.matches("[data-widget]")).toBe(true);
    expect(body.lastElementChild!.textContent!.trim()).toBe(
      "Next: Today at 20:00"
    );
  });
});
