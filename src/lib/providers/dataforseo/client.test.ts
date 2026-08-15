import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DataForSeoError,
  callDataForSeo,
  readCredentials,
} from "@/lib/providers/dataforseo/client";

const credentials = { login: "user", password: "pass" };

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  } as unknown as Response);
}

function envelope(tasks: unknown[], overrides: Record<string, unknown> = {}) {
  return { status_code: 20000, status_message: "Ok.", cost: 0.02, tasks, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("readCredentials", () => {
  it("requires both halves", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "user");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    expect(readCredentials()).toBeNull();

    vi.stubEnv("DATAFORSEO_PASSWORD", "pass");
    expect(readCredentials()).toEqual({ login: "user", password: "pass" });
  });

  it("ignores whitespace-only values", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "   ");
    vi.stubEnv("DATAFORSEO_PASSWORD", "pass");
    expect(readCredentials()).toBeNull();
  });
});

describe("callDataForSeo", () => {
  it("sends basic auth and flattens task results", async () => {
    const fetchMock = respondWith(
      envelope([{ status_code: 20000, result: [{ a: 1 }, { a: 2 }] }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { results, cost } = await callDataForSeo<{ a: number }>("/v3/test", {
      credentials,
      body: [{ keyword: "x" }],
    });

    expect(results).toEqual([{ a: 1 }, { a: 2 }]);
    expect(cost).toBe(0.02);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.dataforseo.com/v3/test");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );
  });

  it("issues a GET when there is no body", async () => {
    const fetchMock = respondWith(envelope([{ status_code: 20000, result: [] }]));
    vi.stubGlobal("fetch", fetchMock);

    await callDataForSeo("/v3/serp/google/locations", { credentials });

    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("raises on an envelope-level failure even though HTTP was 200", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({ status_code: 40200, status_message: "Payment Required." }),
    );

    await expect(callDataForSeo("/v3/test", { credentials, body: [] })).rejects.toThrow(
      /Payment Required/,
    );
  });

  it("raises on a task-level failure rather than reporting no data", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(
        envelope([
          { status_code: 40501, status_message: "Invalid Field: 'location_code'." },
        ]),
      ),
    );

    // Swallowing this would let a caller write a null into the database as
    // though the provider had genuinely reported nothing.
    await expect(
      callDataForSeo("/v3/test", { credentials, body: [] }),
    ).rejects.toThrow(/Invalid Field/);
  });

  it("names the credentials on a 401", async () => {
    vi.stubGlobal("fetch", respondWith({}, 401));

    await expect(
      callDataForSeo("/v3/test", { credentials, body: [] }),
    ).rejects.toThrow(/DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD/);
  });

  it("wraps a transport failure as a DataForSeoError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const error = await callDataForSeo("/v3/test", {
      credentials,
      body: [],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DataForSeoError);
    expect((error as DataForSeoError).message).toMatch(/Could not reach DataForSEO/);
  });

  it("tolerates a task with a null result", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(envelope([{ status_code: 20000, result: null }])),
    );

    const { results } = await callDataForSeo("/v3/test", { credentials, body: [] });
    expect(results).toEqual([]);
  });
});
