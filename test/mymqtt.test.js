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

// ── smart plugs ──────────────────────────────────────────────────────────────

beforeAll(() => {
    mymqtt.init(); // wires up mockClient for publish tests
    // Fire the "connect" event so init()'s connection-timeout timer is cleared.
    const onConnect = mockClient.on.mock.calls.find(c => c[0] === "connect")[1];
    onConnect();
});

describe("notifyPlugs", () => {
    test("does not control plug-aux2 (owned by auxScheduler)", () => {
        mymqtt.notifyPlugs();
        const topics = mockClient.publish.mock.calls.map(c => c[0]);
        expect(topics).toEqual([
            "plug-radio/command/switch:0",
            "plug-buttons/command/switch:0",
            "plug-aux1/command/switch:0",
        ]);
    });
});

describe("setPlug", () => {
    test("publishes the status to the plug's switch topic", () => {
        mymqtt.setPlug("plug-aux2", "off");
        expect(mockClient.publish).toHaveBeenCalledWith("plug-aux2/command/switch:0", "off", expect.any(Function));
    });
});

describe("pingPlugs", () => {
    test("sends status_update to every monitored plug", () => {
        mymqtt.pingPlugs();
        const calls = mockClient.publish.mock.calls.map(c => [c[0], c[1]]);
        expect(calls).toEqual(mymqtt.MONITORED_PLUGS.map(p => [p + "/command", "status_update"]));
    });

    test("status subscription matches the bare <plug>/status reply Shelly sends", () => {
        const { matches } = jest.requireActual("mqtt-pattern");
        expect(matches("plug-radio/status/#", "plug-radio/status")).toBe(true);
        expect(matches("plug-radio/status/#", "plug-radio/status/switch:0")).toBe(true);
    });

    test("a status handler is registered for every monitored plug", () => {
        for (const plug of mymqtt.MONITORED_PLUGS) {
            expect(handlerFor(plug + "/status/#")).toBeDefined();
        }
    });
});

// ── sendStatus: plug and sign warnings ───────────────────────────────────────

describe("sendStatus warnings", () => {
    afterEach(() => jest.useRealTimers());

    function statusAt(date) {
        jest.setSystemTime(date);
        mymqtt.sendStatus();
        return datamodel.current.status.split(",");
    }

    function touchAllPlugs() {
        for (const plug of mymqtt.MONITORED_PLUGS) {
            handlerFor(plug + "/status/#").callback(plug + "/status/switch:0", Buffer.from("{}"));
        }
    }

    function fppSeen(playerId) {
        handlerFor("/christmas/falcon/player/+/fppd_status")
            .callback("/christmas/falcon/player/" + playerId + "/fppd_status", Buffer.from("{}"));
    }

    test("warns for a plug silent for more than 10 minutes", () => {
        jest.useFakeTimers({ now: new Date(2030, 0, 1, 12, 0) });
        touchAllPlugs();
        jest.setSystemTime(new Date(2030, 0, 1, 12, 5));
        handlerFor("plug-radio/status/#").callback("plug-radio/status/switch:0", Buffer.from("{}"));

        const status = statusAt(new Date(2030, 0, 1, 12, 11));
        expect(status).not.toContain("SCHEDULER_NO_PLUG_plug-radio");
        expect(status).toContain("SCHEDULER_NO_PLUG_plug-aux2");
    });

    test("no plug warning within 10 minutes", () => {
        jest.useFakeTimers({ now: new Date(2030, 0, 1, 12, 0) });
        touchAllPlugs();
        const status = statusAt(new Date(2030, 0, 1, 12, 9));
        expect(status.filter(s => s.startsWith("SCHEDULER_NO_PLUG_"))).toEqual([]);
    });

    test.each([
        [new Date(2030, 0, 1, 9, 4), false],
        [new Date(2030, 0, 1, 12, 0), false],
        [new Date(2030, 0, 1, 17, 9), false],
        [new Date(2030, 0, 1, 17, 10), true],
        [new Date(2030, 0, 1, 8, 59), true],
    ])("FPPTunnelSign offline at %s → warned: %s", (when, warned) => {
        jest.useFakeTimers({ now: new Date(when.getTime() - 10 * 60000) });
        fppSeen("FPPTunnelSign");
        fppSeen("FPPOther");
        const status = statusAt(when);
        expect(status.includes("SCHEDULER_NO_FPP_FPPTunnelSign")).toBe(warned);
        expect(status).toContain("SCHEDULER_NO_FPP_FPPOther"); // other players never suppressed
    });
});
