# fppscheduler

A Node.js-based scheduler that runs alongside [FPP (Falcon Player)](https://github.com/FalconChristmas/fpp) to automate Christmas light show playlists with interactive audience voting. It integrates with [Christmas-Vote-now](https://github.com/ghormann/Christmas-Vote-now) to let visitors vote for songs, and manages intros, bumpers, name/wish playback, midnight countdowns, and tunnel/button-pad light sequences.

> **Note:** This project was built for a personal display and will require code changes to adapt for other setups.

---

## Architecture

The system controls multiple FPP instances over HTTP and communicates with other services via MQTT:

- **Main display FPP** (`FPP_HOST`) — primary light show player
- **Tunnel FPP** (`FPP_TUNNEL`) — separate tunnel display driven by button presses
- **Info sign FPP** (`FPP_TUNNEL_SIGN`) — displays stats and name estimates

Key source files:

| File                     | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `index.js`               | Entry point; sets up polling intervals                     |
| `lib/scheduler.js`       | Core scheduling logic (vote queue, intros, bumpers, names) |
| `lib/tunnelScheduler.js` | Tunnel display and button-pad sequencing                   |
| `lib/mymqtt.js`          | MQTT subscriptions and message handlers                    |
| `lib/playlist.js`        | Fetches available playlists from FPP via HTTP              |
| `lib/model.js`           | In-memory state (votes, name queue, health metrics)        |
| `lib/fpp.js`             | HTTP API wrapper for controlling FPP instances             |

---

## Setup

1. This runs as a Docker container (or standalone Node.js process) and connects to your FPP boxes over the network. It supports both Pi and BeagleBone Black FPP installs; requires **FPP 4.1 or later**.

2. In FPP, give each playlist a **description** — this is the display name shown on the voting website.

3. In FPP settings, configure the MQTT prefix to `christmas/` (the scheduler expects this prefix on all topics).

4. Copy `mqtt.env.sample` to `mqtt.env` and fill in your values:

   | Variable          | Description                               |
   | ----------------- | ----------------------------------------- |
   | `MQTT_HOST`       | MQTT broker hostname or IP                |
   | `MQTT_PORT`       | MQTT broker port (usually `1883`)         |
   | `MQTT_USERNAME`   | MQTT username                             |
   | `MQTT_PASSWORD`   | MQTT password                             |
   | `FPP_HOST`        | Main FPP box IP (e.g. `192.168.1.2`)      |
   | `FPP_TUNNEL`      | Tunnel FPP box IP (e.g. `192.168.1.3`)    |
   | `FPP_TUNNEL_SIGN` | Info sign FPP box IP (e.g. `192.168.1.4`) |
   | `TZ`              | Timezone (e.g. `America/New_York`)        |

5. Edit `lib/model.js` to set `internal_songs` — the list of playlist names that the scheduler manages internally (intros, bumpers, donation reminders, etc.). Use an empty array to always play the top-voted song.

6. If you use the **short show** feature, edit `lib/mode.js` with the playlists to use during short-show mode.

---

## Running

### Docker (recommended)

```sh
docker compose up -d
```

### Standalone

```sh
npm install
node .
```

---

## Scheduling Logic

Each cycle (~500 ms), the scheduler decides what to play next in this priority order:

1. **Admin override** — play the song set via `scheduler/setAdminSong`
2. **Name/wish ready** — play the next name from the name generator queue
3. **Scheduled internal content** — intros, bumpers, donation reminders, goodnight sequences (triggered by time-based intervals)
4. **Top voted song** — play the highest-voted song from `vote/songQueue`
5. **Random song** — if no votes exist, pick a random available playlist

The scheduler only activates during [display hours](docs/mqtt-topics.md#display-hours).

### Internal Playlists

Playlists with names starting with `Internal_` are managed by the scheduler and never shown to voters. Expected names:

| Playlist              | Triggered                                    |
| --------------------- | -------------------------------------------- |
| `Internal_Intro`      | Every 25 minutes                             |
| `Internal_Driveway`   | Every 25 minutes                             |
| `Internal_Donate`     | Every 15 minutes                             |
| `Internal_TuneTo`     | Every 10 minutes                             |
| `Internal_Short_Show` | Every 10 minutes (short show mode)           |
| `Internal_Wish_Name`  | When a name is ready from the queue          |
| `Internal_Good_Night` | Before shutting down at end of display hours |
| `Internal_Midnight`   | At midnight                                  |
| `Internal_off`        | Idle / display off state                     |

Playlists starting with `Test` are also hidden from voters.

---

## MQTT Topics

See **[docs/mqtt-topics.md](docs/mqtt-topics.md)** for the full topic reference including payload formats, error codes, and display-hours schedule.

---

## Docker Repository

This project is automatically built and published as a Docker image via GitHub Actions.

### Semantic Versioning

| Commit style                                                   | Version bump     |
| -------------------------------------------------------------- | ---------------- |
| Any commit to main                                             | Patch (`x.x.+1`) |
| Message starts with `feat:` or `feat(`                         | Minor (`x.+1.0`) |
| Message contains `BREAKING CHANGE` or uses `!` (e.g. `feat!:`) | Major (`+1.0.0`) |

### Manual Releases

1. Go to the **Actions** tab in GitHub
2. Select **Create Release**
3. Choose version type (patch / minor / major) and whether it is a pre-release
4. Click **Run workflow**

This updates `package.json`, creates a git tag, generates a changelog release, and triggers the Docker build.

### Available Docker Tags

| Tag      | Description            |
| -------- | ---------------------- |
| `latest` | Latest build from main |
| `vX.Y.Z` | Exact version          |
| `vX.Y`   | Major.minor            |
| `vX`     | Major only             |
