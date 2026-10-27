# Changelog

## [Unreleased]

### Security
- Update Tokio 1.54.0 to patched 1.54.1 (RUSTSEC-2026-0384).
- Limit the WATAR_AUTOSTART development hook to debug builds.

### Changed
- Install the sibling shared UI dependencies explicitly for reproducible clean builds.
- Align shared-UI CI and setup with the existing naghma v0.3.0 dependency tag.
- Use anonymous public dependency fetching and read-only workflow permissions.

### Added
- Accessible README, credits, privacy/contribution/release guides, audit, source
  exporter, secret/dependency checks and dependency update configuration.
