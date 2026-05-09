"use strict";

// Provide required env vars before loading the module
process.env.MQTT_HOST     = "test-host";
process.env.MQTT_PORT     = "1883";
process.env.MQTT_USERNAME = "testuser";
process.env.MQTT_PASSWORD = "testpass";

// Mock the MQTT client so init() doesn't open a real connection
const mockClient = {
    on: jest.fn(),
    subscribe: jest.fn(),
    publish: jest.fn((topic, msg, opts, cb) => {
        // Support both 3-arg and 4-arg publish calls
        const callback = typeof opts === "function" ? opts : cb;
        if (callback) callback(null);
    }),
};

jest.mock("mqtt", () => ({ connect: jest.fn(() => mockClient) }));
jest.mock("mqtt-pattern", () => ({ matches: jest.fn() }));

jest.mock("../lib/model.js", () => ({
    current: {
        enabled: true,
        tunnelEnabled: true,
        shortList: false,
        admin_song: null,
        debug: false,
        isDisplayHours: false,
        nameStatus: "IDLE",
        lastNameGen:  new Date(),
        lastNamePlay: new Date(),
        idleDate:     new Date(),
        status:       "Unknown",
    },
    clock:      { time: 600, startedMidnight: false, lastUpdate: new Date() },
    health:     { lastVote: new Date(), lastTextServer: new Date(), lastTunnel: new Date(),
                  lastFPPButton: new Date(), lastnameQueue: new Date(), lastNameGen: new Date(),
                  lastNamePlay: new Date() },
    nameQueue:  { status: "IDLE", normal: [], low: [], ready: [] },
    all_playlists: [{ name: "Song_A" }, { name: "Song_B" }],
    all_playlists_internal: ["Internal_One"],
    topVote: "",
    tunnel:     { stats: "", button: "", lastSend: new Date() },
    internal_songs: [
        { playlist: "Internal_Short_Show", enabled: false },
    ],
}));

const datamodel = require("../lib/model.js");
const mymqtt    = require("../lib/mymqtt");

// Helper: find a handler by topic string
function handlerFor(topic) {
    return mymqtt.handlers.find(h => h.topic === topic);
}

beforeEach(() => {
    jest.clearAllMocks();
    // Reset model state
    datamodel.current.enabled       = true;
    datamodel.current.tunnelEnabled = true;
    datamodel.current.debug         = false;
    datamodel.current.shortList     = false;
    datamodel.current.admin_song    = null;
    datamodel.current.nameStatus    = "IDLE";
    datamodel.clock.time            = 600;
    datamodel.topVote               = "";
    datamodel.internal_songs[0].enabled = false;
});

// ── handler: /christmas/nameQueue ────────────────────────────────────────────

describe("handler: /christmas/nameQueue", () => {
    const h = () => handlerFor("/christmas/nameQueue");

    test("updates nameQueue and nameStatus from the message", () => {
        const payload = { status: "READY", normal: [{ ts: 1000 }], low: [], ready: [] };
        h().callback("/christmas/nameQueue", Buffer.from(JSON.stringify(payload)));

        expect(datamodel.nameQueue.status).toBe("READY");
        expect(datamodel.current.nameStatus).toBe("READY");
    });

    test("records lastNameGen when status is GENERATING", () => {
        const before = datamodel.current.lastNameGen;
        const payload = { status: "GENERATING", normal: [], low: [], ready: [] };
        h().callback("/christmas/nameQueue", Buffer.from(JSON.stringify(payload)));

        expect(datamodel.current.lastNameGen).not.toBe(before);
    });
});

// ── handler: /christmas/vote/songQueue ───────────────────────────────────────

describe("handler: /christmas/vote/songQueue", () => {
    const h = () => handlerFor("/christmas/vote/songQueue");

    test("sets topVote to the first song when queue is non-empty", () => {
        const payload = [{ playlist: "Jingle_Bells" }, { playlist: "Rudolph" }];
        h().callback("/christmas/vote/songQueue", Buffer.from(JSON.stringify(payload)));

        expect(datamodel.topVote).toBe("Jingle_Bells");
    });

    test("clears topVote when the queue is empty", () => {
        datamodel.topVote = "Old_Song";
        h().callback("/christmas/vote/songQueue", Buffer.from(JSON.stringify([])));

        expect(datamodel.topVote).toBe("");
    });
});

// ── handler: /christmas/vote/setShortList ────────────────────────────────────

