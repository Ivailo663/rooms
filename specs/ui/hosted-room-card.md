# Hosted room card (host dashboard)

Code: `client/src/features/rooms/host/` (`HostedRoomCard.vue`,
`widgets/StatusWidget.vue`, `widgets/PlayersWidget.vue`).

## Slot panel

The status widget is the panel for the one slot the card is describing: the
live slot, else the next upcoming one. Everything about that slot sits inside
it, so it reads as one unit rather than separate boxes.

- **HCARD-01** The status widget wraps the other widgets. Its header (status
  badge, slot label, countdown or elapsed minutes, and when) comes first, and
  the players widget and all next widgets sit inside the panel below it, full width.
- **HCARD-02** The panel's background is a top-to-bottom gradient from the
  status colour (emerald live, amber scheduled, surface inactive) to white. The colour has faded to white by the end
  of the header, so the widgets inside it sit on white.
- **HCARD-03** The panel's border uses the light shade of the same status
  colour.
- **HCARD-04** Widgets inside the panel keep their own border and colours. The
  players widget still turns emerald when quorum is reached, whatever the
  panel's status colour.
- **HCARD-05** Redistribution notices for the slot the panel describes render
  inside the panel, below the players widget, and can still be dismissed.
- **HCARD-06** The failed / under-filled notice stays outside the panel, below
  it, because it is about an earlier slot than the one the panel describes.
- **HCARD-07** While a slot is live, the "Next: <when> at <label>" line is the
  last line inside the panel, below the nested widgets, not under the header.
- **HCARD-08** On every width, the panel is a single full-width column. There
  is no side-by-side grid of widgets.
- **HCARD-09** When nothing is scheduled (`inactive`), the players widget still
  shows inside the panel, with a dash in place of counts.
- **HCARD-10** After a slot fails, the panel moves on to the next upcoming
  game (later today, or the next day that has one, which for a weekly slot can
  be the same slot next week). The failure shows only in the failed notice
  below the panel.
- **HCARD-11** The panel's status is only ever live, scheduled or inactive. It
  never shows failed or redistributed: those have their own notices (HCARD-05,
  HCARD-06). A slot that was just redistributed still shows as scheduled in
  the panel, with its notice inside.
- **HCARD-12** With no upcoming game at all, the panel is inactive and reads
  "No slots", even if a slot failed earlier today.

## Players widget

- **HCARD-13** When the card has the slot's roster (today's next slot), the
  players widget draws it with the shared avatar row used on the player cards
  ([SlotAvatars](../../client/src/features/rooms/player/SlotAvatars.vue),
  CARD-22..24): same circles, the same "+N" overflow, and each avatar opens
  the player details card ([PROF-01..05](../player-profile.md)).
- **HCARD-14** The players are known for every slot the card describes,
  including a live slot and a game on a later day, so HCARD-13 applies to
  those too: named avatars that open the details card, never a bare count
  ([SLOT-20](../timeslot-management.md)).
