import { test, expect, type Locator, type Page } from "@playwright/test";

// Playable-room card: status pill, square slot picker, flat roster, hold-to-join.
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
  request: "pending" | "denied" | null = null,
  extra: { message?: string; features?: string[]; price?: number } = {}
) => ({
  id,
  name: `${hour}:00`,
  message: extra.message ?? null,
  price: extra.price ?? null,
  label: `${String(hour).padStart(2, "0")}:00`,
  features: extra.features ?? [],
  playersCount: players.length,
  max_players: max,
  status: "scheduled",
  day: "su",
  start_time: hour * 60,
  players,
  requestStatusForCurrentUser: request,
});

const room = (
  id: number,
  name: string,
  timeslots: unknown[],
  description: string | null = null
) => ({
  id,
  name,
  description,
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

// The worst card: a long description, a slot with every feature (its chips wrap
// to two rows on the tile) and a host message under the picker. Three action
// states, because a denial adds a note under the picker and awaiting swaps the
// tile's action line.
const LONG_DESCRIPTION =
  "Floodlit five-a-side pitch behind the old railway depot, with a covered bench area, a small kiosk and plenty of street parking after six in the evening, bring your own bibs.";
const CROWDED = {
  message: "Bring a white and a dark shirt, we split the teams on the pitch.",
  features: ["ball", "showers", "parking", "lights", "water"],
};
const crowdedSlots = (id: number, request: "pending" | "denied" | null) => [
  slot(id, 18, 10, many(4), request, CROWDED),
  slot(id + 1, 19, 10, many(7), null, CROWDED),
];
const CROWDED_ROOMS = [
  room(9006, "QA Crowded", crowdedSlots(9600, null), LONG_DESCRIPTION),
  room(9007, "QA Crowded Declined", crowdedSlots(9700, "denied"), LONG_DESCRIPTION),
  room(9008, "QA Crowded Awaiting", crowdedSlots(9800, "pending"), LONG_DESCRIPTION),
];
FIXTURE.push(...CROWDED_ROOMS);

// More icons than a phone's square tile can hold on one line (unknown names fall
// back to a generic icon), to force the wrap the five known features never need.
// Eight wrap to two rows at 320 and 375 and still fit the bigger 1280 tile.
const OVERFLOWING = Array.from({ length: 8 }, (_, i) => `extra${i}`);
FIXTURE.push(
  room(9009, "QA Many Features", [
    slot(9900, 18, 10, many(4), null, { features: OVERFLOWING }),
    slot(9901, 19, 10, many(7), null, { features: OVERFLOWING }),
  ])
);

// A joinable slot with a price, for the action line's "· 6€" (CARD-31).
FIXTURE.push(
  room(9010, "QA Priced", [slot(10000, 18, 10, many(3), null, { price: 6 })])
);

// One and two spots left, for CARD-19's amber.
FIXTURE.push(
  room(9011, "QA Few Spots", [
    slot(10100, 18, 10, many(9)),
    slot(10101, 19, 10, many(8)),
  ])
);

// The e2e account hasn't ticked the terms, which would put the gate over the
// deck. Patch the sign-in response rather than ticking: that writes to the
// shared database.
const skipTermsGate = async (page: Page) => {
  await page.route(/localhost:3000\/user$/, async (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    const res = await r.fetch();
    const body = await res.json().catch(() => ({}));
    await r.fulfill({
      response: res,
      json: { ...body, terms_accepted_at: new Date().toISOString() },
    });
  });
};

const stub = async (page: Page) => {
  await skipTermsGate(page);
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
  // The phone drawer starts closed, behind the grab pill (NAV-10).
  if (isMobile) {
    const open = page.getByRole("button", { name: "Open menu" });
    const close = page.getByRole("button", { name: "Close menu" });
    await expect(open.or(close)).toBeVisible();
    if (await open.isVisible()) await open.click();
  }
  await page.getByText("Play", { exact: true }).click();
  // Choosing a view may close the drawer by itself.
  if (isMobile) {
    const close = page.getByRole("button", { name: "Close menu" });
    await close.click({ timeout: 2000 }).catch(() => {});
  }
  await expect(page.locator(".deck-scroll")).toBeVisible();
};

const card = (page: Page, name: string) =>
  page.locator(".deck-item").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });

const scrollDeckTo = async (page: Page, index: number) => {
  await page.locator(".deck-scroll").evaluate((deck, i) => {
    const item = deck.querySelectorAll<HTMLElement>(".deck-item")[i];
    deck.scrollTo({ top: item.offsetTop, behavior: "instant" });
  }, index);
  await page.waitForTimeout(300);
};

const strip = (c: Locator) => c.getByRole("group", { name: "Time slots" });
// Tiles are plain role="group" containers (CARD-12), so a tile is found by its
// aria-label, never as a button.
const tiles = (c: Locator) => strip(c).getByRole("group");
// The centred tile's last line; side tiles keep theirs hidden.
const line = (c: Locator) => c.locator(".slot-hint:visible");

const currentIndex = (c: Locator) =>
  tiles(c).evaluateAll((els) =>
    els.findIndex((el) => el.getAttribute("aria-current") === "true")
  );

