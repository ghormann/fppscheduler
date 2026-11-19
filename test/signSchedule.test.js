"use strict";
const { getSignPhase, isSignWarningSuppressed } = require("../lib/signSchedule.js");

const at = (h, m) => new Date(2026, 10, 19, h, m);

describe("getSignPhase", () => {
    test.each([
        [0, 0, "ON"],
        [8, 59, "ON"],
        [9, 0, "SHUTDOWN"],
        [9, 4, "SHUTDOWN"],
        [9, 5, "OFF"],
        [12, 0, "OFF"],
        [16, 54, "OFF"],
        [16, 55, "ON"],
        [23, 59, "ON"],
    ])("%i:%i → %s", (h, m, phase) => {
        expect(getSignPhase(at(h, m))).toBe(phase);
    });
});

describe("isSignWarningSuppressed", () => {
    test.each([
        [8, 59, false],
        [9, 0, true],
        [13, 0, true],
        [17, 9, true],
        [17, 10, false],
        [22, 0, false],
    ])("%i:%i → %s", (h, m, expected) => {
        expect(isSignWarningSuppressed(at(h, m))).toBe(expected);
    });
});
