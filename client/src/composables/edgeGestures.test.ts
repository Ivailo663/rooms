import { describe, it, expect, vi, afterEach } from "vitest";
import {
  EDGE_ZONE,
  backSwipeCanStart,
  drawerSwipeCanStart,
  hasInAppHistory,
  isStandalone,
} from "./edgeGestures";

const PHONE = 390;

const stubDisplayMode = (standalone: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: standalone && query === "(display-mode: standalone)",
  }));

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
  window.history.replaceState(null, "");
});

describe("drawerSwipeCanStart", () => {
  it("NAV-10: closed, only a touch on the right edge can open the drawer", () => {
    expect(drawerSwipeCanStart(PHONE - 1, PHONE, false)).toBe(true);
    expect(drawerSwipeCanStart(PHONE - EDGE_ZONE, PHONE, false)).toBe(true);
    expect(drawerSwipeCanStart(PHONE - EDGE_ZONE - 1, PHONE, false)).toBe(
      false
    );
    expect(drawerSwipeCanStart(PHONE / 2, PHONE, false)).toBe(false);
    expect(drawerSwipeCanStart(4, PHONE, false)).toBe(false);
  });

  it("NAV-10: open, a swipe anywhere across the full-screen drawer counts", () => {
    expect(drawerSwipeCanStart(4, PHONE, true)).toBe(true);
    expect(drawerSwipeCanStart(PHONE / 2, PHONE, true)).toBe(true);
  });
});

describe("backSwipeCanStart", () => {
  it("NAV-11: only a touch on the left edge can go back", () => {
    expect(backSwipeCanStart(0)).toBe(true);
    expect(backSwipeCanStart(EDGE_ZONE)).toBe(true);
    expect(backSwipeCanStart(EDGE_ZONE + 1)).toBe(false);
    expect(backSwipeCanStart(PHONE - 1)).toBe(false);
  });
});

describe("isStandalone", () => {
  it("NAV-11: false in a browser tab", () => {
    stubDisplayMode(false);
    expect(isStandalone()).toBe(false);
  });

  it("NAV-11: true when installed (display-mode: standalone)", () => {
    stubDisplayMode(true);
    expect(isStandalone()).toBe(true);
  });

  it("NAV-11: true on iOS home-screen apps (navigator.standalone)", () => {
    stubDisplayMode(false);
    (navigator as Navigator & { standalone?: boolean }).standalone = true;
    expect(isStandalone()).toBe(true);
  });
});

describe("hasInAppHistory", () => {
  it("NAV-11: false on the first page of a visit", () => {
    window.history.replaceState({ back: null }, "");
    expect(hasInAppHistory()).toBe(false);
    window.history.replaceState(null, "");
    expect(hasInAppHistory()).toBe(false);
  });

  it("NAV-11: true once the app has navigated", () => {
    window.history.replaceState({ back: "/" }, "");
    expect(hasInAppHistory()).toBe(true);
  });
});
