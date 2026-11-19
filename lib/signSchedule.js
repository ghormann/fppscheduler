/**
 * signSchedule — daily power schedule for the tunnel info sign (FPP_TUNNEL_SIGN),
 * which is powered by smart plug plug-aux2.
 *
 * All times are server-local (production runs with TZ=America/New_York).
 *
 *   09:00 – 09:05  SHUTDOWN  plug stays on; send FPP a clean system shutdown
 *   09:05 – 16:55  OFF       plug is held off
 *   all other      ON        plug is held on
 *
 * The sign's SCHEDULER_NO_FPP_ warning is suppressed from 09:00 to 17:10,
 * which covers the shutdown and a boot grace period after power returns.
 *
 * Pure functions only — no requires — so mymqtt.js can depend on this module
 * without a circular import.
 */
"use strict";

const SIGN_PLUG = "plug-aux2";
const SIGN_PLAYER_ID = "FPPTunnelSign";

const SHUTDOWN_START = 9 * 60; // 09:00
const OFF_START = 9 * 60 + 5; // 09:05
const ON_START = 16 * 60 + 55; // 16:55
const WARN_RESUME = 17 * 60 + 10; // 17:10

function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
}

/**
 * Returns the sign's phase at `date`: "SHUTDOWN", "OFF" or "ON".
 * @param {Date} [date]
 */
function getSignPhase(date = new Date()) {
    const m = minutesOfDay(date);
    if (m >= SHUTDOWN_START && m < OFF_START) return "SHUTDOWN";
    if (m >= OFF_START && m < ON_START) return "OFF";
    return "ON";
}

/** True while the sign is expected to be offline, so its FPP warning is suppressed. */
function isSignWarningSuppressed(date = new Date()) {
    const m = minutesOfDay(date);
    return m >= SHUTDOWN_START && m < WARN_RESUME;
}

module.exports = {
    SIGN_PLUG,
    SIGN_PLAYER_ID,
    getSignPhase,
    isSignWarningSuppressed,
};
