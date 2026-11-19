"use strict";

const mockSign = { systemShutdown: jest.fn().mockResolvedValue({}) };
jest.mock("../lib/fpp.js", () => ({ FPPApi: jest.fn().mockImplementation(() => mockSign) }));
jest.mock("../lib/mymqtt.js", () => ({ setPlug: jest.fn() }));

const mymqtt = require("../lib/mymqtt.js");
const aux = require("../lib/auxScheduler.js");

const at = (h, m) => new Date(2026, 10, 19, h, m);

beforeEach(() => jest.clearAllMocks());

test("09:00–09:05 shuts down the sign and keeps the plug on", async () => {
    expect(await aux.doAuxCheck(at(9, 2))).toBe("SHUTDOWN");
    expect(mockSign.systemShutdown).toHaveBeenCalledTimes(1);
    expect(mymqtt.setPlug).toHaveBeenCalledWith("plug-aux2", "on");
});

test("09:05–16:55 turns the plug off without a shutdown call", async () => {
    expect(await aux.doAuxCheck(at(13, 0))).toBe("OFF");
    expect(mymqtt.setPlug).toHaveBeenCalledWith("plug-aux2", "off");
    expect(mockSign.systemShutdown).not.toHaveBeenCalled();
});

test("outside the day window turns the plug on", async () => {
    expect(await aux.doAuxCheck(at(16, 55))).toBe("ON");
    expect(mymqtt.setPlug).toHaveBeenCalledWith("plug-aux2", "on");
    expect(mockSign.systemShutdown).not.toHaveBeenCalled();
});
