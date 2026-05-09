# MQTT Topics Reference

All topics assume FPP has been configured with `christmas/` as the MQTT prefix. Topic paths shown below include that prefix.

---

## Subscribed Topics (Inputs)

### `/christmas/vote/songQueue`

Song queue from the voting system, ordered by vote count descending.

**Payload:** JSON array

```json
[
  { "playlist": "Jingle Bells", "votes": 12 },
  { "playlist": "Rudolph", "votes": 7 }
]
```

---

### `/christmas/vote/setShortList`

Enables or disables "short show" mode, which limits playback to a curated list of shorter playlists.

**Payload:** String — `"TRUE"` or `"FALSE"`

---

### `/christmas/vote/debug`

Forces display-hours logic to treat the current time as active (useful for testing outside normal show hours).

**Payload:** String — `"TRUE"` or `"FALSE"`

---

### `/christmas/vote/stats`

Button press statistics used to display leaderboards on the tunnel info sign.

**Payload:** JSON object

```json
{
  "topButton_12hr": [{ "color": "Blue", "count": 42 }, ...],
  "topButton_year": [{ "color": "Green", "count": 300 }, ...]
}
```

---

### `/christmas/nameQueue`

Current name/wish queue status from the name generator service.

**Payload:** JSON object

```json
{
  "low": ["Name1"],
  "normal": ["Name2", "Name3"],
  "ready": ["Name4"],
  "status": "idle"
}
```

---

### `/christmas/scheduler/requestSongs`

Triggers the scheduler to immediately re-publish its playlist lists (both public and internal). Useful for downstream services that just came online.

**Payload:** Any (content ignored)

---

### `/christmas/scheduler/setAdminSong`

Admin override that forces the next scheduled playlist to be a specific song, bypassing the vote queue.

**Payload:** String — playlist name (must match an FPP playlist name exactly)

---

### `/christmas/clock`

Countdown clock value used for midnight sequences. Published by a separate clock service.

**Payload:** Integer — milliseconds remaining until midnight

---

### `/christmas/setActive`

Master enable/disable switch for the scheduler. When `FALSE`, the scheduler will not start new playlists.

**Payload:** String — `"TRUE"` or `"FALSE"`

---

### `/christmas/setActive/tunnel`

Enable/disable switch for the tunnel scheduler only. When `FALSE`, the tunnel scheduler will not start new sequences, even if the master `setActive` is `TRUE`. Both this flag and `/christmas/setActive` must be `TRUE` for the tunnel to run.

Defaults to `TRUE` on startup.

**Payload:** String — `"TRUE"` or `"FALSE"`

---

### `/christmas/namechecker/health`

Heartbeat from the name checker/text server service. Absence for >90 seconds raises `SCHEDULER_NO_TEXT_SERVER`.

**Payload:** Any (content ignored)

---

### `/christmas/falcon/player/+/fppd_status`

FPP status heartbeat from any player (wildcard `+` matches the player ID). Used to detect when a player goes offline.

Absence for >180 seconds raises `SCHEDULER_NO_FPP_{playerId}`.

**Payload:** FPP status JSON (standard FPP MQTT status format)

---

### `/christmas/falcon/player/FPPTunnel1/#`

All MQTT messages from the tunnel FPP player. Used to monitor tunnel health.

Absence for >30 seconds raises `SCHEDULER_NO_TUNNEL`.

**Payload:** Varies by subtopic (standard FPP MQTT format)

---

### `/christmas/falcon/player/FPPButton/#`

All MQTT messages from the button pad FPP player. Used to monitor button pad health.

Absence for >30 seconds raises `SCHEDULER_NO_BUTTON`.

**Payload:** Varies by subtopic (standard FPP MQTT format)

---

### `/christmas/FPPButton/{color}`

Physical button press events from the button pad. Triggers a color-themed light sequence on the tunnel display.

**Topic variants:** `Blue`, `Green`, `Red`, `White`, `Yellow`

**Payload:** Any (content ignored; topic suffix determines color)

---

## Published Topics (Outputs)

### `/christmas/scheduler/status`

Full system state snapshot published every 5 seconds. Contains the current song, scheduler flags, health status, and any active error conditions.

**Payload:** JSON object (all fields from `model.current`)

```json
{
  "status": "ALL_OK",
  "admin_song": null,
  "song": "Jingle Bells",
  "current_sequence": "Jingle_Bells",
  "seconds_remaining": 142,
  "lastNameGen": "2024-12-15T20:01:00.000Z",
  "lastNamePlay": "2024-12-15T19:45:00.000Z",
  "isDisplayHours": true,
  "idleDate": "2024-12-15T20:00:00.000Z",
  "nameStatus": "idle",
  "enabled": true,
  "tunnelEnabled": true,
  "debug": false,
  "shortList": false
}
```

**Field descriptions:**

