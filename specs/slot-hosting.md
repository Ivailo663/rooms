# Slot hosting

Status: draft, awaiting owner review. Not built.

A player can offer to **host** one week's game of a slot ("17:00 is open, I can
gather the players"). The room owner approves them. A host runs that game's
roster: they bring their own people, decide how many seats outsiders get, and
can remove players. Hosting is optional, and an unhosted slot works exactly as
it does today.

## Ownership

- **HOST-01** A room has one **owner**, the account in `creatorId`. The owner
  manages the room's schedule (SLOT-10..17: times, capacity, price, enabling)
  and approves hosts. `Room.hostId` is removed.
- **HOST-02** A **slot host** is attached to one occurrence of one slot, never
  to a room. A slot has at most one host at a time.

## Becoming a host

- **HOST-10** On an enabled, `scheduled` slot that has no host, a player can
  ask to host it, which creates a **host request**. Asking twice keeps one
  request. The owner can't ask to host their own room's slots.
- **HOST-11** The room owner sees the slot's pending host requests and can
  approve or decline each one. Nobody else can (403).
- **HOST-12** Approving makes the requester that occurrence's host, and every
  other pending host request for that slot is declined. If the slot already
  has a host, approving is 409.
- **HOST-13** A declined requester can't ask again for that occurrence.
- **HOST-14** At the end-of-occurrence reset ([LIFE-08](slot-lifecycle.md)), the
  host and all host requests are cleared together with the roster. The next
  week's occurrence starts unhosted.
- **HOST-15** A hosted slot is never redistributed. Below quorum at the cutoff,
  it fails ([LIFE-05](slot-lifecycle.md)), so the host's group stays together.
- **HOST-16** Becoming host doesn't seat the host. They play only if they also
  take a seat, by joining or by adding themselves (HOST-22).
- **HOST-17** A player who is `blacklisted` in the room's tenant can't host. A
  host request from them is 403, and an approval for one is 409. The blacklist
  marks people who broke the venue's rules or terms. `[tbd]` — blacklist
  semantics are under discussion ([REQ-04](join-requests.md)).
- **HOST-18** (mirrored) The host may step down, which makes the slot unhosted
  again. Their outsider limit is dropped, and seats already taken stay.
  Stepping down is allowed until `hostStepDownCutoff` minutes before the lock
  window starts. That's a tenant setting with a default of 120
  ([tenant-settings.md](tenant-settings.md)). After that it's 409 "It's too late
  to step down from hosting this game".
- **HOST-19** The room owner can remove the host at any time before the lock
  window. The effect is the same as stepping down.

## What the host can do

- **HOST-20** (mirrored) The host sets how many seats are open to
  **outsiders**, meaning anyone the host hasn't brought in. The value ranges
  from 0 (closed to outsiders) to the seats still free. With no value set, all
  free seats are open, as today.
- **HOST-21** (mirrored) An outsider's join is refused with 409 "The host has
  closed this game" when the outsider seats are used up. This is checked at
  the `full` step of the join ([MEM-08](membership.md)).
- **HOST-22** The host brings in their own people by **account search**, and
  each person is seated directly, even when outsider seats are 0. Seats never
  go beyond `max_players`. The person needs an account. The join policy's
  approval step doesn't apply, because the host vouches for them, but the
  one-game-per-hour rule ([MEM-20](membership.md)) does (409).
- **HOST-28** A host can't add a `blacklisted` person (409). `[tbd]` — blacklist
  semantics are under discussion ([REQ-04](join-requests.md)).
- **HOST-23** The host can remove any player except themselves from their
  slot's roster. The player loses their seat and `timeslot-membership:changed`
  is emitted.
- **HOST-24** The host can approve, deny and dismiss join requests for their
  slot only ([REQ-10](join-requests.md)).
- **HOST-25** The host can't change the slot's time, capacity, price, features
  or enabled state. Those belong to the owner (HOST-01).
- **HOST-26** A removed player can't rejoin that occurrence, either by joining
  or by request (409 "You were removed from this game"). The block clears at
  the reset (LIFE-08). The host may still add them back.
- **HOST-27** (mirrored) Hosting follows the same timing rules as joining. Once
  the lock window starts ([LIFE-01](slot-lifecycle.md)), nobody can ask to
  host, be approved as host, be added, or be removed (409). The headcount the
  cutoff verdict judges doesn't move.

## Where it shows up

- **HOST-30** A hosted slot shows its host's name to players.
- **HOST-31** On an unhosted slot that HOST-10 allows, a player sees "Ask to
  host". After asking, they see "Host request sent" until the owner decides.
- **HOST-32** Host changes and host requests reach the owner, the host and
  players live. The DB stays the source of truth ([EVT-01](realtime.md)).
- **HOST-33** **My games** is the full-screen hub (`MyGameHub`), as today. It
  lists the player's games: those they've joined, requested, or are hosting. A
  "My games" trigger in `HomeView`, next to `ReturnToGameBar`, opens it. The
  trigger is there whenever the player has at least one game, including a game
  they host without playing.
- **HOST-34** A game the player hosts is labelled "Hosting" in the hub. Its
  host controls live there: outsider seats (HOST-20), add people (HOST-22),
  remove players (HOST-23), join requests (HOST-24) and step down (HOST-18).
  The API marks it `membership: "hosting"` in `/timeslots/joined`
  ([MEM-30](membership.md)).

## Open questions

None left for hosting, as of 2026-10-30. The blacklist parts (HOST-17,
HOST-28) wait on the blacklist discussion in
[join-requests.md](join-requests.md#to-be-discussed-blacklist).