// Arrow keys on the strip (CARD-12), one step at a time: each press moves from
// the tile that is centred when it lands, so wait for the selection to follow.
const selectSlot = async (c: Locator, index: number) => {
  await strip(c).focus();
  for (let guard = 0; guard < 30; guard++) {
    const now = await currentIndex(c);
    if (now === index) return;
    await strip(c).press(now < index ? "ArrowRight" : "ArrowLeft");
    await expect.poll(() => currentIndex(c)).not.toBe(now);
  }
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
    await expect(tiles(c)).toHaveCount(12);
    await expect(tiles(c).nth(10)).toHaveAttribute("aria-current", "true");
    await expect(tiles(c).nth(10)).toHaveAccessibleName(/^16:00, 19 of 22 players, you're in$/);
    const geo = await strip(c).evaluate((el) => {
      const s = el.getBoundingClientRect();
      const tile = el.children[10].getBoundingClientRect();
      return { stripL: s.left, stripR: s.right, tileL: tile.left, tileR: tile.right,
        off: (tile.left + tile.right) / 2 - (s.left + s.right) / 2,
        scrollLeft: el.scrollLeft, max: el.scrollWidth - el.clientWidth };
    });
    console.log("centre geometry", JSON.stringify(geo));
    expect(geo.tileL).toBeGreaterThanOrEqual(geo.stripL - 0.5);
    expect(geo.tileR).toBeLessThanOrEqual(geo.stripR + 0.5);
    // Centred, unless the strip is already at its scroll end.
    if (geo.scrollLeft < geo.max - 1) expect(Math.abs(geo.off)).toBeLessThan(8);
  });

  test("CARD-14: pending room lands on the pending slot; plain room lands on the first", async ({
    page,
  }) => {
    const p = card(page, "QA Pending");
    await expect(tiles(p).nth(2)).toHaveAttribute("aria-current", "true");
    await expect(line(p)).toHaveText("Awaiting approval");
    const d = card(page, "QA Declined");
    await expect(tiles(d).nth(0)).toHaveAttribute("aria-current", "true");
  });

  test("CARD-04: the centred tile is a plain white card with a hairline, no glass; a 22-seat bar is continuous", async ({ page }) => {
    const c = card(page, "QA Far Joined");
    const found = await strip(c).evaluate((el) => {
      const cs = (node: Element) => getComputedStyle(node);
      const current = el.children[10] as HTMLElement;
      const neighbour = el.children[9] as HTMLElement;
      const dot = current.querySelector("span.absolute") as HTMLElement | null;
      return {
        currentBg: cs(current).backgroundColor,
        currentImage: cs(current).backgroundImage,
        currentBackdrop: cs(current).backdropFilter,
        currentBorder: cs(current).borderTopWidth,
        neighbourBg: cs(neighbour).backgroundColor,
        neighbourBorder: cs(neighbour).borderTopWidth,
        dotBg: dot && cs(dot).backgroundColor,
        segments: current.querySelectorAll("[data-seat-bar] [data-filled]").length,
      };
    });
    expect(found.currentBg).toBe("rgb(255, 255, 255)");
    expect(found.currentImage).toBe("none");
    expect(found.currentBackdrop).toBe("none");
    expect(found.neighbourBg).toBe("rgb(255, 255, 255)");
    expect(found.currentBorder).toBe("1px");
    expect(found.neighbourBorder).toBe("1px");
    expect(found.dotBg).toBeTruthy();
    // 22 seats is above 14, so the bar is continuous.
    expect(found.segments).toBe(0);
  });

  test("CARD-07: a football pattern sits behind the tiles, clear at the top and full strength by the picker", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(300);
      const c = card(page, "QA Crowded");
      await c.scrollIntoViewIfNeeded();
      const g = await c.evaluate((item) => {
        const pattern = item.querySelector<HTMLElement>(".card-pattern")!;
        const room = item.querySelector<HTMLElement>(".room-card")!;
        const body = item.querySelector<HTMLElement>("[data-card-body]")!;
        const style = getComputedStyle(pattern);
        const card = room.getBoundingClientRect();
        const pct = (y: number) => ((y - card.top) / card.height) * 100;
        const stops = (style.maskImage || style.webkitMaskImage).match(/(\d+(?:\.\d+)?)%/g)!.map(parseFloat);
        return {
          image: style.backgroundImage,
          opacity: parseFloat(style.opacity),
          pointer: style.pointerEvents,
          stops,
          titleBottom: pct(item.querySelector("h2")!.getBoundingClientRect().bottom),
          stripMiddle: pct(
            (() => {
              const r = item.querySelector(".slot-strip")!.getBoundingClientRect();
              return (r.top + r.bottom) / 2;
            })()
          ),
          behindBody: pattern.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
        };
      });
      const at = `at ${width}`;
      expect(g.image, at).toContain("svg+xml");
      expect(g.opacity, at).toBeGreaterThan(0.1);
      expect(g.opacity, at).toBeLessThan(0.16);
      expect(g.pointer, at).toBe("none");
      expect(g.behindBody, `tiles paint over the pattern ${at}`).toBeTruthy();
      // Mask: transparent from the top to stops[1], opaque from stops[2].
      const [clearUntil, fullFrom] = g.stops.slice(-2);
      expect(g.titleBottom, `title is on clear ground ${at}`).toBeLessThanOrEqual(clearUntil + 0.5);
      expect(g.stripMiddle, `picker is at full strength ${at}`).toBeGreaterThanOrEqual(fullFrom);
    }
  });

  test("CARD-10: tiles are perfect squares, centred vertically, at 320, 375 and 1280 wide", async ({ page }) => {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(300);
      const c = card(page, "QA Crowded");
      await c.scrollIntoViewIfNeeded();
      const g = await strip(c).evaluate((el) => {
        const s = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const content = s.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        return {
          content,
          stripW: el.clientWidth,
          tiles: Array.from(el.children).map((t) => {
            const r = t.getBoundingClientRect();
            return {
              w: (t as HTMLElement).offsetWidth,
              h: (t as HTMLElement).offsetHeight,
              dy: (r.top + r.bottom) / 2 - (s.top + s.bottom) / 2,
            };
          }),
        };
      });
      for (const t of g.tiles) {
        expect(Math.abs(t.w - t.h), `square at ${width}`).toBeLessThanOrEqual(1);
        expect(Math.abs(t.dy), `centred vertically at ${width}`).toBeLessThanOrEqual(1);
        // The smaller of 86% of the width and the picker's height.
        expect(t.w, `side at ${width}`).toBeLessThanOrEqual(Math.floor(Math.min(g.stripW * 0.86, g.content)) + 1);
        expect(t.w, `side at ${width}`).toBeGreaterThanOrEqual(Math.floor(Math.min(g.stripW * 0.86, g.content)) - 1);
      }
    }
  });

  test("CARD-10: the first and last squares centre, and a resize or rotation keeps the selected one centred", async ({ page }) => {
    const centredDx = (c: Locator, index: number) =>
      strip(c).evaluate((el, i) => {
        const s = el.getBoundingClientRect();
        const r = el.children[i].getBoundingClientRect();
        return (r.left + r.right) / 2 - (s.left + s.right) / 2;
      }, index);
    const c = card(page, "QA Crowded");
    await c.scrollIntoViewIfNeeded();
    await selectSlot(c, 1);
    await page.waitForTimeout(500);
    expect(Math.abs(await centredDx(c, 1)), "last tile centred").toBeLessThanOrEqual(2);
    await selectSlot(c, 0);
    await page.waitForTimeout(500);
    expect(Math.abs(await centredDx(c, 0)), "first tile centred").toBeLessThanOrEqual(2);

    // Rotation: a phone on its side, and back.
    const far = card(page, "QA Far Joined");
    for (const size of [{ width: 800, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(700);
      await far.scrollIntoViewIfNeeded();
      expect(await currentIndex(far), `still on slot 10 at ${size.width}x${size.height}`).toBe(10);
      expect(Math.abs(await centredDx(far, 10)), `centred at ${size.width}x${size.height}`).toBeLessThanOrEqual(2);
    }
  });

  test("CARD-18: at short heights no tile clips or scrolls vertically", async ({ page }) => {
    for (const height of [800, 640, 600, 540, 480]) {
      await page.setViewportSize({ width: 375, height });
      await page.waitForTimeout(300);
      const c = card(page, "QA Pending");
      await c.scrollIntoViewIfNeeded();
      const dims = await strip(c).evaluate((el) => ({
        step: (el as HTMLElement).dataset.step,
        stripScroll: el.scrollHeight,
        stripClient: el.clientHeight,
        tiles: Array.from(el.children).map((t) => ({
          scroll: t.scrollHeight,
          client: t.clientHeight,
        })),
      }));
      console.log(height, JSON.stringify(dims));
      expect(dims.stripScroll, `strip at ${height}`).toBeLessThanOrEqual(dims.stripClient);
      for (const t of dims.tiles) expect(t.scroll, `tile at ${height}`).toBeLessThanOrEqual(t.client);
    }
  });

  test("CARD-05/06/17/18: header and picker never overlap, and the picker stays inside the card, at any card height", async ({
    page,
  }, info) => {
    // 24 viewport sizes, three cards each, and the phone project is slower.
    test.setTimeout(300_000);
    const rows: string[] = [];
    // 1280 wide has the sm padding and larger title, the widest the header
    // gets; 320 is the narrowest phone, where the features wrap most.
    const sizes = [900, 800, 720, 640, 600, 540, 480, 420, 400, 360, 320].flatMap((height) => [
      { width: 320, height },
      { width: 375, height },
      { width: 1280, height },
    ]);
    for (const { width, height } of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      for (const name of ["QA Crowded", "QA Crowded Declined", "QA Crowded Awaiting"]) {
        const c = card(page, name);
        await c.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        const g = await c.evaluate((item) => {
          const room = item.querySelector<HTMLElement>(".room-card")!;
          const header = item.querySelector<HTMLElement>("[data-header]")!;
          const strip = item.querySelector<HTMLElement>(".slot-strip")!;
          // The card's content box: its bottom padding is where the picker must stop.
          const body = strip.closest<HTMLElement>("[data-card-body]")!;
          const bodyBottom = body.getBoundingClientRect().bottom - parseFloat(getComputedStyle(body).paddingBottom);
          const h = header.getBoundingClientRect();
          const s = strip.getBoundingClientRect();
          return {
            card: Math.round(room.getBoundingClientRect().height),
            step: room.dataset.headerStep,
            tileStep: strip.dataset.step,
            headerBottom: h.bottom,
            stripTop: s.top,
            stripBottom: s.bottom,
            stripHeight: Math.round(s.height),
            bodyBottom,
            note: !!strip.parentElement!.querySelector(":scope > p"),
            headerClipped: header.scrollHeight - header.clientHeight,
            headerNatural: header.scrollHeight,
            tilesClipped: Array.from(strip.children).some((t) => t.scrollHeight > t.clientHeight || t.scrollWidth > t.clientWidth),
            squares: Array.from(strip.children).every((t) => Math.abs((t as HTMLElement).offsetWidth - (t as HTMLElement).offsetHeight) <= 1),
            stripScrolls: strip.scrollHeight > strip.clientHeight,
            // Each tile's feature icons against its time text and its roster.
            featureClashes: Array.from(strip.children).flatMap((tile, i) => {
              const range = document.createRange();
              range.selectNodeContents(tile.querySelector("[data-time]")!);
              const text = range.getBoundingClientRect();
              const roster = tile.querySelector("[data-roster]")!.getBoundingClientRect();
              const chips = Array.from(tile.querySelectorAll("[data-features] > span")).map((c) => c.getBoundingClientRect());
              return chips.flatMap((ch) => [
                ...(ch.left < text.right && ch.right > text.left && ch.top < text.bottom && ch.bottom > text.top ? [`tile ${i} chip over time`] : []),
                ...(ch.bottom > roster.top ? [`tile ${i} chip over roster`] : []),
              ]);
            }),
            timeDx: Array.from(strip.children).map((tile) => {
              const range = document.createRange();
              range.selectNodeContents(tile.querySelector("[data-time]")!);
              const text = range.getBoundingClientRect();
              const t = tile.getBoundingClientRect();
              return Math.abs((text.left + text.right) / 2 - (t.left + t.right) / 2);
            }),
          };
        });
        rows.push(`${width}x${height} ${name}: ${JSON.stringify(g)}`);
        console.log(rows[rows.length - 1]);
        const at = `${name} at ${width}x${height} (card ${g.card}, ${g.step})`;
        expect(g.headerBottom, `header over picker, ${at}`).toBeLessThanOrEqual(g.stripTop + 0.5);
        expect(g.stripBottom, `picker past the card's bottom padding, ${at}`).toBeLessThanOrEqual(g.bodyBottom + 0.5);
        // The picker's floor (CARD-06) is the smallest square, 172px, plus the strip's 24px padding.
        expect(g.stripHeight, `picker below its floor, ${at}`).toBeGreaterThanOrEqual(195);
        // The steps are meant to make the header fit, so the clip is only a net.
        expect(g.headerClipped, `header clipped, ${at}`).toBeLessThanOrEqual(0);
        expect(g.tilesClipped, `tile clipped, ${at}`).toBe(false);
        expect(g.squares, `tile not square, ${at}`).toBe(true);
        expect(g.stripScrolls, `strip scrolls, ${at}`).toBe(false);
        expect(g.featureClashes, `features clash, ${at}`).toEqual([]);
        expect(Math.max(...g.timeDx), `time off-centre, ${at}`).toBeLessThanOrEqual(2);
        if (name === "QA Crowded" && width === 375 && [800, 480].includes(height)) {
          await c.screenshot({ path: info.outputPath(`crowded-${height}.png`) });
        }
      }
    }
    console.log(rows.join("\n"));
  });

  test("CARD-11/21/22/23: a tile carries its own roster: spots left, you first, named avatars, +N, no placeholders", async ({
    page,
  }, info) => {
    // Roomy tiles, so the avatar cap (CARD-17 tight) doesn't hide the names.
    await page.setViewportSize({ width: 390, height: 900 });
    const c = card(page, "QA Far Joined");
    await c.scrollIntoViewIfNeeded();
    const tile = tiles(c).nth(10);
    await expect(tile).toContainText("19 / 22 players");
    await expect(tile).toContainText("3 spots left");
    await expect(tile).toHaveAccessibleName(/19 of 22 players/);

    const avatars = tile.locator("ul").getByRole("button");
    await expect(avatars.first()).toHaveAccessibleName("You");
    await expect(tile.getByRole("button", { name: "Player", exact: true })).toHaveCount(2);
    await expect(tile.getByRole("button", { name: /^Aleksandar Konstantinov/ })).toBeVisible();

    // The overflow is a plain circle, not a button (CARD-24), and there is no
    // tooltip (CARD-23) or open-seat placeholder (CARD-22).
    const more = tile.getByLabel(/\d+ more players/);
    await expect(more).toBeVisible();
    expect(await more.evaluate((el) => el.tagName)).toBe("LI");
    await expect(tile.locator("[title]")).toHaveCount(0);
    await expect(c.locator(".border-dashed")).toHaveCount(0);
    await expect(c.getByRole("region", { name: "Players" })).toHaveCount(0);

    // Joined players only: nothing is drawn for the three open seats.
    const shown = await avatars.count();
    const hidden = Number((await more.textContent())!.replace(/\D/g, ""));
    expect(shown + hidden).toBe(19);
    await c.screenshot({ path: info.outputPath("roster.png") });
  });

  // Geometry of one tile's corner furniture, in viewport pixels. The time is
  // measured by its text range, not its box, which would span the whole row.
  const corner = (tile: Locator) =>
    tile.evaluate((el) => {
      const rect = (n: Element) => n.getBoundingClientRect();
      const time = el.querySelector<HTMLElement>("[data-time]")!;
      const range = document.createRange();
      range.selectNodeContents(time);
      const text = range.getBoundingClientRect();
      const t = rect(el);
      const feats = el.querySelector<HTMLElement>("[data-features]");
      const chips = feats ? Array.from(feats.children).map(rect) : [];
      const dot = el.querySelector<HTMLElement>("span.absolute.rounded-full:not([data-features])");
      const d = dot && rect(dot);
      const roster = el.querySelector<HTMLElement>("[data-roster]")!;
      const overlaps = chips.some(
        (c) => c.left < text.right && c.right > text.left && c.top < text.bottom && c.bottom > text.top
      );
      const rows = [...new Set(chips.map((c) => Math.round(c.top)))].sort((x, y) => x - y);
      return {
        timeDx: (text.left + text.right) / 2 - (t.left + t.right) / 2,
        overlaps,
        timeAboveRoster: text.bottom <= rect(roster).top,
        chipCount: chips.length,
        rowTops: rows,
        perRow: rows.map((r) => chips.filter((c) => Math.round(c.top) === r).length),
        rowLefts: rows.map((r) => Math.min(...chips.filter((c) => Math.round(c.top) === r).map((c) => c.left))),
        chipsLeft: chips.length ? Math.min(...chips.map((c) => c.left)) : 0,
        chipsRight: chips.length ? Math.max(...chips.map((c) => c.right)) : 0,
        chipsTop: chips.length ? Math.min(...chips.map((c) => c.top)) : 0,
        tile: { left: t.left, right: t.right, top: t.top, width: t.width },
        dot: d && { left: d.left, top: d.top },
        labelsHidden: feats
          ? Array.from(feats.querySelectorAll(".sr-only")).every((n) => rect(n).width <= 1)
          : true,
        chipBg: feats ? getComputedStyle(feats.children[0]).backgroundColor : "",
      };
    });

  test("CARD-11/15: features sit top-right as icons only, the dot top-left, the time stays centred and clear of both", async ({ page }, info) => {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      const c = card(page, "QA Crowded");
      await c.scrollIntoViewIfNeeded();
      for (const [index, tint] of [[0, "current"], [1, "side"]] as const) {
        const tile = tiles(c).nth(index);
        const g = await corner(tile);
        const at = `${tint} tile at ${width}`;
        console.log("corner", at, JSON.stringify(g));
        expect(g.chipCount, at).toBe(5);
        // Top-right: hugging the right edge, in the top band of the tile.
        expect(g.tile.right - g.chipsRight, `${at} right inset`).toBeLessThan(24);
        expect(g.chipsTop - g.tile.top, `${at} top inset`).toBeLessThan(24);
        expect(g.labelsHidden, `${at} labels visible`).toBe(true);
        expect(g.chipBg, at).not.toMatch(/rgb\((\d|[1-9]\d|1[0-4]\d), /);
        expect(Math.abs(g.timeDx), `${at} time off-centre`).toBeLessThanOrEqual(2);
        expect(g.overlaps, `${at} features overlap the time`).toBe(false);
        expect(g.timeAboveRoster, at).toBe(true);
      }
      if (width === 375) {
        await tiles(c).nth(0).screenshot({ path: info.outputPath("features-tile.png") });
        await c.screenshot({ path: info.outputPath("features-card.png") });
      }
    }
    // Names still reach assistive tech, through the tile and the hidden spans.
    const c = card(page, "QA Crowded");
    await expect(tiles(c).first()).toHaveAccessibleName(/features: ball, showers, parking, lights, water$/);
    await expect(tiles(c).first().locator("[data-features] .sr-only")).toHaveText(["ball", "showers", "parking", "lights", "water"]);
  });

  test("CARD-11: five features share one row at 320, 375 and 1280 wide", async ({ page }) => {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      const c = card(page, "QA Crowded");
      await c.scrollIntoViewIfNeeded();
      for (const index of [0, 1]) {
        const g = await corner(tiles(c).nth(index));
        expect(g.perRow, `rows at ${width}, tile ${index}`).toEqual([5]);
        // A single line hugs the right corner.
        expect(g.tile.right - g.chipsRight, `right inset at ${width}`).toBeLessThan(24);
      }
    }
  });

  test("CARD-11: the icons wrap, left-aligned, only when the row is genuinely too narrow", async ({ page }) => {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      const c = card(page, "QA Many Features");
      await c.scrollIntoViewIfNeeded();
      const tile = tiles(c).first();
      const g = await corner(tile);
      expect(g.chipCount).toBe(8);
      // 8 icons need 220px, more than a phone tile's free width.
      if (width === 1280) {
        expect(g.perRow, "fits one row at 1280").toEqual([8]);
        continue;
      }
      expect(g.perRow.length, `wrapped at ${width}`).toBeGreaterThan(1);
      expect(Math.max(...g.rowLefts) - Math.min(...g.rowLefts), `lines left-aligned at ${width}`).toBeLessThanOrEqual(1);
      // Wrapping only because a full row is as wide as the free width allows:
      // a row never leaves room for one more chip (24px plus the 4px gap).
      const free = await tile.evaluate((el) => {
        const row = el.querySelector<HTMLElement>("[data-features]")!.parentElement!;
        return row.getBoundingClientRect().width;
      });
      for (const n of g.perRow.slice(0, -1)) {
        expect((n + 1) * 28 - 4, `row could have fitted another icon at ${width}`).toBeGreaterThan(free - 0.5);
      }
      expect(g.overlaps, `overlap at ${width}`).toBe(false);
      expect(g.timeAboveRoster).toBe(true);
      expect(g.dot, "no marker on this tile").toBeNull();
    }
  });

  test("CARD-15: the joined and pending dots sit in the tile's top-left corner", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    const joined = card(page, "QA Joined And Pending");
    await joined.scrollIntoViewIfNeeded();
    for (const [c, index] of [[joined, 0], [joined, 1]] as const) {
      const g = await corner(tiles(c).nth(index));
      expect(g.dot, `dot on tile ${index}`).not.toBeNull();
      expect(g.dot!.left - g.tile.left, "dot inset from left").toBeLessThan(24);
      expect(g.dot!.top - g.tile.top, "dot inset from top").toBeLessThan(32);
    }
  });

  test("CARD-17: at the smallest square the icons are the same icons, still named, no special case", async ({ page }, info) => {
    // 1280 wide has the smallest picker: the header is at its widest, and a
    // declined slot's note takes a line besides.
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.waitForTimeout(300);
    const c = card(page, "QA Crowded Declined");
    await c.scrollIntoViewIfNeeded();
    await expect(strip(c)).toHaveAttribute("data-step", "tight");
    const tile = tiles(c).first();
    const g = await corner(tile);
    expect(g.labelsHidden).toBe(true);
    expect(g.perRow).toEqual([5]);
    expect(g.overlaps).toBe(false);
    await expect(tile).toHaveAccessibleName(/features: ball, showers, parking, lights, water$/);
    await c.screenshot({ path: info.outputPath("tight-icons.png") });
  });

  test("CARD-01: a slot's features are never in the header, only on its tile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const c = card(page, "QA Crowded");
    await c.scrollIntoViewIfNeeded();
    const header = c.locator("[data-header]");
    await expect(header).toContainText("QA Crowded");
    await expect(header.getByText(/^(ball|showers|parking|lights|water)$/)).toHaveCount(0);
    await expect(header.locator(".rounded-full")).toHaveCount(0);
    await expect(tiles(c).first().locator("[data-features]")).toContainText("showers");
  });

  test("CARD-12: arrow keys and a tap on a neighbour switch slots; a tile is a group, never a button", async ({
    page,
  }) => {
    const c = card(page, "QA Far Joined");
    await expect(tiles(c).nth(10)).toHaveAttribute("aria-current", "true");

    // Inside the strip only avatars and the one hold button are buttons, and
    // the hold button never contains an avatar (no nested interactive roles).
    const buttons = await strip(c).getByRole("button").evaluateAll((els) => ({
      stray: els.filter((el) => !el.closest("ul") && !el.classList.contains("slot-press")).length,
      holds: els.filter((el) => el.classList.contains("slot-press")).length,
      nested: els.filter((el) => el.classList.contains("slot-press") && el.querySelector("button, a, [role=button]")).length,
    }));
    expect(buttons).toEqual({ stray: 0, holds: 1, nested: 0 });
    await expect(tiles(c).nth(10).getByRole("button", { name: "Press and hold for one second to leave" })).toBeVisible();

    await strip(c).focus();
    await strip(c).press("ArrowLeft");
    await expect(tiles(c).nth(9)).toHaveAttribute("aria-current", "true");

    // The previous neighbour peeks in through the strip's left padding.
    const box = (await strip(c).boundingBox())!;
    await page.mouse.click(box.x + 6, box.y + box.height / 2);
    await expect(tiles(c).nth(8)).toHaveAttribute("aria-current", "true");

    // Tapping the centred tile, off its avatars, changes nothing.
    const mid = (await tiles(c).nth(8).boundingBox())!;
    await page.mouse.click(mid.x + mid.width / 2, mid.y + 24);
    await page.waitForTimeout(400);
    expect(await currentIndex(c)).toBe(8);
  });

  test("PROF-02/CARD-12: Tab only reaches the centred tile's avatars, so focus never scrolls the strip to another slot", async ({ page }) => {
    const c = card(page, "QA Far Joined");
    await expect(tiles(c).nth(10)).toHaveAttribute("aria-current", "true");
    await page.waitForTimeout(400);
    await strip(c).focus();
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(250);
      const at = await c.evaluate((item) => {
        const a = document.activeElement as HTMLElement | null;
        const tile = a?.closest(".slot-tile");
        return {
          inStrip: !!a && item.contains(a) && !!tile,
          tile: tile ? Array.from(tile.parentElement!.children).indexOf(tile) : -1,
        };
      });
      if (at.inStrip) seen.push(String(at.tile));
    }
    // Focus visited the centred tile's avatars and no other tile's.
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(["10"]));
    expect(await currentIndex(c)).toBe(10);
  });

  test("CARD-24: tapping an avatar opens the details card and doesn't slide the tile", async ({
    page,
  }) => {
    const c = card(page, "QA Far Joined");
    // Click by coordinates: locator.click() scrolls the snapping deck to bring
    // the avatar into view, and the deck scrolling closes the card.
    const box = (await tiles(c).nth(10).getByRole("button", { name: "You" }).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator("[data-player-details-card]")).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator("[data-player-details-card]")).toBeVisible();
    expect(await currentIndex(c)).toBe(10);
  });

  test("CARD-32: declined is a line of text and the host's message, never pressable; its neighbour can still be joined", async ({
    page,
  }) => {
    const d = card(page, "QA Declined");
    await expect(line(d)).toHaveText("Not accepted");
    await expect(d.getByText("QA denied message")).toBeVisible();
    await expect(d.locator(".slot-press")).toHaveCount(0);
    // The only buttons left would be avatars, and this tile has no players.
    await expect(d.getByRole("button")).toHaveCount(0);

    await selectSlot(d, 1);
    await expect(line(d)).toHaveText("Hold to join");
    await expect(d.getByRole("button", { name: "Press and hold for one second to join" })).toBeVisible();
    await expect(d.getByText("QA denied message")).toHaveCount(0);
  });

  test("CARD-32/19: a full slot shows 'Full squad' in grey and a reason, never a pressable tile", async ({
    page,
  }) => {
    const p = card(page, "QA Pending");
    await selectSlot(p, 1);
    await expect(tiles(p).nth(1)).toContainText("10 / 10 players");
    await expect(tiles(p).nth(1)).toContainText("Full squad");
    await expect(p.locator(".slot-press")).toHaveCount(0);
    await expect(line(p)).toHaveText("Game is full");
    await expect(tiles(p).nth(1).getByText("Full squad")).toHaveClass(/text-surface-500/);
  });

  test("CARD-19: spots left is emerald with 3 or more left, amber with 1 or 2", async ({ page }) => {
    // The theme resolves colours to oklch, so the tone is checked by its class.
    const few = card(page, "QA Few Spots");
    await expect(tiles(few).nth(0).getByText("1 spot left")).toHaveClass(/text-amber-700/);
    await expect(tiles(few).nth(1).getByText("2 spots left")).toHaveClass(/text-amber-700/);
    const plenty = tiles(card(page, "QA Far Joined")).nth(10).getByText("3 spots left");
    await expect(plenty).toHaveClass(/text-emerald-700/);
  });

  test("CARD-31: the line says Hold to join, with the price only when the slot has one, and Hold to leave in red", async ({ page }) => {
    await expect(line(card(page, "QA Priced"))).toHaveText("Hold to join · 6€");
    await expect(line(card(page, "QA Crowded"))).toHaveText("Hold to join");
    const leave = line(card(page, "QA Far Joined"));
    await expect(leave).toHaveText("Hold to leave");
    expect(await leave.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(185, 28, 28)");
    // Side tiles keep the line's space but hide it.
    const side = tiles(card(page, "QA Far Joined")).nth(9).locator(".slot-hint");
    await expect(side).toBeHidden();
  });

  test("room with no slots", async ({ page }) => {
    await expect(card(page, "QA No Slots").getByText("No time slots")).toBeVisible();
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
      // The closed drawer stays in the DOM (invisible), so its close button
      // proves nothing; the grab pill is only there while the drawer is shut.
      drawer: !document.querySelector('[aria-label="Open menu"]'),
    }));

  test("CARD-13: swiping the slot strip scrolls only the strip and never opens the drawer", async ({ page }) => {
    const b = (await strip(card(page, "QA Far Joined")).boundingBox())!;
    const y = b.y + b.height / 2;
    const before = await state(page);
    // Rightward drag starting at the strip's left edge (the back-swipe zone, NAV-11).
    await drag(page, { x: b.x + 2, y }, { x: b.x + 250, y });
    const right = await state(page);
    // Leftward drag back.
    await drag(page, { x: b.x + 250, y }, { x: b.x + 20, y });
    const left = await state(page);
    console.log("touch strip", JSON.stringify({ before, right, left }));
    expect(right.drawer, "drawer opened by a strip swipe").toBe(false);
    expect(right.strip).toBeLessThan(before.strip);
    expect(left.strip).toBeGreaterThan(right.strip);
    expect(left.deck).toBe(before.deck);
    expect(left.winX).toBe(0);
  });

  test("NAV-10: a right-edge swipe outside the strip still opens the drawer", async ({ page }) => {
    const vp = page.viewportSize()!;
    await drag(page, { x: vp.width - 4, y: vp.height - 120 }, { x: vp.width - 200, y: vp.height - 120 });
    expect((await state(page)).drawer).toBe(true);
  });

  test("CARD-13: a vertical drag that starts on the strip still scrolls the deck", async ({ page }) => {
    const b = (await strip(card(page, "QA Far Joined")).boundingBox())!;
    const x = b.x + b.width / 2;
    const before = await state(page);
    await drag(page, { x, y: b.y + b.height / 2 }, { x, y: b.y - 220 });
    const after = await state(page);
    console.log("touch vertical", JSON.stringify({ before, after }));
    expect(after.deck).toBeGreaterThan(before.deck);
    expect(after.strip).toBe(before.strip);
  });
});

