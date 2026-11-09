import { test, expect, type Page } from "@playwright/test";

// Playable-room card: status pill, time-chip strip, flat roster.
//
// Rendering states (big squads, long/unnamed players, pending, declined, a slot
// far down the strip) don't exist in the shared live data, and creating them
// would mean writing other tenants' rows. So those tests stub the two GET
// endpoints the deck reads. One test at the bottom joins and leaves a real
// future slot and cleans up after itself.

const ME = 2; // the e2e account's id — the stubs need it to mark "me"

type Player = { id: number; email: string; name: string | null };

const player = (id: number, name: string | null): Player => ({
  id,
  email: `p${id}@example.invalid`,
  name,
});

const slot = (
  id: number,
  hour: number,
  max: number,
  players: Player[],
  request: "pending" | "denied" | null = null
) => ({
  id,
  name: `${hour}:00`,
  message: null,
  price: null,
  label: `${String(hour).padStart(2, "0")}:00`,
  features: [],
  playersCount: players.length,
  max_players: max,
  status: "scheduled",
  day: "su",
  start_time: hour * 60,
  players,
  requestStatusForCurrentUser: request,
});

const room = (id: number, name: string, timeslots: unknown[]) => ({
  id,
  name,
  description: null,
  price: null,
  address: "QA fixture",
  deniedMessage: "QA denied message",
  lateJoinCutoff: 0,
  allowJoinOnLive: false,
  timeslots,
});

const many = (n: number, from = 100) =>
  Array.from({ length: n }, (_, i) => player(from + i, `Player ${from + i}`));

// Room 1: twelve slots, the user's seat on the 11th, a big squad in it.
const bigSquad = [
  player(50, "Aleksandar Konstantinov-Vasilev the Unreasonably Long Named"),
  player(51, null),
  player(52, "   "),
  ...many(15),
  player(ME, "Johny"),
];
const FIXTURE = [
  room(
    9001,
    "QA Far Joined",
    Array.from({ length: 12 }, (_, i) =>
      i === 10
        ? slot(9100 + i, 6 + i, 22, bigSquad)
        : slot(9100 + i, 6 + i, 10, many(i % 4))
    )
  ),
  room(9002, "QA Pending", [
    slot(9200, 9, 10, many(2)),
    slot(9201, 10, 10, many(10)),
    slot(9202, 11, 20, many(2), "pending"),
  ]),
  room(9003, "QA No Slots", []),
  room(9004, "QA Declined", [
    slot(9400, 12, 8, [], "denied"),
    slot(9401, 13, 9, []),
  ]),
  room(9005, "QA Joined And Pending", [
    slot(9500, 14, 10, [player(ME, "Johny")]),
    slot(9501, 15, 10, [], "pending"),
  ]),
];

const stub = async (page: Page) => {
  await page.route(/localhost:3000\/rooms\/playable/, (r) =>
    r.fulfill({ json: FIXTURE })
  );
  // Empty so the deck shows instead of the match hub.
  await page.route(/localhost:3000\/timeslots\/joined/, (r) =>
    r.fulfill({ json: [] })
  );
};

const openPlay = async (page: Page, isMobile: boolean) => {
  await page.goto("/");
  await page.getByText("Play", { exact: true }).click();
  if (isMobile) await page.getByRole("button", { name: "Close menu" }).click();
  await expect(page.locator(".deck-scroll")).toBeVisible();
};

const card = (page: Page, name: string) =>
  page.locator(".deck-item").filter({ has: page.getByRole("heading", { name }) });

const scrollDeckTo = async (page: Page, index: number) => {
  await page.locator(".deck-scroll").evaluate((deck, i) => {
    const item = deck.querySelectorAll<HTMLElement>(".deck-item")[i];
    deck.scrollTo({ top: item.offsetTop, behavior: "instant" });
  }, index);
  await page.waitForTimeout(300);
};

