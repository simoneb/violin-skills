# Contributing to Violin Skills

Bug reports, feature ideas and pull requests are welcome. This is a small
project maintained in spare time, so please open an issue before starting
anything large — it saves you from building something that doesn't fit.

## Before your first pull request

This project is AGPL-3.0 licensed, and the store builds are distributed under
separate terms. Every contribution therefore needs to be covered by the
[Contributor License Agreement](CLA.md). You accept it by signing off your
commits:

```bash
git commit --signoff -m "Add tap-tempo hold gesture"
```

Pull requests whose commits are not signed off can't be merged. If you forgot,
`git rebase --signoff main` fixes the whole branch.

## Development setup

```bash
npm install
npm run android        # build + install on a connected Android device
```

A native dev build is required — Expo Go will not work, because
`react-native-audio-api` is a native module. Once the dev client is installed,
`npx expo start` and pressing `a` is enough for JS/TS-only iteration.

Windows-specific build notes (JDK, SDK path, the Git bash `PATH` fix) are in the
[README](README.md#windows-build-notes).

## Before you push

```bash
npm test               # unit tests (music-theory core)
npm run typecheck
npm run lint
```

All three must pass. The music theory in `src/music/` is pure and unit-tested —
if you change note/frequency/cents maths, add a test alongside it.

## Guidelines

- **Match the surrounding code.** Same naming, same file layout, same comment
  density. The architecture map in the README explains what belongs where.
- **Keep audio off the JS thread.** Scheduling is done on the audio clock with
  lookahead; anything that adds per-frame JS work in the audio path needs a
  measurement to justify it.
- **Keep `src/music/` pure.** No React, no audio API, no I/O — it's the one
  layer that's fully testable, and it should stay that way.
- **One concern per pull request.** Unrelated cleanups in the same branch make
  review slower, not faster.

## Reporting bugs

Include your device and OS version, the app version, and — for audio issues —
whether the app was in the foreground, backgrounded, or the screen was locked.
Audio bugs are frequently lifecycle bugs.

## Security

Please do not open a public issue for a security problem. Email the address on
the maintainer's GitHub profile instead.
