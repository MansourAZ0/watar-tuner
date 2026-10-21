# Watar · وتر

A standalone, quarter-tone oud tuner for macOS (and, untested, Windows).
Watar listens through the microphone, detects the fundamental frequency with
our own YIN implementation, and shows the note in **fixed-Do solfège**
(Latin or Arabic script) with its deviation in cents — including
quarter-tones and lowered-tuning (−1, −2, custom) transposition.

Built with Tauri 2, Rust, React and TypeScript on top of two reusable
libraries:

| Library | Role |
|---------|------|
| [`pitchforge`](https://github.com/MansourAZ0/pitchforge-rs) | YIN pitch detection, framing, onset detection |
| [`naghma-core` / `naghma-audio`](https://github.com/MansourAZ0/naghma-core) | Solfège, 24-EDO, transposition, oud model, note tracking; CPAL capture + DSP thread |

## Features

- Real microphone input via CPAL; audio is analysed locally and never
  recorded or uploaded.
- Note names Do Re Mi Fa Sol La Si / دو ري مي فا صول لا سي with quarter-tone
  accidentals (drawn as SVG glyphs, or as words).
- **Player names vs. concert pitch**: on an oud tuned −2, playing the
  fingering you call Re4 shows **Re4** (sounding Do4 is shown alongside).
- 24-EDO (default) or 12-EDO grid, adjustable La4 reference (380–480 Hz).
- Smooth cents meter, frequency/target/confidence readouts, open-course
  strip that highlights the course you are tuning, recent-note trail.
- Procedural audio-reactive background (rings on plucks, particles on
  sustained notes, colour from pitch and tuning accuracy); full / reduced /
  off.
- English and Arabic interface with RTL layout; settings persist.
- Optional developer diagnostics (detection time, pipeline latency, buffer,
  dropped samples).
- Clearly labelled **simulation** mode for development without an
  instrument (never substituted for live audio silently).

## Development

Prerequisites: Rust ≥ 1.90, Node ≥ 20, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/),
and a checkout of [naghma-core](https://github.com/MansourAZ0/naghma-core)
next to this repository (the shared `@naghma/ui` package is a path
dependency: `../naghma-core/packages/naghma-ui`).

```sh
npm install
npm run tauri dev            # run the app
WATAR_AUTOSTART=simulation npm run tauri dev   # start in labelled simulation
npm test                     # Vitest (frontend logic)
cd src-tauri && cargo test   # Rust (settings, frame contract)
npm run tauri build -- --bundles app
```

The libraries are git dependencies pinned to tags. While the repositories
are private, Cargo needs `net.git-fetch-with-cli = true` in
`~/.cargo/config.toml`. To build against local checkouts of the libraries,
copy `.cargo/config.toml.example` to `.cargo/config.toml`.

### macOS microphone permission

The bundled app declares `NSMicrophoneUsageDescription` and the
`com.apple.security.device.audio-input` entitlement. When run with
`tauri dev`, macOS attributes the microphone request to the app that
launched it (Terminal, your IDE, …), and opening the device blocks until the
prompt is answered; Watar gives up after 20 s with a clear message.
If access was denied: System Settings → Privacy & Security → Microphone.

See [docs/PROGRESS.md](docs/PROGRESS.md) for status, measurements and known
limitations.

## License

MIT OR Apache-2.0.
