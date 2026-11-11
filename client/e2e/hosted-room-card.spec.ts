import { test, expect, type Page, type Locator } from "@playwright/test";

// Hosted room card: the status widget as a slot panel (HCARD-01..12).
//
// Every state here (live with a following slot, redistributed, failed, quorum)
// needs particular slots at particular times, and producing them for real would
// mean writing and scheduling rows in the shared live database. So the three
// GETs the card reads are stubbed and the browser clock is pinned. Nothing is
// written. A redistribution arrives over the socket, so it is injected straight
// into the app's own socket listener rather than sent by the server.

const SHOTS = process.env.QA_SHOTS_DIR;
const QA_W = Number(process.env.QA_W ?? 0);
if (QA_W) test.use({ viewport: { width: QA_W, height: 800 } });

// Tuesday 10 Nov 2026 — the stubs use "tu" as today.
const at = (h: number, m: number) => new Date(2026, 10, 10, h, m, 0);
const TODAY = "tu";

type Player = { id: number; name: string };
const P = (id: number, name: string): Player => ({ id, name });
const players = (n: number) =>
  Array.from({ length: n }, (_, i) => P(500 + i, `Player ${500 + i}`));

const slot = (
  id: number,
  hour: number,
  opts: {
    status?: string;
    players?: Player[];
    min?: number | null;
    max?: number;
    enabled?: boolean;
  } = {}
) => ({
  id,
  name: `${hour}:00`,
  message: null,
  price: null,
  label: `${String(hour).padStart(2, "0")}:00`,
  features: [],
  players: opts.players ?? [],
  pendingRequests: [],
  min_players: opts.min ?? null,
  max_players: opts.max ?? 10,
  day: TODAY,
  enabled: opts.enabled ?? true,
  status: opts.status ?? "scheduled",
  start_time: hour * 60,
});

type Scenario = {
  name: string;
  liveSlot?: unknown;
  pending?: number;
  today: unknown[];
  days?: unknown[];
  description?: string;
};

const ROOM_ID = 9301;

const stub = async (page: Page, s: Scenario) => {
  await page.route(/localhost:3000\/rooms\/hosted/, (route) =>
    route.fulfill({
      json: [
        {
          id: ROOM_ID,
          name: s.name,
          description: s.description ?? "QA fixture",
          price: 5,
          address: "QA fixture",
          liveSlot: s.liveSlot ?? null,
          pendingRequestCount: s.pending ?? 0,
        },
      ],
    })
  );
  await page.route(/localhost:3000\/timeslots\?/, (route) =>
    route.fulfill({ json: s.today })
  );
  await page.route(/localhost:3000\/timeslots\/enabled\/days/, (route) =>
    route.fulfill({ json: s.days ?? [] })
  );
  await page.route(/localhost:3000\/timeslots\/pending-days/, (route) =>
    route.fulfill({ json: [] })
  );
};

const open = async (page: Page, s: Scenario, now: Date) => {
  await page.clock.setFixedTime(now);
  await stub(page, s);
  await page.goto("/");
  const card = page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("heading", { name: s.name }) });
  await expect(card).toBeVisible();
  // Host view opens the nav drawer by default, which overlays a phone screen.
  const closeMenu = page.getByRole("button", { name: "Close menu" });
  if (await closeMenu.isVisible()) {
    await closeMenu.click();
    await expect(page.locator(".fixed.inset-0.z-40")).toHaveCount(0);
    await page.waitForTimeout(500); // sidebar width transition is 300ms
  }
  return card;
};

const panelOf = (card: Locator) =>
  card.locator("section:has([data-panel-header])");

const shot = async (card: Locator, name: string) => {
  if (!SHOTS) return;
  const project = test.info().project.name + (QA_W ? `-${QA_W}` : "");
  await card.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
};

