# Player details card

Code: [PlayerDetailsCard.vue](../client/src/features/rooms/components/PlayerDetailsCard.vue).

Any avatar that stands for a known player opens a small card about that
player. It's one component, and it behaves the same everywhere.

## Where and how it opens

- **PROF-01** The card opens from every avatar backed by a known player. Today
  that's the host's players widget and the player's avatar rows (slot picker
  tiles and My games roster, [CARD-24](ui/playable-room-card.md)). Avatars
  with only a count behind them, and the "+N" circle, don't open it.
- **PROF-02** With a mouse, the card opens when the pointer enters an avatar.
  It opens on keyboard focus too, and the card closes when focus leaves.
- **PROF-03** Moving from one avatar to another moves the same card. Leaving an
  avatar closes the card after 120 ms, unless the pointer reaches the card
  first, in which case it stays until the pointer leaves the card.
- **PROF-04** The card sits centred below its avatar, flips above it when it
  wouldn't fit, and stays 8 px inside the viewport. It's never clipped by the
  room card around it. Any scroll or resize closes it.
- **PROF-05** On touch screens, tapping an avatar opens its card. Tapping
  another avatar moves it there, and tapping anywhere outside the avatar and
  the card closes it.

## What it shows

- **PROF-10** It shows the player's picture (initials until there are
  pictures), name, rating (score and number of ratings), position, games
  played, attendance and "member since".
- **PROF-11** Everything except the name comes from the server for that
  player. `[gap]` — there's no profile data yet, so the rating and the detail
  rows are hardcoded placeholders, the same for every player.

## Open questions

1. **Endpoint shape.** Fetch one player by id when their card opens
   (`GET /players/:id`, cached on the client), or everyone on a roster at once
   (`GET /players?ids=…`)? *Proposal:* by id on open. It loads only the
   profiles people actually look at, and the cache makes a second open
   instant. Batch is worth it only if the card must show without a brief
   loading state.
2. **Where the numbers come from.**
   - Rating: who rates whom, and when?
   - Games played: count only slots that went `live`?
   - Attendance: no-shows aren't recorded today.
   - Position: set by the player?
3. **Who can see a profile.** Any signed-in user, or only people who share a
   game or venue? Emails are never shown.
