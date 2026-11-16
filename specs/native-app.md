# Native app

Status: draft, awaiting owner review. Not built.

The app ships to phones as real iOS and Android apps, built with
[Capacitor](https://capacitorjs.com) from the same Vue client. There's one
codebase; the web version keeps working.

## Shipping

- **APP-01** The client builds into an iOS app and an Android app with
  Capacitor. Every screen and rule is the same as on the web; nothing is
  written twice.
- **APP-02** The apps talk to the deployed server over HTTPS, never to
  `localhost`. The server address comes from build configuration, not from
  the code.
- **APP-03** The server accepts requests and Socket.IO connections from the
  apps' origins (`capacitor://localhost` on iOS, `https://localhost` on
  Android), and from the web client's own address.
- **APP-04** Sign-in by email and password works in the apps exactly as on
  the web, including the AUTH-20 checkbox screen.

## Feeling native

- **APP-10** Content stays clear of the notch, the status bar and the home
  indicator on every screen, and the status bar's colours match the app's.
- **APP-11** iOS: a swipe from the left edge goes back to the previous page
  ([NAV-11](ui/navigation.md)); with nothing to go back to, nothing happens.
- **APP-12** Android: the system back (gesture or button) goes back to the
  previous page. On a page with nothing to go back to, it closes the drawer
  if it's open, and otherwise leaves the app.
- **APP-13** The app opens with its own icon and splash screen, and no browser
  bar or browser gesture ever shows.

## Open questions

1. **Where does the server run?** The client points at `localhost:3000`
   today ([axios.ts](../client/src/axios.ts)), so a phone can't reach it. The
   apps need the server deployed somewhere public with HTTPS. Where (Render,
   Railway, Fly.io, a VPS)?
2. **Accounts.** Publishing needs an Apple Developer account ($99 a year) and
   a Google Play developer account ($25 once), in the owner's name. Testing
   on your own phone works without them for Android and with a free Apple ID
   for iOS (the app expires after 7 days).
3. **App identity.** The store name, and the bundle id (for example
   `bg.rooms.app`). The bundle id can't change after the first release.
4. **First release:** private testers first (TestFlight, Play internal
   testing), or straight to the stores? *Proposal:* testers first.
5. **Facebook sign-in (AUTH-10..13)** needs a native plugin inside the apps,
   since Firebase's web pop-up doesn't work there. It's built with Facebook,
   which is on hold.
6. **When.** *Proposal:* before the media viewer and video (media steps 4
   and 5), since Capacitor's camera and upload plugins shape how uploads are
   built.
