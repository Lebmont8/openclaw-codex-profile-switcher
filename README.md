# OpenClaw Codex Profile Switcher

A small OpenClaw plugin for selecting one of several Codex OAuth profiles from
Telegram while keeping automatic fallback available.

The important detail is how the selection is persisted: the chosen profile is
stored as a session preference with `authProfileOverrideSource: "auto"`. A hard
user pin would leave OpenClaw with only one candidate and break failover when
that account reaches its limit.

## Features

- `/profiles` menu with Telegram inline buttons
- any number of configured profiles from 2 to 8
- per-agent OpenClaw auth order
- session-level preferred profile
- automatic fallback to the remaining configured profiles
- `/profiles limits` provider probe through the official OpenClaw CLI
- no OAuth token handling in plugin code
- tests for ordering, atomic session updates, and lifecycle compatibility

## Requirements

- OpenClaw 2026.7.1 or newer
- the Codex/OpenAI provider configured in OpenClaw
- at least two OAuth profiles already authenticated

Check the profile IDs on your installation:

```bash
openclaw models auth --agent main order get --provider openai
```

## Install from GitHub

```bash
openclaw plugins install git:github.com/Lebmont8/openclaw-codex-profile-switcher
```

Add the plugin configuration to `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "codex-profiles": {
        "enabled": true,
        "config": {
          "provider": "openai",
          "profiles": [
            {
              "id": "openai:first@example.com",
              "label": "Primary"
            },
            {
              "id": "openai:second@example.com",
              "label": "Backup"
            }
          ]
        }
      }
    }
  }
}
```

Reload OpenClaw through the normal safe reload/restart path for your
installation. Then open Telegram and run:

```text
/profiles
/profiles status
/profiles limits
/profiles 2
/profiles auto
```

`/profiles 2` moves the second configured profile to the front of the agent's
auth order and stores it as the current session preference. The remaining
profiles stay in order as failover candidates.

## How it works

```text
Telegram /profiles 2
        |
        +--> openclaw models auth order set
        |       selected -> fallback 1 -> fallback 2
        |
        +--> atomic session patch
                authProfileOverride = selected
                authProfileOverrideSource = auto
```

The plugin uses `execFile`, not a shell, for CLI calls. Profile IDs are passed
as individual arguments and are never interpreted as shell input.

## Optional lifecycle compatibility patch

Some older Codex app-server integrations keep a thread bound to the OAuth
profile that created it. If switching the preference changes the order but the
next turn still resumes a thread from the previous account, inspect the
optional fail-closed compatibility helper:

```bash
node compat/apply-lifecycle-patch.mjs --check
node compat/apply-lifecycle-patch.mjs --apply
```

The helper only supports an exact known lifecycle bundle shape. It stops
without writing if an OpenClaw update changes that shape. It modifies installed
managed code, so use it only when the symptom is confirmed and re-check after
every OpenClaw update. The preferred long-term fix is an OpenClaw release that
rotates the persisted Codex thread binding natively.

## Development

```bash
npm run verify
npm pack --dry-run
```

The repository intentionally contains no account IDs, chat IDs, tokens,
databases, or machine-specific paths.

## License

MIT

## Verification scope

GitHub Actions runs the existing network-free checks on Node.js 22 and 24. These tests do not log into a provider, restart a Gateway, or prove compatibility with every OpenClaw release. Verify your installed runtime API before deployment; model identifiers in configuration examples must exist in your own account.
