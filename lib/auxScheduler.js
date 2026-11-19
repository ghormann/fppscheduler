/**
 * auxScheduler — runs once a minute to power-cycle the tunnel info sign
 * (FPP_TUNNEL_SIGN) on plug-aux2, following the daily schedule in signSchedule.js:
 *
 *   SHUTDOWN (09:00–09:05)  ask the sign's FPP to shut down; plug stays on
 *   OFF      (09:05–16:55)  tell plug-aux2 "off" every run
 *   ON       (otherwise)    tell plug-aux2 "on" every run
 *
 * Commands are re-sent every run (not only on a change) so the plug recovers
 * from missed messages, restarts or manual toggles within one minute.
 */
"use strict";
const fpplib = require("./fpp.js");
const mymqtt = require("./mymqtt.js");
const signSchedule = require("./signSchedule.js");

const sign = new fpplib.FPPApi(process.env.FPP_TUNNEL_SIGN);

async function doAuxCheck(now = new Date()) {
    const phase = signSchedule.getSignPhase(now);
    if (phase === "SHUTDOWN") {
        mymqtt.setPlug(signSchedule.SIGN_PLUG, "on");
        await sign.systemShutdown();
    } else if (phase === "OFF") {
        mymqtt.setPlug(signSchedule.SIGN_PLUG, "off");
    } else {
        mymqtt.setPlug(signSchedule.SIGN_PLUG, "on");
    }
    return phase;
}

module.exports.doAuxCheck = doAuxCheck;
