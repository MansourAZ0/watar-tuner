# Repository audit — 2026-10-27

Baseline commit: `d8bfccc8d060` plus the local preparation changes.

**Architecture: 8/10. Overall engineering maturity: 7/10.** Scores describe
the audited working source; public installer readiness is lower.

## Architecture

The app is a reasonably thin shell over naghma-audio and naghma-core. Rust owns
capture and interpretation, maps results into a display frame, and sends them
through Tauri channels. React displays tuning/settings; Canvas handles reactive
visuals. The app shares components rather than depending on Ajnas. Explicit
simulation labels and separate player/concert note names are strong choices.

Evidence: [audio integration](../src-tauri/src/audio.rs),
[frame contract](../src-tauri/src/frame.rs),
[settings](../src-tauri/src/settings.rs),
[frontend features](../src/features), [capabilities](../src-tauri/capabilities/default.json),
[CSP](../src-tauri/tauri.conf.json).

## Findings and changes

| Priority | Finding | Result |
| --- | --- | --- |
| High | Cargo.lock pinned Tokio 1.54.0, affected by RUSTSEC-2026-0384. | Updated to patched 1.54.1; tests and audit rerun. |
| Medium | Development autostart could also run in a release binary, including microphone mode. | Disabled the environment hook in release builds. |
| Medium | CI fetched shared UI at v0.2.0 while Rust used v0.3.0. | Aligned CI and README to v0.3.0. |
| High | Fresh app builds could not resolve React from the sibling UI source without its own dependency install. | Added a locked shared-UI install to setup instructions and CI; verified in isolated builds. |
| Medium | CI required a personal cross-repo dependency token. | Replaced with anonymous public Git fetches; added read-only workflow permissions. |
| Medium | New-user setup, attribution and privacy/release instructions were incomplete. | Rewritten README and added guides, notices, audits and update configuration. |
| Privacy | History includes personal email metadata. | Added history-free source export; history itself is unchanged. |

## Remaining risks and follow-up

- Both apps' Linux dependency graphs include GLib 0.18.5 through Tauri/GTK.
  [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
  flags unsound VariantStrIter methods; patched releases are 0.20+. This cannot
  be repaired by independently forcing an incompatible GLib version into the
  existing GTK graph. Resolve the framework dependency or review/backport the
  fix and validate Linux before claiming Linux distribution readiness.
- RustSec also flags the transitive `proc-macro-error` 1.0.4 as unmaintained.
  These warnings remain visible, not suppressed. No application exploit or
  reachability of the affected GLib method was established in this audit.
- Existing naghma v0.3.0 and pitchforge v0.1.0 tags do not contain the new library
  safety fixes. Release new tags and update the app, lockfile and CI together.
- AudioController/EngineSession lifecycle concurrency and settings failure
  reconciliation need dedicated integration testing. Source startup occurs
  outside EngineSession's state lock; the app's mode/presentation/settings use
  separate locks. This is a review concern, not a reproduced failure here.
- Frontend coverage is sparse: 3 tests do not validate full user flows. Add
  start/stop, denied-permission, device-removal, stale-frame and RTL interaction
  tests. Check keyboard use, screen readers and reduced-motion behaviour.
- Test physical oud accuracy and latency on supported devices; sign and verify
  release installers before distributing them.

## Validation

On macOS, Rust 1.99.1 and Node 26.12.1: **10 Rust + 3 frontend tests**, TypeScript,
production Vite build, Rust formatting and Clippy with warnings denied pass.
After the Tokio update, RustSec reports zero vulnerability-class findings, with
the two informational warnings above still present. npm audit reports zero known
vulnerabilities. Gitleaks 8.30.1 finds no credentials in scanned history or source.

No physical-device, packaged-release, Windows/Linux execution or hosted-CI pass
is claimed. See [release preparation](OPEN_SOURCE.md).
