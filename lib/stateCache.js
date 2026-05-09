/**
 * stateCache — persists critical MQTT-driven flags across process restarts.
 *
 * On startup, call load() to restore previously saved state into the data model.
 * On shutdown (SIGTERM/SIGINT), call save() to flush current state to disk.
 * Call startPeriodicSave() to also checkpoint state every 60 seconds at runtime,
 * so a crash loses at most one minute of state changes.
 *
 * The cache file is written atomically via a temp-file rename to prevent
 * corruption if the process is killed mid-write.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const datamodel = require("./model.js");

const CACHE_FILE = path.join(__dirname, "../cache/state.json");
const CACHE_TMP  = CACHE_FILE + ".tmp";

/** Fields from datamodel.current that are persisted across restarts. */
const FIELDS = ["enabled", "tunnelEnabled", "shortList", "admin_song", "debug"];

/**
 * Reads the cache file and restores saved field values into datamodel.current.
 * Silently skips missing fields so new fields default from the model.
 * A missing cache file is normal on first run and is handled gracefully.
 */
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

/**
 * Writes a snapshot of the tracked fields from datamodel.current to disk.
 * Uses a temp-file + rename for atomic writes to avoid partial/corrupt files.
 */
function save() {
    const snapshot = {};
    for (const key of FIELDS) {
        snapshot[key] = datamodel.current[key];
    }
    try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_TMP, JSON.stringify(snapshot, null, 2), "utf8");
        fs.renameSync(CACHE_TMP, CACHE_FILE);
        console.log("[stateCache] Saved state to cache:", snapshot);
    } catch (e) {
        console.error("[stateCache] Failed to save cache:", e.message);
    }
}

/**
 * Schedules save() to run every 60 seconds so state is checkpointed
 * periodically, limiting data loss to one minute on an unclean shutdown.
 */
function startPeriodicSave() {
    setInterval(save, 60000);
}

module.exports.load = load;
module.exports.save = save;
module.exports.startPeriodicSave = startPeriodicSave;
