# Progress

_Last updated: 2026-10-21_

## Working (verified)

| Area | Evidence |
|------|----------|
| Tauri 2 app launches, React UI renders | Run with `tauri dev` on macOS 26 (Apple M2); screenshots taken |
| Live analysis pipeline end-to-end | Simulation source through CPAL-equivalent ring buffer → YIN → tracker → Channel → UI (Fa3, Mi4/Re4 at −2, Si half-flat 3 shown correctly) |
| Player vs. concert names under transposition | Rust tests (`frame.rs`) + visual check |
| Arabic interface, RTL, Arabic note names, Arabic-Indic digits | Visual check |
| Settings persistence (atomic JSON, forward compatible) | Rust tests |
| Frontend logic | 13 Vitest tests |

## Not yet verified

- **Live microphone in the app.** The CPAL path is implemented and device
  enumeration works, but opening the microphone from a terminal-launched
  process waits on the macOS permission prompt. Needs a manual run of the
  bundled `Watar.app`.
- **Real oud recordings.** Accuracy has only been measured on synthetic
  signals. Use `naghma-audio`'s `analyze_wav` example on recordings.
- **Windows.** Not built or tested.
- Settings screen and diagnostics panel have been type-checked but not yet
  visually reviewed.

## Measurements (synthetic, Apple M2)

- YIN (FFT) per 4096-sample window: ~38 µs; full analysis frame incl.
  tracker ≈ 100–150 µs.
- Onset → note shown (algorithmic): 48–56 ms with 4096/512 at 48 kHz, plus
  device buffering (pipeline latency measured at 0–5 ms in simulation).
- See pitchforge `docs/benchmarks.md` for accuracy tables.

## Known limitations

- Single monophonic note assumed; strings left ringing can dominate.
- Windows that straddle a note change can report an in-between pitch; the
  tracker suppresses most of these but very fast passages may lag.
- Only the example 6-course oud profile; course editing UI not built yet.
- Custom intonation profiles exist in `naghma-core` but are not selectable
  in the UI yet (24/12-EDO only).
- Musical terminology choices listed in naghma-core `docs/PROVISIONAL.md`
  await confirmation.

## Next

1. Manual microphone test of the bundled app; record oud samples and run
   `analyze_wav`; tune tracker defaults from real data.
2. Instrument profile editor (courses, scale length, per-course cents).
3. Intonation-profile selection once validated profiles exist.
4. Windows build.
