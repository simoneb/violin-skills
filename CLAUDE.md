# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run start:dev        # Metro for the dev client — the everyday loop, Fast Refresh
npm run android:dev      # build + install the dev variant (see "App variants")
npm test                 # jest
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm run licenses:generate  # regenerate in-app attributions after dependency changes
```

A single test file: `npx jest src/music/__tests__/scales.test.ts`
A single test by name: `npx jest -t "just intonation"`

A native dev build is required — Expo Go cannot load `react-native-audio-api`.

## Shipping a change

Two mechanisms, and the choice between them is mechanical rather than a
judgement call:

- **JavaScript, TypeScript or assets only** → Actions › **Update**. Publishes an
  over-the-air bundle that installed apps pick up on next launch. No rebuild.
- **Anything touching native** (a native module, `app.json` native config,
  permissions, an SDK bump) → Actions › **Release**. Builds and publishes a new
  APK.

You do not have to classify the change yourself. The Update workflow
fingerprints the native project, compares it against the build people actually
installed, and refuses to publish when they differ — telling you to cut a
release instead. That guard exists because **a mismatched update fails
silently**: it publishes under a runtime version no build declares, reaches
nobody, and reports success.

`runtimeVersion` therefore uses the `fingerprint` policy, not `appVersion`.
Under `appVersion` every release stranded earlier installs from further
updates. Do not change this back without understanding that.

Releases are cut from the button (bump level) or by pushing a `vX.Y.Z` tag
whose version matches `app.json`. Both paths run the tests first. The APK is
built by EAS because that is where the upload keystore lives; CI cannot sign a
compatible one. Requires the `EXPO_TOKEN` secret.

## App variants

`app.config.js` layers on top of `app.json`. With `APP_VARIANT=development`
the app becomes `com.simoneb.violinskills.dev` with its own name and scheme, so
a dev build sits beside the released app instead of being refused for having a
different signing key — the only alternative being to uninstall, which takes the
user's practice history with it.

`expo run:android` **skips prebuild when `android/` already exists**, so
switching variants needs an explicit
`APP_VARIANT=development npx expo prebuild --platform android` first. Prebuild
clears `android/`, which deletes `local.properties`; recreate it (see the
README's Windows notes).

## Architecture

**One AudioContext for the whole app** (`src/audio/engine.ts`). Every generator
gets its own gain bus so volumes are independent, and the audio session is
configured in exactly one place. Do not create a second context.

**One OS media session** (`src/audio/now-playing.ts`). Drone and metronome
appear as a single "now playing" entry. On Android this notification is what
keeps the audio foreground service alive — without it playback dies shortly
after backgrounding — so **every audio source must register here**. Calls to the
OS are fire-and-forget behind a catch: a notification failure must never break
playback.

**Pitch detection** (`src/audio/pitch/tracker.ts`) runs the McLeod method via
`pitchy` on the JS thread. It is FFT-heavy, so it is throttled to ~10
readings/second; unthrottled it saturates the thread and the whole UI lags.
Readings pass a median spike filter, and readings close to a pitch the app is
itself emitting are discarded as speaker-to-mic leakage of the drone.

**`src/music/` is pure and unit-tested** — no React, no audio, no I/O. Note and
frequency maths, cents, scales, and just-intonation ratios live here. Changes to
this layer need tests alongside them; it is the only layer that is fully
testable.

**State** is zustand (`src/state/`), with settings persisted through
`expo-sqlite/kv-store`. A4 calibration lives in settings and is shared by the
drone, tuner, scales and intonation trainer.

**Persistence** is `expo-sqlite` (`src/db/`): practice-session spans and
per-note intonation scores. Tools open a span when they become active and close
it when they stop (`src/practice/log.ts`); the journal aggregates those spans.
Queries are synchronous on the JS thread, so screens defer them past
transitions with `InteractionManager`.

**Routing** is expo-router over `src/app/`. Routes reachable from Home but
absent from the tab bar (`intonation`, `journal`, `licenses`) are declared in
`src/components/app-tabs.tsx` with `href: null`.

## Gotchas

- **npm 11 is pinned in three places** — `packageManager`, `engines`, and the
  `eas-build-pre-install` hook — because npm 10 lays out peer-dep-only packages
  differently and `npm ci` then fails on a lockfile it did not write. CI
  installs npm 11 before `npm ci` for the same reason. Move all three together.
- **`src/constants/licenses.generated.json` is generated.** Re-run
  `npm run licenses:generate` when production dependencies change; the in-app
  attributions are a distribution obligation, not decoration.
- **`assets/` already exists** and holds app icons. Do not stage build output
  into it — the release workflow uses `release-assets/` after that collision
  shipped icon directories into a release.
- The app is AGPL-3.0 with contributions under a CLA; the name and icon artwork
  are deliberately **not** covered by that grant (see `NOTICE`).
- Deep-linking into a tab route with `am start -d` does not navigate and can
  leave the router on a blank screen; drive the UI by tapping instead.
