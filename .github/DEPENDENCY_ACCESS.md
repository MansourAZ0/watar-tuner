# Private dependency access in CI

This repository checks out `MansourAz0-org/naghma-core` for its shared UI. Rust dependencies also use the private `naghma-core` and `pitchforge-rs` repositories.

The workflow's `GITHUB_TOKEN` is scoped to this repository and cannot grant access to the sibling private repositories. A missing dependency credential must fail before installation rather than silently falling back to that token.

Configure a fine-grained GitHub token with **Contents: read** access to:

- `MansourAz0-org/naghma-core`
- `MansourAz0-org/pitchforge-rs`

Grant only the repository access needed for these dependencies. Complete any organization approval required for the token.

Store the token under the same name, `DEPS_TOKEN`, in both:

1. This repository's **Settings > Secrets and variables > Actions**.
2. This repository's **Settings > Secrets and variables > Dependabot**.

Ordinary CI runs use the Actions secret. Dependabot-triggered runs use the Dependabot secret; they cannot read ordinary Actions secrets. An organization-level secret is also valid if it is shared with this repository in the appropriate secret category.

Never commit the token or print it in logs. After configuring access, rerun failed Dependabot CI and require frontend installation, type-checking, tests, audit, and build to pass before merging dependency updates.
