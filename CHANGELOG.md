# Changelog

## [Unreleased]

### Security
- Update Tokio 1.54.0 to patched 1.54.1 (RUSTSEC-2026-0384).
- Limit the WATAR_AUTOSTART development hook to debug builds.

### Changed
- naghma-core/naghma-audio v0.3.0 -> v0.6.0 and pitchforge v0.1.0 -> v0.1.1.
  Measured on recorded oud: a pluck's transient no longer shows as an extra
  note (9.1 -> 0.8 per minute), far fewer octave jumps (26.7 -> 5.4 per
  minute), notes appear about 20 ms sooner after a pluck (median 85 -> 64 ms
  in the library), plus the library safety fixes (invalid audio no longer
  stops analysis, extreme settings are rejected).
- The note history shows a note's corrected name when its pluck settles.
- Pressing Stop while the microphone is still opening (for example during
  the permission prompt) now really stops it; the replaced start shows no
  error.
- Install the sibling shared UI dependencies explicitly for reproducible clean builds.
- Align shared-UI CI and setup with the naghma dependency tag (now v0.6.0).
- Use anonymous public dependency fetching and read-only workflow permissions.

### Added
- Accessible README, credits, privacy/contribution/release guides, audit, source
  exporter, secret/dependency checks and dependency update configuration.
