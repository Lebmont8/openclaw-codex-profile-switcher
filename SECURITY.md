# Security

## What this plugin stores

The plugin stores only an OpenClaw session preference containing a configured
profile ID. OAuth access and refresh tokens remain in OpenClaw's own auth store.
The plugin never reads token files, prints credentials, or commits auth data.

## Reporting a vulnerability

Please open a private GitHub security advisory instead of a public issue.

## Compatibility patch

The optional lifecycle compatibility helper modifies an installed
`@openclaw/codex` JavaScript bundle. It is fail-closed, validates the expected
bundle shape, writes atomically, and verifies its marker after replacement.
Run `--check` before `--apply`, keep a backup, and re-check after OpenClaw
updates. Do not use the helper when your OpenClaw version already starts a new
Codex thread after an auth-profile change.