test.describe("hold to join or leave, with real touch", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch only");
    await stub(page);
    await openPlay(page, isMobile);
  });

  // locator.click would scroll the snapping deck to the target and tap with
  // the wrong timing, so the press is a raw touch through CDP.
  const touch = async (
    page: Page,
    at: { x: number; y: number },
    holdMs: number,
    moveTo?: { x: number; y: number }
  ) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
    if (moveTo) {
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: at.x + ((moveTo.x - at.x) * i) / steps, y: at.y + ((moveTo.y - at.y) * i) / steps }],
        });
        await page.waitForTimeout(holdMs / steps);
      }
    } else {
      await page.waitForTimeout(holdMs);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  };

  // The upper middle of the centred tile: the time, clear of the avatars below.
  const tilePoint = async (c: Locator) => {
    await c.scrollIntoViewIfNeeded();
    const current = strip(c).locator("[aria-current='true']");
    // Wait for the deck and the strip to stop moving before taking the point.
    let box = (await current.boundingBox())!;
    for (let i = 0; i < 20; i++) {
      await c.page().waitForTimeout(100);
      const next = (await current.boundingBox())!;
      const still = next.x === box.x && next.y === box.y;
      box = next;
      if (still && i > 2) break;
    }
    return { x: box.x + box.width / 2, y: box.y + box.height * 0.4 };
  };

  const record = async (page: Page) => {
    const calls: string[] = [];
    await page.route(/localhost:3000\/timeslots\/\d+\/(join|leave)$/, (r) => {
      calls.push(new URL(r.request().url()).pathname);
      return r.fulfill({ json: { message: "ok", status: "pending" } });
    });
    return calls;
  };

  test("CARD-33: holding the centred tile for over a second joins", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Crowded");
    await touch(page, await tilePoint(c), 1200);
    await expect.poll(() => calls).toEqual(["/timeslots/9600/join"]);
  });

  test("CARD-34: holding a joined tile for over a second leaves", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Far Joined");
    await touch(page, await tilePoint(c), 1200);
    await expect.poll(() => calls).toEqual(["/timeslots/9110/leave"]);
  });

  test("CARD-33: letting go early sends nothing and the line says Keep holding", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Crowded");
    await touch(page, await tilePoint(c), 300);
    await expect(c.locator(".slot-hint:visible")).toHaveText("Keep holding…");
    await page.waitForTimeout(1500);
    expect(calls).toEqual([]);
  });

  test("CARD-33: the tile doesn't move while it is held", async ({ page }) => {
    await record(page);
    const c = card(page, "QA Crowded");
    const at = await tilePoint(c);
    const current = strip(c).locator("[aria-current='true']");
    const before = await current.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
    await page.waitForTimeout(600);
    await expect(current).toHaveClass(/slot-tile--holding/);
    const during = await current.boundingBox();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    expect(during).toEqual(before);
  });

  test("CARD-33: a sideways swipe of more than 8px cancels the hold", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Crowded");
    const at = await tilePoint(c);
    await touch(page, at, 1300, { x: at.x - 60, y: at.y });
    await page.waitForTimeout(800);
    expect(calls).toEqual([]);
  });

  test("CARD-12: a press on an avatar never starts a hold", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Far Joined");
    await c.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = (await tiles(c).nth(10).getByRole("button", { name: "You" }).boundingBox())!;
    await touch(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 1300);
    await page.waitForTimeout(300);
    expect(calls).toEqual([]);
  });

  test("CARD-32: a status tile is text and holding it does nothing", async ({ page }) => {
    const calls = await record(page);
    const c = card(page, "QA Pending");
    await expect(c.locator(".slot-hint:visible")).toHaveText("Awaiting approval");
    await expect(c.locator(".slot-press")).toHaveCount(0);
    await touch(page, await tilePoint(c), 1300);
    expect(calls).toEqual([]);
  });
});

