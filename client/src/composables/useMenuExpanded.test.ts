import { describe, it, expect } from "vitest";
import { menuStartsOpen } from "./useMenuExpanded";
import { RoomView } from "@/constants";

const DESKTOP = false;
const PHONE = true;

describe("menuStartsOpen", () => {
  it("NAV-01: on desktop, open in Host and collapsed in Play", () => {
    expect(menuStartsOpen(RoomView.Host, DESKTOP)).toBe(true);
    expect(menuStartsOpen(RoomView.Play, DESKTOP)).toBe(false);
  });

  it("NAV-02: on a phone, the drawer starts closed in every view, Host included", () => {
    expect(menuStartsOpen(RoomView.Host, PHONE)).toBe(false);
    expect(menuStartsOpen(RoomView.Play, PHONE)).toBe(false);
  });
});
