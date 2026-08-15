# Violin Skills

Mobile practice companion for violinists: drones, tuner, metronome, scales with live
pitch feedback, an intonation trainer and an automatic practice journal.

**Website:** <https://simoneb.github.io/violin-skills/> — landing page and
[privacy policy](https://simoneb.github.io/violin-skills/privacy.html). The source
for both lives in [`docs/`](docs/) and is published with GitHub Pages.

Built with Expo (React Native) + TypeScript. The audio engine uses
[`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api)
(Web Audio API spec), so drone/metronome synthesis and mic capture follow the web
standard — which keeps an eventual web target cheap.

## Features

- **Drone** — 12 chromatic roots × octaves 2–5, open-string presets (G/D/A/E),
  optional perfect fifth, soft string/organ timbre with a slow breathing LFO.
  Keeps playing with the screen locked (Android foreground service).
- **Tuner** — McLeod pitch method (via `pitchy`) on live mic buffers, ~10 readings/s
  (MPM is FFT-heavy and runs on the JS thread), median spike filter + EMA-smoothed
  needle, open-string quick check.
- **Metronome** — lookahead scheduling on the audio clock (sample-accurate),
  30–240 BPM, tap tempo, time signatures, subdivisions, accented downbeats.
  Runs simultaneously with the drone.
- **Scales** — key + scale/arpeggio picker, tonic drone one tap away, live
  highlighting of the note you're playing with sharp/flat color coding.
- **Intonation trainer** — 10 target notes per session (open strings / 1st position /
  all positions), hold each note ~1 s, scored in cents (accuracy + steadiness),
  results persisted.
- **Practice journal** — tool usage is logged automatically; Home shows the day
  streak, weekly time per tool, latest intonation score and trouble notes.
- **A4 calibration** (415–444 Hz) shared by every tool.

## Development

```bash
npm install
npm run android        # build + install on a connected Android device
npm test               # unit tests (music-theory core)
npm run typecheck
```

The native build is required (dev client, not Expo Go) because of
`react-native-audio-api`. For iterating on JS/TS only, `npx expo start` and press
`a` once the dev build is installed.

### Windows build notes

- Gradle needs a JDK: set `JAVA_HOME` to Android Studio's bundled JBR
  (`C:\Program Files\Android\Android Studio\jbr`) or install a JDK 17+.
- `android/local.properties` must point at the Android SDK
  (`sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`).
- `react-native-audio-api` downloads prebuilt binaries in a bash script during the
  Gradle build. When Gradle invokes Git's `bash.exe` directly, Git's `/usr/bin` is
  not on `PATH`, so the script dies with exit 127. The local config plugin
  `plugins/with-audioapi-windows-fix.js` prepends Git's tool directories to that
  task's `PATH` (applied to `android/build.gradle`; re-applied automatically on
  `expo prebuild`).

## Architecture

```
src/
├── app/            # expo-router screens (tabs + hidden /intonation route)
├── audio/          # UI-independent audio: engine (shared AudioContext/session),
│   └── pitch/      # drone synth, metronome scheduler, mic pitch tracker
├── music/          # pure music theory: note<->freq, cents, scales (unit-tested)
├── practice/       # intonation session engine, practice-time logging
├── state/          # zustand stores (settings, drone, tuner, metronome)
├── db/             # expo-sqlite: sessions + intonation results
└── components/     # tuner gauge, chip row, themed primitives
```

## Privacy

Everything about you stays on the device. Microphone audio is analysed in memory for
pitch detection and never recorded, stored or transmitted; practice history lives in a
local SQLite database. There are no accounts, no analytics and no ads.

The one network request the app makes is an over-the-air update check against
`u.expo.dev` — see [the privacy policy](docs/privacy.html) for what that involves.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Contributions must be signed off, which accepts the [CLA](CLA.md).

## License

Violin Skills is free software, licensed under the
[GNU Affero General Public License v3](LICENSE).

The **name and artwork are not covered by that license**. You may build, modify
and redistribute the code freely, but a publicly distributed fork must use a
different name and different icons — see [NOTICE](NOTICE) for the details and
for third-party attributions.

The builds published to app stores are distributed by the copyright holder under
separate terms.