// Real data. Joins a future slot nobody is in, checks the roster, leaves.
test("CARD-34/36: join and leave a real slot update the tile's roster", async ({ page, isMobile }, info) => {
  test.skip(info.project.name !== "chromium", "one real write per run");
  const DAY = "Tuesday";
  await skipTermsGate(page);
  await openPlay(page, isMobile);
  await page.getByRole("button", { name: DAY }).click();
  const c = card(page, "Playground 1");
  await page.waitForLoadState("networkidle");
  test.skip(
    (await c.count()) === 0,
    "needs the seeded Playground 1 room on a Tuesday in the live data"
  );
  await expect(tiles(c).first()).toBeVisible();
  const at14 = tiles(c).filter({ hasText: "14:00" });
  const index = await tiles(c).evaluateAll((els) =>
    els.findIndex((el) => el.getAttribute("aria-label")?.startsWith("14:00"))
  );
  expect(index, "no 14:00 slot on Tuesday in Playground 1").toBeGreaterThanOrEqual(0);
  await selectSlot(c, index);
  await expect(at14).toHaveAttribute("aria-current", "true");
  await expect(at14).toContainText("0 / 10 players");

  // CARD-33/34: joining and leaving are a 1s press-and-hold on the tile (or
  // the hub's leave button), so a click would do nothing. Keyboard hold: the
  // keyboard is the one input that doesn't scroll the snapping deck.
  const hold = async (button: Locator) => {
    await button.focus();
    await page.keyboard.down("Enter");
    await page.waitForTimeout(1200);
    await page.keyboard.up("Enter");
  };

  try {
    await hold(c.getByRole("button", { name: "Press and hold for one second to join" }));
    // A confirmed join hands the screen to the match hub, where "Find another
    // game" sits in the top row (CARD-36).
    await page.getByRole("button", { name: /Find another game/ }).click();
    await page.getByRole("button", { name: DAY }).click();
    await expect(at14).toContainText("1 / 10 players");
    await expect(at14).toHaveAccessibleName(/^14:00, 1 of 10 players, you're in$/);
    await expect(at14.getByRole("button").first()).toHaveAccessibleName("You");
    await expect(at14).toHaveAttribute("aria-current", "true");
    await expect(c.getByText("You're in")).toBeVisible();
    await page.screenshot({ path: info.outputPath("joined.png") });
  } finally {
    // Cleanup must work from wherever a failure left the page: the hub (its
    // leave button sits alone, CARD-36) or the held tile.
    const leave = page
      .getByRole("button", { name: "Leave game" })
      .or(page.getByRole("button", { name: "Press and hold for one second to leave" }))
      .first();
    if (await leave.isVisible().catch(() => false)) await hold(leave);
  }
  await expect(at14).toContainText("0 / 10 players");
  await expect(c.getByText("You're in")).toHaveCount(0);
});