// HCARD-08 + no sideways scroll on the page.
const assertSingleColumn = async (page: Page, card: Locator) => {
  const panel = panelOf(card);
  const body = panel.locator("[data-panel-body]");
  const children = body.locator(":scope > *");
  const n = await children.count();
  const bodyBox = (await body.boundingBox())!;
  for (let i = 0; i < n; i++) {
    const b = (await children.nth(i).boundingBox())!;
    // full width of the body, minus its 12px side padding
    expect(Math.abs(b.width - (bodyBox.width - 24))).toBeLessThan(2);
  }
  expect(await card.locator(".grid").count()).toBe(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

const gradientOf = (panel: Locator) =>
  panel
    .locator("[data-panel-header]")
    .evaluate((el) => getComputedStyle(el).backgroundImage);

const borderOf = (el: Locator) =>
  el.evaluate((e) => getComputedStyle(e).borderTopColor);

test("HCARD-01..04, 08: scheduled today, panel wraps players, quorum stays emerald", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Sched Quorum",
      today: [
        slot(9401, 20, {
          players: [P(11, "Alice Quorum"), P(12, "Bob"), ...players(3)],
          min: 4,
        }),
      ],
    },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(panel.getByText("20:00")).toBeVisible();
  await expect(panel.getByText("in 1h30m")).toBeVisible();
  await expect(panel.locator("[data-panel-header]").getByText("Today")).toBeVisible();

  // HCARD-01: players widget inside the panel body, below the header
  const playersLabel = panel.locator("[data-panel-body]").getByText("Players", { exact: true });
  await expect(playersLabel).toBeVisible();
  const hb = (await panel.locator("[data-panel-header]").boundingBox())!;
  const pb = (await playersLabel.boundingBox())!;
  expect(pb.y).toBeGreaterThan(hb.y + hb.height - 1);

  // HCARD-02/03
  console.log("scheduled gradient:", await gradientOf(panel));
  console.log("scheduled border:", await borderOf(panel));

  // HCARD-04: quorum widget emerald inside amber panel
  const widget = panel.locator("[data-panel-body] > div").first();
  console.log("quorum widget border:", await borderOf(widget));
  await expect(widget).toHaveClass(/border-emerald-300/);
  await expect(panel).toHaveClass(/border-amber-100/);

  await assertSingleColumn(page, card);
  await shot(card, "scheduled-today-quorum");

  // HCARD-13 / PROF-04: avatar details card opens, not clipped
  const avatar = panel.getByRole("button", { name: "Alice Quorum" });
  if (test.info().project.name === "mobile") await avatar.tap();
  else await avatar.hover();
  const details = page.locator("[data-player-details-card]");
  await expect(details).toBeVisible();
  await expect(details.getByText("Alice Quorum")).toBeVisible();
  const db = (await details.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(db.x).toBeGreaterThanOrEqual(0);
  expect(db.y).toBeGreaterThanOrEqual(0);
  expect(db.x + db.width).toBeLessThanOrEqual(vp.width);
  expect(db.y + db.height).toBeLessThanOrEqual(vp.height);
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/${test.info().project.name}${QA_W ? `-${QA_W}` : ""}-details-card.png`,
    });
});

test("PROF-01: a player in the Manage drawer's slot monitor opens the details card above the drawer", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Monitor Details",
      today: [slot(9405, 20, { players: [P(21, "Dana Monitor")], min: 4 })],
    },
    at(18, 30)
  );
  await card.getByRole("button", { name: "Manage" }).click();
  const drawer = page.locator(".p-drawer");
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(700); // let the slide-in finish

  const entry = drawer.getByRole("button", { name: "Dana Monitor" });
  if (test.info().project.name === "mobile") await entry.tap();
  else await entry.hover();
  const details = page.locator("[data-player-details-card]");
  await expect(details).toBeVisible();
  await expect(details.getByText("Dana Monitor")).toBeVisible();

  // Above the drawer, not behind it: the card's centre is the topmost element.
  const onTop = await details.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2
    );
    return !!hit && el.contains(hit);
  });
  expect(onTop).toBe(true);
});

test("HCARD-01, HCARD-14: scheduled on a later day draws its players as named avatars", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Sched Later",
      today: [],
      days: [
        {
          day: "fr",
          label: "19:00",
          timeslotId: 9402,
          players_count: 2,
          players: [P(601, "Dana Later"), P(602, "Emil Later")],
          min_players: 6,
          max_players: 12,
        },
      ],
    },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(panel.getByText("19:00")).toBeVisible();
  await expect(panel.getByText("Friday")).toBeVisible();
  await expect(panel.getByText("2/12")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Dana Later" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Emil Later" })).toBeVisible();
  await assertSingleColumn(page, card);
  await shot(card, "scheduled-later-day");
});

test("HCARD-07: live with a following slot, Next hint is the last line in the panel", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Live",
      liveSlot: {
        id: 9410,
        label: "18:00",
        start_time: 18 * 60,
        players_count: 8,
        players: players(8),
        max_players: 10,
        day: TODAY,
      },
      today: [
        slot(9410, 18, { status: "live", players: players(8) }),
        slot(9411, 19, { players: players(2), min: 6 }),
      ],
    },
    at(18, 20)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Live")).toBeVisible();
  await expect(panel.getByText("20'")).toBeVisible();
  // HCARD-14: the live slot's players are named avatars too
  await expect(panel.getByRole("button", { name: "Player 500" })).toBeVisible();
  const hint = panel.locator("[data-panel-hint]");
  await expect(hint).toHaveText("Next: Today at 19:00");
  await expect(panel.locator("[data-panel-header]")).not.toContainText("Next:");
  // last child of the body
  const lastText = await panel
    .locator("[data-panel-body] > *")
    .last()
    .textContent();
  expect(lastText?.trim()).toBe("Next: Today at 19:00");
  console.log("live gradient:", await gradientOf(panel));
  await assertSingleColumn(page, card);
  await shot(card, "live-with-next");
});

test("HCARD-07: live with nothing after it shows no hint", async ({ page }) => {
  const card = await open(
    page,
    {
      name: "QA Live Last",
      liveSlot: {
        id: 9412,
        label: "18:00",
        start_time: 18 * 60,
        players_count: 4,
        players: players(4),
        max_players: 10,
        day: TODAY,
      },
      today: [slot(9412, 18, { status: "live", players: players(4) })],
      days: [],
    },
    at(18, 20)
  );
  const panel = panelOf(card);
  await expect(panel.locator("[data-panel-hint]")).toHaveCount(0);
  await expect(panel).not.toContainText("Next:");
  await shot(card, "live-last");
});

test("HCARD-05/HCARD-11: redistributed, panel stays scheduled, notices inside below players, dismissible", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Redistributed",
      today: [slot(9420, 20, { players: players(7), min: 6 })],
    },
    at(18, 30)
  );
  const n = await page.evaluate(async () => {
    const m = await import("/src/socket.ts");
    const fns = m.socket.listeners("timeslot-redistributed");
    const send = (destinations: unknown[]) =>
      fns.forEach((f: (p: unknown) => void) =>
        f({ timeslotId: 9420, roomId: 9301, destinations })
      );
    send([
      { timeslotId: 1, roomId: 1, roomName: "Elsewhere Arena", label: "19:00", playerCount: 3 },
      { timeslotId: 2, roomId: 1, roomName: "Second Pitch", label: "18:00", playerCount: 1 },
    ]);
    send([{ timeslotId: 3, roomId: 1, roomName: "Third Ground", label: "21:00", playerCount: 2 }]);
    // an unrelated room's slot must not reach this card
    fns.forEach((f: (p: unknown) => void) =>
      f({ timeslotId: 777777, roomId: 1, destinations: [] })
    );
    return fns.length;
  });
  expect(n).toBeGreaterThan(0);
  const panel = panelOf(card);
  await expect(panel.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(panel).toHaveClass(/border-amber-100/);
  const notices = panel.locator("[data-panel-body]").getByText("Players redistributed");
  await expect(notices).toHaveCount(2);
  const pb = (await panel.locator("[data-panel-body]").getByText("Players", { exact: true }).boundingBox())!;
  const nb = (await notices.first().boundingBox())!;
  expect(nb.y).toBeGreaterThan(pb.y);
  console.log("redistributed gradient:", await gradientOf(panel));
  await assertSingleColumn(page, card);
  await shot(card, "redistributed");

  await panel.locator("button:has(.fa-xmark)").first().click();
  await expect(notices).toHaveCount(1);
  await expect(panel.getByText("Elsewhere Arena")).toHaveCount(0);
  await expect(panel.getByText("Third Ground")).toBeVisible();
  await panel.locator("button:has(.fa-xmark)").first().click();
  await expect(notices).toHaveCount(0);
  await shot(card, "redistributed-dismissed");
});

test("HCARD-06: failed earlier today, later slot scheduled, notice below the panel", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Failed Earlier",
      today: [
        slot(9430, 18, { status: "failed", players: players(2), min: 6 }),
        slot(9431, 20, { players: players(1), min: 6 }),
      ],
    },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(panel.getByText("20:00")).toBeVisible();
  const notice = card.getByText("Not enough players");
  await expect(notice).toBeVisible();
  expect(await panel.getByText("Not enough players").count()).toBe(0);
  const panelBox = (await panel.boundingBox())!;
  const nb = (await notice.boundingBox())!;
  expect(nb.y).toBeGreaterThan(panelBox.y + panelBox.height);
  await assertSingleColumn(page, card);
  await shot(card, "failed-earlier-sched-later");
});

test("HCARD-12: failed slot with nothing upcoming, panel inactive, notice still below", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Failed Day",
      today: [slot(9440, 18, { status: "failed", players: players(2), min: 6 })],
      days: [],
    },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("No slots")).toBeVisible();
  await expect(panel).not.toContainText("Didn't run");
  await expect(panel).toHaveClass(/border-surface-100/);
  const notice = card.getByText("Not enough players");
  await expect(notice).toBeVisible();
  const panelBox = (await panel.boundingBox())!;
  expect((await notice.boundingBox())!.y).toBeGreaterThan(
    panelBox.y + panelBox.height
  );
  await shot(card, "failed-nothing-upcoming");
});

test("HCARD-10: failed weekly slot, panel moves on to next week, notice below", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Failed Realistic",
      today: [slot(9450, 18, { status: "failed", players: players(2), min: 6 })],
      days: [
        {
          day: TODAY,
          label: "18:00",
          timeslotId: 9450,
          players_count: 2,
          players: players(2),
          min_players: 6,
          max_players: 10,
        },
      ],
    },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(panel.getByText("18:00")).toBeVisible();
  await expect(panel).toHaveClass(/border-amber-100/);
  const notice = card.getByText("Not enough players");
  await expect(notice).toBeVisible();
  expect(await panel.getByText("Not enough players").count()).toBe(0);
  await shot(card, "failed-realistic");
});

test("HCARD-09: inactive shows players widget with a dash", async ({ page }) => {
  const card = await open(
    page,
    { name: "QA Inactive", today: [], days: [] },
    at(18, 30)
  );
  const panel = panelOf(card);
  await expect(panel.getByText("Offline")).toBeVisible();
  await expect(panel.getByText("No slots")).toBeVisible();
  const body = panel.locator("[data-panel-body]");
  await expect(body.getByText("Players", { exact: true })).toBeVisible();
  await expect(body.getByText("—")).toBeVisible();
  console.log("inactive border:", await borderOf(panel));
  console.log("inactive widget border:", await borderOf(body.locator("> div").first()));
  console.log("inactive gradient:", await gradientOf(panel));
  await assertSingleColumn(page, card);
  await shot(card, "inactive");
});

test("regressions: pending pill and Manage open the drawer, chat toggles", async ({
  page,
}) => {
  const card = await open(
    page,
    {
      name: "QA Regressions",
      pending: 3,
      description:
        "A deliberately long description to check that the header truncates at phone width",
      today: [slot(9460, 20, { players: players(3), min: 6 })],
    },
    at(18, 30)
  );
  await expect(card.getByRole("button", { name: /3 requests/ })).toBeVisible();
  await assertSingleColumn(page, card);
  await shot(card, "regressions-header");

  await card.locator("button:has(.fa-comment)").click();
  await shot(card, "chat-open");
  const chatPanel = card.locator("div.border-t").filter({ hasNot: page.getByText("Manage") }).first();
  await expect(chatPanel).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await card.locator("button:has(.fa-comment)").click();

  await card.getByRole("button", { name: /3 requests/ }).click();
  const drawer = page.locator(".p-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("QA Regressions");
  await page.waitForTimeout(700); // let the slide-in finish before measuring
  const dbox = (await drawer.boundingBox())!;
  expect(dbox.x + dbox.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/${test.info().project.name}${QA_W ? `-${QA_W}` : ""}-drawer.png`,
    });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  await card.getByRole("button", { name: "Manage" }).click();
  await expect(drawer).toBeVisible();
});
