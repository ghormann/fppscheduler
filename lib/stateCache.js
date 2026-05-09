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
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_TMP, JSON.stringify(snapshot, null, 2), "utf8");
        fs.renameSync(CACHE_TMP, CACHE_FILE);
        console.log("[stateCache] Saved state to cache:", snapshot);
    } catch (e) {
        console.error("[stateCache] Failed to save cache:", e.message);
    }
}

function startPeriodicSave() {
    setInterval(save, 60000);
}

module.exports.load = load;
module.exports.save = save;
module.exports.startPeriodicSave = startPeriodicSave;