describe("handler: /christmas/vote/setShortList", () => {
    const h = () => handlerFor("/christmas/vote/setShortList");

    test("enables shortList and Internal_Short_Show on TRUE", () => {
        datamodel.internal_songs[0].enabled = false;
        h().callback("/christmas/vote/setShortList", Buffer.from("TRUE"));

        expect(datamodel.current.shortList).toBe(true);
        expect(datamodel.internal_songs[0].enabled).toBe(true);
    });

    test("disables shortList and Internal_Short_Show on FALSE", () => {
        datamodel.current.shortList = true;
        datamodel.internal_songs[0].enabled = true;
        h().callback("/christmas/vote/setShortList", Buffer.from("FALSE"));

        expect(datamodel.current.shortList).toBe(false);
        expect(datamodel.internal_songs[0].enabled).toBe(false);
    });

    test("is case-insensitive (true, True, TRUE all work)", () => {
        h().callback("/christmas/vote/setShortList", Buffer.from("true"));
        expect(datamodel.current.shortList).toBe(true);
    });
});

// ── handler: /christmas/setActive ────────────────────────────────────────────

describe("handler: /christmas/setActive", () => {
    const h = () => handlerFor("/christmas/setActive");

    test("enables the scheduler on TRUE", () => {
        datamodel.current.enabled = false;
        h().callback("/christmas/setActive", Buffer.from("TRUE"));
        expect(datamodel.current.enabled).toBe(true);
    });

    test("disables the scheduler on FALSE", () => {
        h().callback("/christmas/setActive", Buffer.from("FALSE"));
        expect(datamodel.current.enabled).toBe(false);
    });
});

// ── handler: /christmas/setActive/tunnel ─────────────────────────────────────

describe("handler: /christmas/setActive/tunnel", () => {
    const h = () => handlerFor("/christmas/setActive/tunnel");

    test("enables tunnel on TRUE", () => {
        datamodel.current.tunnelEnabled = false;
        h().callback("/christmas/setActive/tunnel", Buffer.from("TRUE"));
        expect(datamodel.current.tunnelEnabled).toBe(true);
    });

    test("disables tunnel on FALSE", () => {
        h().callback("/christmas/setActive/tunnel", Buffer.from("FALSE"));
        expect(datamodel.current.tunnelEnabled).toBe(false);
    });
});

// ── handler: /christmas/vote/debug ────────────────────────────────────────────

describe("handler: /christmas/vote/debug", () => {
    const h = () => handlerFor("/christmas/vote/debug");

    test("enables debug mode on TRUE", () => {
        h().callback("/christmas/vote/debug", Buffer.from("TRUE"));
        expect(datamodel.current.debug).toBe(true);
    });

    test("disables debug mode on FALSE", () => {
        datamodel.current.debug = true;
        h().callback("/christmas/vote/debug", Buffer.from("FALSE"));
        expect(datamodel.current.debug).toBe(false);
    });
});

// ── handler: /christmas/clock ─────────────────────────────────────────────────

describe("handler: /christmas/clock", () => {
    const h = () => handlerFor("/christmas/clock");

    test("updates clock.time from the message", () => {
        h().callback("/christmas/clock", Buffer.from("120"));
        expect(datamodel.clock.time).toBe(120);
    });

    test("resets startedMidnight to false when clock is positive", () => {
        datamodel.clock.startedMidnight = true;
        h().callback("/christmas/clock", Buffer.from("300"));
        expect(datamodel.clock.startedMidnight).toBe(false);
    });

    test("does not reset startedMidnight when clock is zero or negative", () => {
        datamodel.clock.startedMidnight = true;
        h().callback("/christmas/clock", Buffer.from("0"));
        expect(datamodel.clock.startedMidnight).toBe(true);
    });
});

// ── handler: /christmas/scheduler/setAdminSong ───────────────────────────────

describe("handler: /christmas/scheduler/setAdminSong", () => {
    const h = () => handlerFor("/christmas/scheduler/setAdminSong");

    test("stores the admin song from the message", () => {
        h().callback("/christmas/scheduler/setAdminSong", Buffer.from("Jingle_Bells"));
        expect(datamodel.current.admin_song).toBe("Jingle_Bells");
    });
});

// ── handler: /christmas/FPPButton/# ──────────────────────────────────────────

describe("handler: /christmas/FPPButton/#", () => {
    const h = () => handlerFor("/christmas/FPPButton/#");

    test("extracts the colour from the topic path", () => {
        h().callback("/christmas/FPPButton/Blue", Buffer.from(""));
        expect(datamodel.tunnel.button).toBe("Blue");
    });
});
