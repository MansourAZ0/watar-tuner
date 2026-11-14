# Watar · وتر

A desktop oud tuner that understands quarter-tones and Arabic note names.

Play one note and Watar shows its name, frequency, and how sharp or flat it is.
Choose Latin solfège (Do Re Mi…) or Arabic (دو ري مي…). If your oud is tuned
lower, Watar can show the names you use while also showing the sounding notes.

**Early development.** macOS is the main development platform. Windows and
Linux source builds still need platform validation; signed public installers
are not provided by this source preparation.

## What you can do

- Tune with a 24-step quarter-tone grid or a 12-step semitone grid.
- Adjust the La4 reference from 380 to 480 Hz.
- Set transposition in semitones, whole tones, quarter-tones, or cents.
- Compare player names with concert pitch without changing the measured Hz.
- See a cents meter, open-course targets, confidence, and recent notes.
- Switch between English/Arabic, including right-to-left layout.
- Try a clearly labelled simulation without a microphone.

A cent is one hundredth of a semitone. Positive cents means sharp; negative
means flat. The example oud tuning is Do2–Fa2–La2–Re3–Sol3–Do4. It is not the
only valid oud tuning.

## Run from source

Install current stable Rust (the app declares 1.90+), Node 24+, and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
Linux also needs ALSA development headers.

The shared UI comes from a sibling `naghma-core` checkout. Clone these into the
same parent folder; use `v0.6.0` for Watar's current dependency contract:

```sh
git clone --branch v0.6.0 https://github.com/MansourAZ0/naghma-core.git
git clone https://github.com/MansourAZ0/watar-tuner.git
cd watar-tuner
npm ci --prefix ../naghma-core/packages/naghma-ui
npm ci
npm run tauri dev
```

Choose **Microphone** and start listening. Allow access if the operating system
asks. On macOS, check System Settings → Privacy & Security → Microphone if access
was denied. During development the request may be attributed to your terminal
or editor. Device opening times out after 20 seconds.

To start development in simulation mode:

```sh
WATAR_AUTOSTART=simulation npm run tauri dev
```

The autostart hook is disabled in release builds. Simulation always stays labelled.

## Privacy

Audio is analysed on your computer. The app does not record or upload it and
has no account or telemetry service. Preferences, including the selected audio
device identifier, are saved locally. Dependency downloads happen during setup,
not while you tune. See [security and privacy](SECURITY.md).

## How the projects fit together

| Repository | Role |
| --- | --- |
| [pitchforge-rs](https://github.com/MansourAZ0/pitchforge-rs) | Finds frequency with YIN. |
| [naghma-core](https://github.com/MansourAZ0/naghma-core) | Music theory, microphone pipeline and shared UI. |
| **watar-tuner** | The standalone tuner. This repository. |
| [Ajnas](https://github.com/MansourAZ0/Ajnas) | Practice, maqam teaching and optional camera support. |

Watar uses tagged `naghma-core`/`naghma-audio` **v0.6.0** and `pitchforge`
**v0.1.1**, recorded in `src-tauri/Cargo.lock`. It does not depend on Ajnas.
New fixes in those libraries require new dependency tags before reaching Watar.

## Limits

Use one clear note at a time. Background noise, overlapping strings, rapid
changes and harmonics can confuse the detector. Confidence is a measure of
periodicity, not a guarantee that the note is right. A quarter-tone grid is a
useful reference; it does not describe every maqam's performance intonation.

## Development

```sh
npm run typecheck
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
npm run tauri build -- --bundles app
```

The last command builds a macOS application bundle. Use an appropriate bundle
target when building on another OS. Local library overrides are explained in
[contributing](CONTRIBUTING.md).

## Credits and license

Pitch detection follows YIN by **Alain de Cheveigné and Hideki Kawahara**.
[Alessandro Genova's pitch-detection](https://github.com/alesgenova/pitch-detection)
is acknowledged as related Rust prior work. Quarter-tone notation, Arabic
solfège, transposition and oud targets come from this ecosystem's `naghma-core`;
Watar presents them as a tuner. See [credits](CREDITS.md).

Project code: [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
See [third-party notices](THIRD_PARTY_NOTICES.md).
