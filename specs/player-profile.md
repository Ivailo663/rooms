# Player details card

Code: [PlayerDetailsCard.vue](../client/src/features/rooms/components/PlayerDetailsCard.vue).

Any avatar that stands for a known player opens a small card about that
player. It's one component, and it behaves the same everywhere.

## Where and how it opens

- **PROF-01** The card opens from every avatar backed by a known player. Today
  that's the host's players widget ([HCARD-13](ui/hosted-room-card.md)), the
  player list in the host's slot monitor (Manage drawer), and the player's
  avatar rows (slot picker tiles and My games roster,
  [CARD-24](ui/playable-room-card.md)). Avatars
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

- **PROF-10** It shows the player's picture (initials when there's none),
  name, preferred position, city and "member since". Rating, games played and
  attendance join it with PROF-50..53.
- **PROF-11** Everything except the name comes from the server for that
  player.

## The profile

The app is also growing into a database of amateur football players in
Bulgaria. Every player has a profile, built in phases.

- **PROF-20** A profile holds: picture, name, preferred position, city, a
  short bio, and "member since": when the player's Firebase account was
  created, which for accounts that existed before profiles is read back from
  Firebase once. Facebook
  sign-in fills the name and picture ([AUTH-11](sign-in.md)).
- **PROF-21** A player edits their own name, preferred position, city and bio.
  Nobody else can (403).
- **PROF-22** Preferred position is optional, and one of: goalkeeper,
  defender, midfielder, forward. Anything else is 400.
- **PROF-23** Name is required, up to 50 characters. Bio is optional, up to
  300 characters. Over either limit is 400.
- **PROF-24** City is optional, and one of a fixed list of every Bulgarian
  city (nothing outside Bulgaria, no "Other") that the server holds and the
  client offers. Anything else is 400.
- **PROF-25** The picture comes from Facebook only. Players without one show
  initials. Uploading a picture waits for PROF-60.
- **PROF-26** The player's own avatar, in the user section of the sidebar
  (where the user icon is today, collapsed or not), opens the `/profile`
  page. It shows every PROF-20 field, and the ones PROF-21 allows are
  editable.
- **PROF-28** There's no save button. A text field (name, bio) saves once
  typing stops for a moment; position and city save when picked. If the
  server refuses, its message shows under that field, the field keeps what
  was typed, and the next change tries again.
- **PROF-29** Each player has a full, read-only profile page at
  `/profiles/:id` showing every PROF-20 field (and later phases' data as they
  ship). The player card ([PROF-10](#what-it-shows)) links to it with "View
  profile". An unknown id shows "Player not found".

## Who sees a profile

- **PROF-30** Every player has a profile and appears in the player database
  from sign-up. There's no opting out of the basic profile (PROF-20).
- **PROF-31** Only signed-in users can see a profile. Signed out, it's 401.
- **PROF-32** A profile never shows the player's email.

## Ratings consent

- **PROF-40** Every account has agreed to be rated, commented on and ranked
  ([AUTH-20](sign-in.md)): nobody uses the app without it. There's no
  in-app way to withdraw. Leaving means deleting the account
  ([AUTH-30](sign-in.md)), which deletes their ratings and comments too.

## Later phases

- **PROF-50** After a game, the players who were on its roster can rate and
  comment on each other. Nobody else can, and nobody rates themselves.
  `[deferred]`
- **PROF-51** Games played and attendance are counted from game rosters,
  never typed in. Today's rosters are cleared at each reset
  ([LIFE-08](slot-lifecycle.md)), so this needs a record of past games first.
  `[deferred]`
- **PROF-52** A ranklist of players ordered by rating, with a minimum number
  of ratings to appear. `[deferred]`
- **PROF-53** The ranklist resists friends rating each other up (for example
  by weighting ratings or requiring raters from different games).
  `[deferred]`
- **PROF-60** A player uploads photos, videos and reels to their profile,
  within size limits, and others can report them for removal. `[deferred]`
- **PROF-61** A player can be requested for a game, at the price they ask.
  Payment happens outside the app. `[deferred]`

## Open questions

1. ~~Endpoint shape.~~ Settled 2026-11-13: by id when the card opens, cached
   (`GET /players/:id`, PROF-11).
2. **Where the numbers come from.**
   - Rating: who rates whom, and when?
   - Games played: count only slots that went `live`?
   - Attendance: no-shows aren't recorded today.
   - Position: set by the player?
     Rating, games played and attendance now wait on PROF-50..53. Position is
     set by the player (PROF-21).
3. ~~Who can see a profile.~~ Settled 2026-11-11: any signed-in user
   (PROF-31).
