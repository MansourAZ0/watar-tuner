# Contributing

Start with the README and [credits](CREDITS.md). Small bug fixes, clearer writing,
reproducible audio cases and musician-reviewed theory corrections are welcome.

1. Describe the problem and the expected behaviour in an issue or pull request.
2. Keep changes focused. Put general DSP in pitchforge, shared musical rules in
   naghma-core, and application-specific behaviour in the relevant app.
3. Add regression coverage for a behavioural fix. Prefer deterministic generated
   audio over private recordings. For musical data, include a source and explain
   whether it describes notation, a performance measurement, or a teaching choice.
4. Run the checks below. Include the commands and their results in the PR.

```sh
npm ci --prefix ../naghma-core/packages/naghma-ui
npm ci
npm run typecheck
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
```

Use current stable Rust and, for JavaScript packages, Node 24+. Install native
Tauri/ALSA prerequisites where applicable. Do not replace labelled simulation
with something presented as live audio. Preserve continuous pitch, exact custom
intervals, provenance, and the distinction between player and sounding names.

## Work on local library changes

Apps need `naghma-core` beside them for `@naghma/ui`. Use the tag documented in
the app's README for normal builds. Use a separate development checkout when
changing shared code. With Cargo, place optional overrides in the consuming
repository's ignored `.cargo/config.toml`:

```toml
[patch."https://github.com/MansourAz0-org/naghma-core"]
naghma-core = { path = "../naghma-core/crates/naghma-core" }
naghma-audio = { path = "../naghma-core/crates/naghma-audio" }

[patch."https://github.com/MansourAZ0/pitchforge-rs"]
pitchforge = { path = "../pitchforge-rs" }
```

For `naghma-core` itself, use only the pitchforge patch. Remove local overrides
before release validation, and do not commit path-resolved lockfiles. Keep
published dependencies pinned to immutable release tags; never move an existing
tag to incorporate a fix. The source libraries must be public before anonymous
contributors can fetch those tags. Private development can use your existing Git
credentials; public CI does not require a personal dependency token.

## Contributions and licensing

By submitting a contribution, you agree to offer it under the repository's
MIT OR Apache-2.0 terms, unless the contribution explicitly documents different
existing terms. Retain third-party notices. Please be respectful, describe
technical disagreements clearly, and avoid personal attacks. Report security
issues through [SECURITY.md](SECURITY.md).
