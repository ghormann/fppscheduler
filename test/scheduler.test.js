"use strict";

jest.mock("../lib/fpp.js", () => ({
    FPPApi: jest.fn().mockImplementation(() => ({
        getFppStatus: jest.fn().mockResolvedValue({
            current_playlist: { playlist: "Internal_off", count: "0", type: "" },
            seconds_remaining: 0,
        }),
        playNow: jest.fn().mockResolvedValue({}),
    })),
}));

jest.mock("../lib/mymqtt.js", () => ({
    sendNameEstimates: jest.fn(),
    sendNameAction: jest.fn(),
    notifyPlugs: jest.fn(),
}));

// Build the model mock with mutable properties so individual tests can adjust them
const mockModel = {
    current: {
        enabled: true,
        tunnelEnabled: true,
        shortList: false,
        admin_song: null,
        debug: false,
        isDisplayHours: false,
        nameStatus: "IDLE",
        song: "",
        lastNameGen:  new Date(Date.now() - 60000),
        lastNamePlay: new Date(Date.now() - 60000),
        idleDate: new Date(),
        sequence: "",
    },
    clock:     { time: 600, startedMidnight: false, lastUpdate: new Date() },
    health:    { lastSend: 0 },
    nameQueue: { status: "IDLE", normal: [], low: [], ready: [] },
    all_playlists: [{ name: "Song_A" }, { name: "Song_B" }],
    topVote: "",
    playGoodnight: false,
    seconds_remaining: 0,
    internal_songs: [
        { playlist: "Internal_Driveway", next: new Date(Date.now() - 10000), frequency_min: 25, enabled: true },
        { playlist: "Internal_Donate",   next: new Date(Date.now() + 999999), frequency_min: 15, enabled: true },
    ],
};

jest.mock("../lib/model.js", () => mockModel);

const scheduler = require("../lib/scheduler");
const dataModel  = require("../lib/model.js");
const mymqtt     = require("../lib/mymqtt.js");

beforeEach(() => {
    jest.clearAllMocks();
    dataModel.current.song  = "";
    dataModel.current.debug = false;
    dataModel.internal_songs[0].next    = new Date(Date.now() - 10000);
    dataModel.internal_songs[0].enabled = true;
    dataModel.internal_songs[1].next    = new Date(Date.now() + 999999);
});

// ── isDisplayHours() ──────────────────────────────────────────────────────────

describe("isDisplayHours()", () => {
    function setTime(year, month /* 1-based */, day, hour, minute = 0) {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(year, month - 1, day, hour, minute, 0));
    }
    afterEach(() => jest.useRealTimers());

    test("returns true at 6 am (morning window start)", () => {
        setTime(2024, 12, 15, 6, 0);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns true at 8:30 am (inside morning window)", () => {
        setTime(2024, 12, 15, 8, 30);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns false at 9 am (outside morning window)", () => {
        setTime(2024, 12, 15, 9, 0);
        expect(scheduler.isDisplayHours()).toBe(false);
    });

    test("returns true at 5 pm (evening window start)", () => {
        setTime(2024, 12, 15, 17, 0);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns true at 10:30 pm (inside evening window)", () => {
        setTime(2024, 12, 15, 22, 30);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns false at 11 pm (evening window closed)", () => {
        setTime(2024, 12, 15, 23, 0);
        expect(scheduler.isDisplayHours()).toBe(false);
    });

    test("returns false at noon on a regular December day", () => {
        setTime(2024, 12, 15, 12, 0);
        expect(scheduler.isDisplayHours()).toBe(false);
    });

    test("returns true on Christmas Eve at 6 pm", () => {
        setTime(2024, 12, 24, 18, 0);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns false on Christmas Eve before 5 pm", () => {
        setTime(2024, 12, 24, 16, 0);
        expect(scheduler.isDisplayHours()).toBe(false);
    });

    test("returns true on Christmas morning just after midnight", () => {
        setTime(2024, 12, 25, 0, 30);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns false on Christmas Day at 1 am", () => {
        setTime(2024, 12, 25, 1, 0);
        expect(scheduler.isDisplayHours()).toBe(false);
    });

    test("returns true on New Year's Eve after 5 pm", () => {
        setTime(2024, 12, 31, 20, 0);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns true on New Year's Day just after midnight", () => {
        setTime(2025, 1, 1, 0, 30);
        expect(scheduler.isDisplayHours()).toBe(true);
    });

    test("returns true in July when debug mode is enabled", () => {
        setTime(2024, 7, 4, 12, 0); // summer noon — normally off
        dataModel.current.debug = true;
        expect(scheduler.isDisplayHours()).toBe(true);
    });
});

// ── getRandomInt() ────────────────────────────────────────────────────────────

describe("getRandomInt()", () => {
    test("always returns an integer in [0, max)", () => {
        for (let i = 0; i < 100; i++) {
            const n = scheduler.getRandomInt(10);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(10);
            expect(Number.isInteger(n)).toBe(true);
        }
    });

    test("returns 0 when max is 1", () => {
        expect(scheduler.getRandomInt(1)).toBe(0);
    });
});

// ── findNextInternal() ────────────────────────────────────────────────────────

describe("findNextInternal()", () => {
    test("returns the first overdue enabled internal song", () => {
        // Internal_Driveway.next is in the past (set in beforeEach)
        expect(scheduler.findNextInternal()).toBe("Internal_Driveway");
    });

    test("returns empty string when no songs are due", () => {
        dataModel.internal_songs[0].next = new Date(Date.now() + 999999);
        expect(scheduler.findNextInternal()).toBe("");
    });

    test("skips disabled songs even when overdue", () => {
        dataModel.internal_songs[0].enabled = false;
        expect(scheduler.findNextInternal()).toBe("");
    });

    test("advances the played song's next time forward", () => {
        const before = dataModel.internal_songs[0].next.getTime();
        scheduler.findNextInternal();
        expect(dataModel.internal_songs[0].next.getTime()).toBeGreaterThan(before);
    });
});

// ── setNameEstimate() ─────────────────────────────────────────────────────────

describe("setNameEstimate()", () => {
    test("clamps negative seconds to 0", () => {
        scheduler.setNameEstimate(-5, "test");
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ estimated_seconds: 0 })
        );
    });

    test("generates a 'seconds' message when under 60 s", () => {
        scheduler.setNameEstimate(30, null);
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("seconds") })
        );
    });

    test("generates a 'minutes' message when 60 s or more", () => {
        scheduler.setNameEstimate(120, null);
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("minutes") })
        );
    });

    test("caps the message at '10 minutes' when estimate exceeds 10 min", () => {
        scheduler.setNameEstimate(700, null);
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("10 minutes") })
        );
    });

    test("uses the provided message directly without generating one", () => {
        scheduler.setNameEstimate(50, "Custom message");
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Custom message" })
        );
    });

    test("overrides to 0 seconds and 'now' when Internal_Wish_Name is playing", () => {
        dataModel.current.song = "Internal_Wish_Name";
        scheduler.setNameEstimate(100, null);
        expect(mymqtt.sendNameEstimates).toHaveBeenCalledWith(
            expect.objectContaining({ estimated_seconds: 0, message: "now" })
        );
    });
});