| Field               | Type           | Description                                                              |
| ------------------- | -------------- | ------------------------------------------------------------------------ |
| `status`            | string         | `"ALL_OK"` or comma-separated error codes (see below)                    |
| `admin_song`        | string \| null | Currently set admin override playlist name, or `null` if none            |
| `song`              | string         | Name of the playlist currently playing                                   |
| `current_sequence`  | string         | Name of the sequence currently running on FPP                            |
| `seconds_remaining` | number         | Seconds left in the current playlist                                     |
| `lastNameGen`       | ISO timestamp  | When the name generator last produced a name                             |
| `lastNamePlay`      | ISO timestamp  | When a name playlist was last played                                     |
| `isDisplayHours`    | boolean        | Whether the scheduler currently considers itself in active display hours |
| `idleDate`          | ISO timestamp  | When the scheduler last detected an idle (no song playing) condition     |
| `nameStatus`        | string         | Status string from the name queue service                                |
| `enabled`           | boolean        | Whether the scheduler is enabled (controlled by `setActive`)             |
| `tunnelEnabled`     | boolean        | Whether the tunnel scheduler is enabled (controlled by `setActive/tunnel`) |
| `debug`             | boolean        | Whether debug mode is on (controlled by `vote/debug`)                    |
| `shortList`         | boolean        | Whether short-show mode is active (controlled by `vote/setShortList`)    |

**`status` error codes:**

| Code                        | Condition                                                    |
| --------------------------- | ------------------------------------------------------------ |
| `ALL_OK`                    | No errors                                                    |
| `SCHEDULER_RECENT_CRASH`    | Scheduler restarted within the last 60 seconds               |
| `SCHEDULER_NO_NAME_QUEUE`   | Name queue service unresponsive for >35 seconds              |
| `SCHEDULER_IDLE_ERROR`      | No song scheduled for >10 seconds during display hours       |
| `SCHEDULER_NO_VOTE`         | Voting service unresponsive for >30 seconds                  |
| `SCHEDULER_NAME_PLAY_ERROR` | Names not playing during display hours for >45 minutes       |
| `SCHEDULER_NAME_GEN_ERROR`  | Name generation offline for >45 minutes during display hours |
| `SCHEDULER_NO_CLOCK`        | Countdown clock unresponsive for >20 seconds                 |
| `SCHEDULER_NO_TEXT_SERVER`  | Name checker service offline for >90 seconds                 |
| `SCHEDULER_NO_TUNNEL`       | Tunnel FPP offline for >30 seconds                           |
| `SCHEDULER_NO_BUTTON`       | Button pad FPP offline for >30 seconds                       |
| `SCHEDULER_NO_FPP_{id}`     | Named FPP player offline for >180 seconds                    |

---

### `/christmas/scheduler/all_playlist`

Publicly votable playlists. Published every 120 seconds and on demand (via `requestSongs`). Excludes any playlist whose name starts with `Test` or `Internal`.

**Payload:** JSON array of playlist objects

```json
[
  { "name": "Jingle Bells", "description": "A classic holiday tune" },
  ...
]
```

---

### `/christmas/scheduler/all_playlist_internal`

Internal/system playlists (intros, bumpers, goodnight sequences, etc.). Published alongside `all_playlist` every 120 seconds and on demand.

**Payload:** JSON array of playlist objects (same structure as `all_playlist`)

---

### `/christmas/scheduler/button_mapping`

Maps each button color to the tunnel light sequences available for that color. Published every 120 seconds.

**Payload:** JSON object

```json
{
  "Blue": ["Blue_Sequence_1", "Blue_Sequence_2"],
  "Green": ["Green_Sequence_1"],
  "Red": ["Red_Sequence_1"],
  "White": ["White_Sequence_1"],
  "Yellow": ["Yellow_Sequence_1"]
}
```

---

### `/christmas/scheduler/name_estimate`

Estimated wait time until the next name/wish playback. Published approximately every second during display hours.

**Payload:** JSON object

```json
{
  "estimated_seconds": 180,
  "message": "Your name will play in about 3 minutes"
}
```

---

### `/christmas/scheduler/fpp_playlist_action`

Published each time the scheduler starts a new playlist. Useful for logging and dashboards.

**Payload:** JSON object

```json
{
  "device": "main",
  "playlist": "Jingle Bells",
  "reason": "top_vote"
}
```

---

### `/christmas/nameAction`

Commands sent to the name generator service.

**Payload:** String

| Value                 | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `"GENERATE"`          | Generate a standard name/wish for playback |
| `"GENERATE_MIDNIGHT"` | Generate a midnight-specific name sequence |
| `"RESET"`             | Clear/reset the name queue                 |

---

## Smart Plug Topics

These topics control smart plugs (Shelly or compatible) that power physical display components. They are published when display hours start and stop.

| Topic                           | Controls                 |
| ------------------------------- | ------------------------ |
| `plug-radio/command/switch:0`   | FM transmitter / radio   |
| `plug-buttons/command/switch:0` | Button pad hardware      |
| `plug-aux1/command/switch:0`    | Auxiliary power switch 1 |
| `plug-aux2/command/switch:0`    | Auxiliary power switch 2 |

**Payload:** String — `"on"` or `"off"`

---

## Display Hours

The scheduler only activates during the following windows:

| Period                  | Hours                                      |
| ----------------------- | ------------------------------------------ |
| Daily (season)          | 6:00 AM – 9:00 AM and 5:00 PM – 11:00 PM   |
| Christmas Eve (Dec 24)  | After 5:00 PM                              |
| Christmas Day (Dec 25)  | 12:00 AM – 1:00 AM                         |
| New Year's Eve (Dec 31) | After 5:00 PM                              |
| New Year's Day (Jan 1)  | 12:00 AM – 1:00 AM                         |
| Debug mode              | Always active (when `vote/debug` = `TRUE`) |
