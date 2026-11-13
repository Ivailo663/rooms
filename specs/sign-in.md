# Sign-in

Status: approved 2026-11-12. Not built.

Code: [AuthView.vue](../client/src/views/AuthView.vue),
[verifyFirebaseToken.ts](../server/middleware/verifyFirebaseToken.ts),
[server/routes/users.ts](../server/routes/users.ts).

Players sign in with Firebase, by email and password or with Facebook.

## Finding the account

- **AUTH-01** The server finds the caller's account by the Firebase user id
  in their token, never by email. Each account stores its Firebase user id,
  and no two accounts share one.
- **AUTH-02** On sign-in (`POST /user`, [ROLE-07](tenancy-and-roles.md)), an
  account that has no Firebase user id yet but has the token's verified email
  gets the id stored, and is that caller's account from then on. Existing
  password accounts carry over this way.
- **AUTH-03** An account's email is optional. A Facebook user who shares no
  email still gets an account, and nothing that account can do depends on
  having one.

## Facebook

- **AUTH-10** The sign-in screen offers "Continue with Facebook" next to the
  email and password form.
- **AUTH-11** A first Facebook sign-in creates the account with the Facebook
  name and profile picture ([PROF-20](player-profile.md)), and the email if
  Facebook shares one.
- **AUTH-12** If the Facebook email belongs to an existing password account,
  the player is asked for that account's password once. After that, both
  ways of signing in open the same account. Cancelling leaves the player
  signed out, and no second account is created.
- **AUTH-13** A cancelled or failed Facebook sign-in leaves the player on the
  sign-in screen with "Couldn't sign in with Facebook. Try again."

## Signing up

- **AUTH-20** Signing up shows one unticked checkbox, in plain words: "I'm 18
  or over, and other players can rate me after games." The player can't
  continue until it's ticked, and no account is created without it. No birth
  date is asked.
- **AUTH-21** An account that existed before AUTH-20 sees the same checkbox
  once, on its next sign-in, before anything else. Once ticked, it's never
  asked again, for any account.
- **AUTH-22** The account stores when the checkbox was ticked.
- **AUTH-23** The server enforces it. `POST /user` with `acceptTerms: true`
  creates the account, or records the tick on an existing account that has
  none. Creating an account without it is 400 "Tick the box to continue", and
  nothing is created. An existing account is returned unchanged either way
  (ROLE-07).
- **AUTH-25** Until an account has ticked the box, every endpoint except
  `GET /user` and `POST /user` answers 403 "Tick the box to continue", and
  nothing changes. A signed-in Firebase user with no account gets the same
  answer from those endpoints.
- **AUTH-24** (mirrored) After any sign-in, a signed-in Firebase user with no
  account, or with an account that hasn't ticked the box, sees only the
  checkbox screen until they tick it. On the sign-up form, the checkbox is
  part of the form, so a new password user doesn't see it twice.

## Pages Facebook requires

- **AUTH-30** `/privacy` shows the privacy policy and `/delete-data` explains
  how to have an account and its data deleted. Both open without signing in,
  and both are linked from the sign-in screen. The owner writes the policy
  text.

## Open questions

None, as of 2026-11-11.