test.describe("stubbed states", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await stub(page);
    await openPlay(page, isMobile);
  });

  test("CARD-03: pill is centred on the top edge and unclipped on every snapped card", async ({
    page,
  }, info) => {
    const results: string[] = [];
    for (const [i, name] of [
      [0, "QA Far Joined"],
      [1, "QA Pending"],
      [4, "QA Joined And Pending"],
    ] as const) {
      await scrollDeckTo(page, i);
      const geo = await card(page, name).evaluate((item) => {
        const deck = item.closest(".deck-scroll")!.getBoundingClientRect();
        const pill = item.querySelector("span.absolute")!.getBoundingClientRect();
        const body = item.querySelector(".room-card")!.getBoundingClientRect();
        return { deck: deck.top, pillTop: pill.top, pillBottom: pill.bottom,
          pillCx: (pill.left + pill.right) / 2, pillCy: (pill.top + pill.bottom) / 2,
          bodyCx: (body.left + body.right) / 2, bodyTop: body.top, bodyBottom: body.bottom,
          deckBottom: item.closest(".deck-scroll")!.getBoundingClientRect().bottom };
      });
      results.push(`${name}: ${JSON.stringify(geo)}`);
      await page.screenshot({ path: info.outputPath(`pill-${i}.png`) });
      expect(Math.abs(geo.pillCx - geo.bodyCx), name).toBeLessThan(1.5);
      expect(Math.abs(geo.pillCy - geo.bodyTop), name).toBeLessThan(1.5);
      expect(geo.pillTop, `${name} pill clipped by deck`).toBeGreaterThanOrEqual(geo.deck);
    }
    console.log(results.join("\n"));
    await expect(card(page, "QA Joined And Pending").getByText("You're in")).toBeVisible();
    await expect(card(page, "QA Joined And Pending").getByText("Requested")).toHaveCount(0);
    await expect(card(page, "QA Pending").getByText("Requested")).toBeVisible();
  });

  test("CARD-14: joined slot far down the strip is selected and centred on load", async ({
    page,
  }) => {
    const c = card(page, "QA Far Joined");
    const chips = c.getByRole("group", { name: "Time slots" }).getByRole("button");
    await expect(chips).toHaveCount(12);
    await expect(chips.nth(10)).toHaveAttribute("aria-pressed", "true");
    const geo = await c.getByRole("group", { name: "Time slots" }).evaluate((strip) => {
      const s = strip.getBoundingClientRect();
      const chip = strip.children[10].getBoundingClientRect();
      return { stripL: s.left, stripR: s.right, chipL: chip.left, chipR: chip.right,
        off: (chip.left + chip.right) / 2 - (s.left + s.right) / 2,
        scrollLeft: strip.scrollLeft, max: strip.scrollWidth - strip.clientWidth };
    });
    console.log("centre geometry", JSON.stringify(geo));
    expect(geo.chipL).toBeGreaterThanOrEqual(geo.stripL - 0.5);
    expect(geo.chipR).toBeLessThanOrEqual(geo.stripR + 0.5);
    // Centred, unless the strip is already at its scroll end.
    if (geo.scrollLeft < geo.max - 1) expect(Math.abs(geo.off)).toBeLessThan(8);
  });

  test("CARD-14: pending room lands on the pending slot; plain room lands on the first", async ({
    page,
  }) => {
    const p = card(page, "QA Pending").getByRole("group", { name: "Time slots" }).getByRole("button");
    await expect(p.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, "QA Pending").getByRole("button", { name: "Awaiting approval" })).toBeVisible();
    const d = card(page, "QA Declined").getByRole("group", { name: "Time slots" }).getByRole("button");
    await expect(d.nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("selected chip tint and marker dots", async ({ page }) => {
    const c = card(page, "QA Far Joined");
    const colours = await c.getByRole("group", { name: "Time slots" }).evaluate((strip) => {
      const chip = strip.children[10] as HTMLElement;
      const dot = chip.querySelector("span.absolute") as HTMLElement;
      return { chipBg: getComputedStyle(chip).backgroundColor,
        dotBg: dot && getComputedStyle(dot).backgroundColor,
        dotSize: dot && dot.getBoundingClientRect().width };
    });
    console.log("selected chip", JSON.stringify(colours));
    expect(colours.dotBg).toBeTruthy();
  });

  test("roster header, ordering, labels and truncation", async ({ page }, info) => {
    const c = card(page, "QA Far Joined");
    const roster = c.getByRole("region", { name: "Players" });
    await expect(roster).toContainText("19 of 22 players");
    await expect(roster).toContainText("3 open");
    const items = roster.getByRole("listitem");
    await expect(items.first()).toHaveText(/You/);
    await expect(roster.getByText("Player", { exact: true })).toHaveCount(2);
    const overflow = await roster.locator("li").evaluateAll((lis) =>
      lis.map((li) => {
        const ul = li.parentElement!.getBoundingClientRect();
        const r = li.getBoundingClientRect();
        const label = li.querySelector(".truncate") as HTMLElement | null;
        return { text: li.textContent?.trim(), outside: r.right > ul.right + 0.5,
          truncated: label ? label.scrollWidth > label.clientWidth : false };
      })
    );
    const long = overflow.find((o) => o.text?.includes("Konstantinov"));
    console.log("long chip", JSON.stringify(long));
    expect(long?.outside).toBe(false);
    expect(long?.truncated).toBe(true);
    await c.screenshot({ path: info.outputPath("roster.png") });
  });

  test("open-spot placeholders: 8 shown, 9+ collapse, full squad", async ({ page }) => {
    // 18 open -> collapsed
    const p = card(page, "QA Pending");
    await expect(p.getByText("+18 open")).toBeVisible();
    // 10 of 10 -> Full squad
    await p.getByRole("group", { name: "Time slots" }).getByRole("button").nth(1).click();
    await expect(p.getByRole("region", { name: "Players" })).toContainText("Full squad");
    await expect(p.getByRole("region", { name: "Players" })).toContainText("10 of 10 players");
    // 8 open -> 8 dashed placeholders; 9 open -> "+9 open"
    const d = card(page, "QA Declined");
    await expect(d.getByRole("region", { name: "Players" }).locator("li.border-dashed")).toHaveCount(8);
    await expect(d.getByRole("button", { name: "Not accepted for this slot" })).toBeVisible();
    await expect(d.getByText("QA denied message")).toBeVisible();
    await d.getByRole("group", { name: "Time slots" }).getByRole("button").nth(1).click();
    await expect(d.getByText("+9 open")).toBeVisible();
    await expect(d.getByRole("region", { name: "Players" }).locator("li.border-dashed")).toHaveCount(1);
  });

  test("room with no slots", async ({ page }) => {
    await expect(card(page, "QA No Slots").getByText("No time slots")).toBeVisible();
  });

  test("big squad scrolls inside the card, not the deck (wheel)", async ({ page }) => {
    const c = card(page, "QA Far Joined");
    const list = c.getByRole("region", { name: "Players" }).getByRole("list");
    const dims = await list.evaluate((ul) => ({ sh: ul.scrollHeight, ch: ul.clientHeight }));
    console.log("roster list dims", JSON.stringify(dims));
    test.skip(dims.sh <= dims.ch, "roster fits at this viewport, nothing to scroll");
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(400);
    const after1 = await page.evaluate(() => ({
      deck: document.querySelector(".deck-scroll")!.scrollTop,
      list: document.querySelector(".deck-item ul")!.scrollTop }));
    // Keep wheeling past the end of the list.
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 200);
    await page.waitForTimeout(800);
    const after2 = await page.evaluate(() => ({
      deck: document.querySelector(".deck-scroll")!.scrollTop,
      list: document.querySelector(".deck-item ul")!.scrollTop }));
    console.log("wheel", JSON.stringify({ after1, after2 }));
    expect(after1.list).toBeGreaterThan(0);
    expect(after1.deck).toBe(0);
    expect(after2.deck, "deck moved after list hit its end (scroll chaining)").toBe(0);
  });
});

