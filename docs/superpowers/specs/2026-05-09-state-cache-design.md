# State Cache Design

**Date:** 2026-05-09
**Status:** Approved

## Problem

When running as a Docker container, critical operational flags set via MQTT are lost on restart. Operators must manually re-publish these values each time the container restarts.

## Fields to Persist

All five fields are written to and read from the cache:

| Field | MQTT topic | Default |
|---|---|---|
| `current.enabled` | `/christmas/setActive` | `true` |
| `current.tunnelEnabled` | `/christmas/setActive/tunnel` | `true` |
| `current.shortList` | `/christmas/vote/setShortList` | `false` |
| `current.admin_song` | `/christmas/scheduler/setAdminSong` | `null` |
| `current.debug` | `/christmas/vote/debug` | `false` |

## Architecture

A new `lib/stateCache.js` module owns all persistence logic. It depends on `lib/model.js` and Node's built-in `fs` module only. `index.js` is the sole caller.

The cache file lives at `cache/state.json` relative to the project root.

## `lib/stateCache.js` API

### `load()`

Called once at startup, before `mymqtt.init()`, so the model is pre-populated before any MQTT messages arrive.

- Reads `cache/state.json` synchronously (safe at startup before event loop pressure).
- On success: patches the five fields on `datamodel.current` from the saved JSON.
- On missing file: logs a notice and proceeds with model defaults — not an error.
- On malformed JSON or unexpected error: logs a warning and proceeds with model defaults — no crash.

### `save()`

Writes the five fields as a JSON object to `cache/state.json`.

- Uses a write-then-rename pattern: writes to `cache/state.json.tmp` first, then renames to `cache/state.json`. This prevents a corrupt cache file if the process is killed mid-write.
- Logs errors but does not throw.

### `startPeriodicSave()`

Starts a `setInterval` at 60 seconds that calls `save()`.

## `index.js` Changes

1. `stateCache.load()` — called before `mymqtt.init()`.
2. `stateCache.startPeriodicSave()` — called after init.
3. `process.on('SIGTERM', ...)` — calls `stateCache.save()` then `process.exit(0)`.
4. `process.on('SIGINT', ...)` — calls `stateCache.save()` then `process.exit(0)`.

SIGTERM is the signal Docker sends when stopping a container (`docker stop`), so this ensures a clean final save on graceful shutdown.

## `docker-compose.yml` Change

Add a volume mount under the `app` service so the cache file survives container rebuilds:

```yaml
volumes:
  - ./cache:/usr/src/app/cache
```

The `cache/` directory already exists on the host and is already listed in `.gitignore`.

## Error Handling

- Missing cache file at startup: silent notice, use defaults.
- Malformed cache file at startup: warning log, use defaults.
- Failed write during periodic save: error log, no crash, retry on next interval.
- Failed write during shutdown: error log, exit proceeds.

## Out of Scope

- Persisting health timestamps, queue data, or `topVote` — these are ephemeral and regenerated from live MQTT traffic.
- Encryption or signing of the cache file.
