"use strict";

jest.mock("axios", () => {
    const fn = jest.fn();
    fn.isAxiosError = jest.fn();
    return fn;
});

const axios = require("axios");
const { FPPApi } = require("../lib/fpp");

const HOST = "192.168.1.100";
let api;

beforeEach(() => {
    jest.clearAllMocks();
    api = new FPPApi(HOST);
});

// ── constructor ──────────────────────────────────────────────────────────────

describe("FPPApi constructor", () => {
    test("stores the IP address", () => {
        expect(api.ip_addr).toBe(HOST);
    });

    test("sets the default model name to LED Panels", () => {
        expect(api.model_name).toBe("LED Panels");
    });
});

// ── getFppStatus() ────────────────────────────────────────────────────────────

describe("getFppStatus()", () => {
    test("returns parsed FPP status on success", async () => {
        const status = {
            current_playlist: { playlist: "My_Song", count: "1", type: "" },
            seconds_remaining: 120,
        };
        axios.mockResolvedValue({ data: status });

        const result = await api.getFppStatus();

        expect(result).toEqual(status);
        expect(axios).toHaveBeenCalledWith(expect.objectContaining({
            url: `http://${HOST}/api/fppd/status`,
            method: "GET",
        }));
    });

    test("returns fallback with idle playlist on network error", async () => {
        const err = new Error("ECONNREFUSED");
        axios.mockRejectedValue(err);
        axios.isAxiosError.mockReturnValue(false);

        const result = await api.getFppStatus();

        expect(result.current_playlist).toBeDefined();
        expect(result.current_playlist.count).toBe("0");
    });

    test("returns fallback on HTTP 500 response error", async () => {
        const err = Object.assign(new Error("Internal Server Error"), {
            response: { status: 500, data: "error", headers: {} },
        });
        axios.mockRejectedValue(err);
        axios.isAxiosError.mockReturnValue(true);

        const result = await api.getFppStatus();
        expect(result.current_playlist).toBeDefined();
    });
});

// ── playNow() ────────────────────────────────────────────────────────────────

describe("playNow()", () => {
    test("calls the correct FPP start endpoint", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.playNow("My_Playlist");

        expect(axios).toHaveBeenCalledWith(expect.objectContaining({
            url: `http://${HOST}/api/playlist/My_Playlist/start`,
        }));
    });

    test("passes an optional reason in the log but does not send it to FPP", async () => {
        axios.mockResolvedValue({ data: {} });
        // playNow just logs the reason — the URL is the same regardless
        await api.playNow("Test_Song", "admin override");
        expect(axios.mock.calls[0][0].url).toContain("Test_Song");
    });

    test("returns fallback object on error without throwing", async () => {
        axios.mockRejectedValue(new Error("timeout"));
        axios.isAxiosError.mockReturnValue(false);

        await expect(api.playNow("Any_Song")).resolves.toBeDefined();
    });
});

// ── overlaySetState() ─────────────────────────────────────────────────────────

describe("overlaySetState()", () => {
    test("sends a PUT request to the state endpoint", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetState(1);

        const call = axios.mock.calls[0][0];
        expect(call.method).toBe("PUT");
        expect(call.url).toContain("/state");
    });

    test("encodes the requested state value in the body", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetState(2);

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.State).toBe(2);
    });
});

// ── overlaySetText() ──────────────────────────────────────────────────────────

describe("overlaySetText()", () => {
    test("sends a PUT with the provided message and font size", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetText("Merry Christmas", 48);

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.Message).toBe("Merry Christmas");
        expect(body.FontSize).toBe(48);
    });

    test("defaults font size to 60 when omitted", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetText("Hello");

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.FontSize).toBe(60);
    });

    test("defaults position to Center when omitted", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetText("Test", 48);

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.Position).toBe("Center");
    });

    test("accepts an explicit position override", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetText("Scroll", 48, "R2L");

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.Position).toBe("R2L");
    });

    test("uses a placeholder message when text is falsy", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlaySetText("", 48);

        const body = JSON.parse(axios.mock.calls[0][0].data);
        expect(body.Message).toBeTruthy();
    });
});

// ── overlayClearMessage() ─────────────────────────────────────────────────────

describe("overlayClearMessage()", () => {
    test("calls the /clear endpoint for the model", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlayClearMessage();

        expect(axios.mock.calls[0][0].url).toContain("/clear");
    });

    test("URL-encodes the model name", async () => {
        axios.mockResolvedValue({ data: {} });

        await api.overlayClearMessage();

        // "LED Panels" → "LED%20Panels"
        expect(axios.mock.calls[0][0].url).toContain("LED%20Panels");
    });
});