test.describe("touch", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch only");
    await stub(page);
    await openPlay(page, isMobile);
  });

  const drag = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const cdp = await page.context().newCDPSession(page);
    const steps = 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(600);
  };

  const state = (page: Page) =>
    page.evaluate(() => ({
      deck: document.querySelector(".deck-scroll")!.scrollTop,
      winX: window.scrollX,
      strip: document.querySelector<HTMLElement>(".slot-strip")!.scrollLeft,
      list: document.querySelector(".deck-item ul")!.scrollTop,
      drawer: !!document.querySelector('[aria-label="Close menu"]'),
    }));

  test("CARD-13: swiping the chips scrolls only the strip and never opens the drawer", async ({ page }) => {
    const strip = card(page, "QA Far Joined").getByRole("group", { name: "Time slots" });
    const b = (await strip.boundingBox())!;
    const y = b.y + b.height / 2;
    const before = await state(page);
    // Rightward drag starting at the strip's left edge (inside the 28px edge zone).
    await drag(page, { x: b.x + 2, y }, { x: b.x + 250, y });
    const right = await state(page);
    // Leftward drag back.
    await drag(page, { x: b.x + 250, y }, { x: b.x + 20, y });
    const left = await state(page);
    console.log("touch chips", JSON.stringify({ before, right, left }));
    expect(right.drawer, "drawer opened by a chip swipe").toBe(false);
    expect(right.strip).toBeLessThan(before.strip);
    expect(left.strip).toBeGreaterThan(right.strip);
    expect(left.deck).toBe(before.deck);
    expect(left.winX).toBe(0);
  });

  test("edge swipe outside the chips still opens the drawer", async ({ page }) => {
    const vp = page.viewportSize()!;
    await drag(page, { x: 4, y: vp.height - 120 }, { x: 200, y: vp.height - 120 });
    expect((await state(page)).drawer).toBe(true);
  });

  test("big squad touch-scrolls inside the card without dragging the deck", async ({ page }) => {
    const list = card(page, "QA Far Joined").getByRole("region", { name: "Players" }).getByRole("list");
    const dims = await list.evaluate((ul) => ({ sh: ul.scrollHeight, ch: ul.clientHeight }));
    test.skip(dims.sh <= dims.ch, "roster fits, nothing to scroll");
    const b = (await list.boundingBox())!;
    const x = b.x + b.width / 2;
    await drag(page, { x, y: b.y + b.height - 5 }, { x, y: b.y + 5 });
    const s1 = await state(page);
    await drag(page, { x, y: b.y + b.height - 5 }, { x, y: b.y + 5 });
    await drag(page, { x, y: b.y + b.height - 5 }, { x, y: b.y + 5 });
    const s2 = await state(page);
    console.log("touch roster", JSON.stringify({ dims, s1, s2 }));
    expect(s1.list).toBeGreaterThan(0);
    expect(s1.deck).toBe(0);
    expect(s2.deck, "deck moved once roster hit its end").toBe(0);
  });
});

