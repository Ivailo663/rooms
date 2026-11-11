# Product

> **Draft, written by Claude from the code on 2026-10-30. The owner needs to
> confirm or rewrite it.** Lines marked *(inferred)* are guesses about intent.
> This file holds no acceptance criteria: it sets the scope the domain specs
> are judged against.

## What it is

A booking app for **pickup football**. Venues publish weekly game slots, and
players find a game and join it. The app's core job is to make sure a game
that's on the calendar **actually happens with enough players**. If a game
can't fill, players find out before they travel, and are moved to a game that
will run.

## Who it's for

| Who | Role | Wants |
| --- | --- | --- |
| Player | `player` | Find a game near them at a time that suits, join in one tap, know it will run. |
| Room owner | `clientAdmin` who created the room | Run their room's weekly schedule, approve slot hosts and players. |
| Slot host | any player, once approved | Gather their own people for one game, choose how many outsiders can join, remove players. |
| Venue operator | `clientAdmin` | Set the rules for all their rooms: who can join freely, cutoffs, redistribution. |
| Platform admin | `superAdmin` | Onboard and manage operators (tenants). *(inferred; not built)* |

## Principles

- **A game on screen is a real game.** The UI never shows a game as going ahead
  when the server will cancel it. That's why lock, quorum and clash rules are
  mirrored on the client.
- **The player's calendar is protected.** A player can have one confirmed game
  per hour, across every venue.
- **The operator sets policy, the host runs the slot.** Tenant-wide rules live
  in tenant settings. Capacity, price and minimums live on each slot.
- **Mobile first, next to the pitch.** The main view stays bare, and
  navigation lives in a drawer.
- **Simple over clever.** Nothing gets built for a situation the product
  doesn't have yet.

## In scope today

Weekly recurring 60-minute slots. Joining, leaving and approval requests.
Cutoff, quorum, failure and redistribution. Per-tenant join policy and
blacklists. Live updates over sockets.

## Out of scope (for now)

- Payments. `price` is shown but never charged. *(inferred)*
- One-off or non-weekly games, and slots longer or shorter than 60 minutes.
- Chat or messaging between players. *(inferred)*
- Notifications outside the app (push, email, SMS). *(inferred)*
- Tenant subscription plans and billing ([ROLE-08](tenancy-and-roles.md)).

## Success looks like *(owner to fill in)*

- e.g. share of scheduled slots that run vs fail
- e.g. share of failing slots rescued by redistribution
