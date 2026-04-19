# Mobile (Android APK + iOS)

Futbool ships a single Next.js web app that doubles as the native shell
via [Capacitor](https://capacitorjs.com/). No separate React Native
codebase. Two supported shipping modes:

## Mode A — Remote web view (fastest)

The APK / IPA is a thin shell that loads the hosted web app. Every web
release is instantly live on every installed device — no app store
re-review for UI-only changes.

Edit `web/capacitor.config.ts` and set:

```ts
server: {
  url: "https://futbool.app",
  cleartext: false,
  androidScheme: "https",
}
```

## Mode B — Bundled static build

Ship the web assets inside the app so it works offline-ish. Requires
the Next.js app to be fully static-exportable (remove any server-only
dynamic routes; our current stack is fine because API calls go to the
external backend).

Enable static export in `next.config.ts`:

```ts
const config: NextConfig = { output: "export", ...rest };
```

Then:

```bash
cd web
npm run build        # produces ./out
npx cap sync
```

## One-time setup

```bash
cd web
npm install
npx cap init Futbool app.futbool.mobile --web-dir out   # first time only
npm run mobile:add:android
npm run mobile:add:ios          # macOS + Xcode only
```

This creates `web/android/` and `web/ios/` directories managed by
Capacitor. Gradle + Xcode handle the actual builds; Capacitor just
proxies commands.

## Daily workflow

```bash
npm run build                 # Next.js build (Mode B) OR skip (Mode A)
npm run mobile:sync           # copy web assets / config into native
npm run mobile:open:android   # Android Studio
npm run mobile:open:ios       # Xcode
```

Then build + sign + upload as usual for each store.

## Apple + Stripe note

Stripe web Checkout is fine for Android. On iOS the App Store
guidelines require in-app purchases for digital subscriptions — for the
iOS build, either:

1. Wire **StoreKit 2** in-app purchases mirrored to our Supabase
   subscription mirror (product SKUs aligned with the `products` table),
   or
2. Route iOS users through a mobile web flow outside the app for
   purchase, with the app loading a logged-in state.

Both are Phase 5+ work.

## Push notifications

Capacitor has first-party plugins for FCM (Android) and APNs (iOS).
Add them when we ship push — their setup is out of scope until a
device token table lands in the backend.
