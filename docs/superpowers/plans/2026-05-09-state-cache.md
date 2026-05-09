# State Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist five critical MQTT-driven flags to `cache/state.json` so they survive Docker container restarts.

**Architecture:** A new `lib/stateCache.js` module exposes `load()`, `save()`, and `startPeriodicSave()`. `index.js` calls `load()` before MQTT init, registers SIGTERM/SIGINT handlers to save on shutdown, and starts the 60-second periodic save. `docker-compose.yml` gains a volume mount so the host-side cache directory survives rebuilds.

**Tech Stack:** Node.js 24, built-in `fs` module, existing `lib/model.js` data model.

> **Note:** This project has no test framework installed (`package.json` has no test runner). Tests are omitted; manual verification steps are provided instead.

---

### Task 1: Create `lib/stateCache.js`

**Files:**
- Create: `lib/stateCache.js`

- [ ] **Step 1: Create the file**

```javascript
"use strict";
const fs = require("fs");
const path = require("path");
const datamodel = require("./model.js");

const CACHE_FILE = path.join(__dirname, "../cache/state.json");
const CACHE_TMP  = CACHE_FILE + ".tmp";

const FIELDS = ["enabled", "tunnelEnabled", "shortList", "admin_song", "debug"];

function load() {
    try {
        const raw = fs.readFileSync(CACHE_FILE, "utf8");
        const saved = JSON.parse(raw);
        for (const key of FIELDS) {
            if (key in saved) {
                datamodel.current[key] = saved[key];
            }
        }
        console.log("[stateCache] Loaded state from cache:", saved);
    } catch (e) {
        if (e.code === "ENOENT") {
            console.log("[stateCache] No cache file found, using model defaults");
        } else {
            console.warn("[stateCache] Failed to load cache, using model defaults:", e.message);
        }
    }
}

function save() {
    const snapshot = {};
    for (const key of FIELDS) {
        snapshot[key] = datamodel.current[key];
    }
    try {
        fs.writeFileSync(CACHE_TMP, JSON.stringify(snapshot, null, 2), "utf8");
        fs.renameSync(CACHE_TMP, CACHE_FILE);
        console.log("[stateCache] Saved state to cache:", snapshot);
    } catch (e) {
        console.error("[stateCache] Failed to save cache:", e.message);
    }
}

function startPeriodicSave() {
    setInterval(save, 60000);
    console.log("[stateCache] Periodic save started (every 60s)");
}

module.exports.load = load;
module.exports.save = save;
module.exports.startPeriodicSave = startPeriodicSave;
```

- [ ] **Step 2: Commit**

```bash
git add lib/stateCache.js
git commit -m "feat: add stateCache module for persisting critical MQTT flags"
```

---

### Task 2: Wire `stateCache` into `index.js`

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Replace the contents of `index.js`**

```javascript
const model = require("./lib/model.js");
const playlist = require("./lib/playlist.js");
const scheduler = require("./lib/scheduler.js");
const tunnel = require("./lib/tunnelScheduler.js");
const mymqtt = require("./lib/mymqtt.js");
const stateCache = require("./lib/stateCache.js");

model.loadOverrides();
stateCache.load();

async function init() {
    mymqtt.init();
    publishPlaylist();
}

init();

async function publishPlaylist() {
    await playlist.refreshPlayList(); // Saves to data model
    mymqtt.publishPlaylist();
    tunnel.publishButtonMapping();
}

stateCache.startPeriodicSave();

process.on("SIGTERM", function () {
    console.log("[stateCache] SIGTERM received, saving state before exit");
    stateCache.save();
    process.exit(0);
});

process.on("SIGINT", function () {
    console.log("[stateCache] SIGINT received, saving state before exit");
    stateCache.save();
    process.exit(0);
});

setInterval(scheduler.doScheduleCheck, 500);
setInterval(tunnel.doTunnelCheck, 500);
setInterval(scheduler.doNameCheck, 1000);
setInterval(mymqtt.sendStatus, 5000); // OK
setInterval(mymqtt.notifyPlugs, 120000); // 120 seconds
setInterval(publishPlaylist, 120000); //120 seconds
setInterval(tunnel.publishButtonMapping, 120000); //120 seconds
```

- [ ] **Step 2: Commit**

```bash
git add index.js
git commit -m "feat: load and persist state cache on startup and shutdown"
```

---

### Task 3: Add volume mount to `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace the contents of `docker-compose.yml`**

```yaml
version: '3'

services:
  app:
    build: .
    restart: always
    env_file:
    - mqtt.env
    extra_hosts:
       xmas2204.hormann.local: 192.168.1.142
    volumes:
      - ./cache:/usr/src/app/cache
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: mount cache directory as volume for state persistence"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the service locally and confirm load log**

```bash
node index.js
```
Expected log line: `[stateCache] No cache file found, using model defaults`

- [ ] **Step 2: Publish a flag change via MQTT**

Publish `FALSE` to `/christmas/setActive` using any MQTT client (e.g. `mosquitto_pub`):
```bash
mosquitto_pub -h <MQTT_HOST> -u <USER> -P <PASS> -t /christmas/setActive -m FALSE
```
Expected console output: `Changing active status to  false  because of  FALSE`

- [ ] **Step 3: Wait up to 60 seconds and confirm save log**

Expected log line: `[stateCache] Saved state to cache: { enabled: false, ... }`

Or force an immediate save by sending SIGTERM:
```bash
kill -SIGTERM <PID>
```
Expected: `[stateCache] SIGTERM received, saving state before exit` then process exits.

- [ ] **Step 4: Confirm `cache/state.json` was written**

```bash
cat cache/state.json
```
Expected output (values reflect what was published):
```json
{
  "enabled": false,
  "tunnelEnabled": true,
  "shortList": false,
  "admin_song": null,
  "debug": false
}
```

- [ ] **Step 5: Restart the service and confirm load picks up saved state**

```bash
node index.js
```
Expected log line: `[stateCache] Loaded state from cache: { enabled: false, ... }`

- [ ] **Step 6: Build and test with Docker**

```bash
docker compose build
docker compose up -d
docker compose logs -f app
```
Expected: `[stateCache] Loaded state from cache:` (or `No cache file found`) with no errors.

Stop the container and confirm state persists on the host:
```bash
docker compose down
cat cache/state.json
docker compose up -d
docker compose logs app | grep stateCache
```
Expected: Loaded state line shows the previously saved values.