// Real data. Joins a future slot nobody is in, checks the roster, leaves.
test("join and leave a real slot update the roster", async ({ page, isMobile }, info) => {
  test.skip(info.project.name !== "chromium", "one real write per run");
  const DAY = "Tuesday";
  await openPlay(page, isMobile);
  await page.getByRole("button", { name: DAY }).click();
  const c = card(page, "Playground 1");
  await c.getByRole("group", { name: "Time slots" }).getByRole("button", { name: /^14:00/ }).click();
  const roster = c.getByRole("region", { name: "Players" });
  await expect(roster).toContainText("0 of 10 players");
  try {
    await c.getByRole("button", { name: "Join game" }).click();
    // A confirmed join hands the screen to the match hub.
    await page.getByRole("button", { name: /Find another game/ }).click();
    await page.getByRole("button", { name: DAY }).click();
    await expect(roster).toContainText("1 of 10 players");
    await expect(roster.getByRole("listitem").first()).toHaveText(/You/);
    await expect(c.getByText("You're in")).toBeVisible();
    await expect(c.getByRole("group", { name: "Time slots" }).getByRole("button", { name: /14:00.*you're in/ })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: info.outputPath("joined.png") });
  } finally {
    const leave = c.getByRole("button", { name: "Leave game" });
    if (await leave.isVisible().catch(() => false)) await leave.click();
  }
  await expect(roster).toContainText("0 of 10 players");
  await expect(c.getByText("You're in")).toHaveCount(0);
});
