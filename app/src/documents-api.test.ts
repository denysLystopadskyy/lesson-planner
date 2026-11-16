import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  fetchDocuments,
  isRetryable,
  putDocument,
  withToken,
  type GetToken,
} from "./documents-api";

/**
 * The documents API client — plan batch 6.2.
 *
 * `fetch` is stubbed: this is component testing of the mapping from HTTP
 * answers to results. The real API is exercised over HTTP by
 * `e2e/features/remote-save.spec.ts` and `remote-load.spec.ts`.
 *
 * Review focus item 1 (the token expires mid-session) is the `withToken`
 * block: one fresh token and one retry, never a loop.
 */

type Call = { url: string; init: RequestInit | undefined };

const stubFetch = (...answers: (Response | Error)[]): { calls: Call[] } => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const answer = answers.shift();
      if (answer === undefined) throw new Error("no answer left in the stub");
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve(answer);
    }),
  );
  return { calls };
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const statusOf = async (promise: Promise<unknown>): Promise<number> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.status;
    throw error;
  }
  throw new Error("expected the call to throw");
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDocuments — equivalence partitioning on the answer", () => {
  it("200 → the documents, asked for with the bearer token", async () => {
    const documents = {
      data: {
        body: [],
        schemaVersion: 1,
        updatedAt: "2026-06-15T10:00:00.000Z",
      },
      settings: null,
      template: null,
    };
    const { calls } = stubFetch(json(200, { documents }));

    await expect(fetchDocuments("t1")).resolves.toEqual(documents);
    expect(calls[0]?.url).toBe("/api/documents");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
      "Bearer t1",
    );
  });

  it.each([401, 403, 500])("%i → ApiError with that status", async (status) => {
    stubFetch(json(status, { error: "x" }));

    expect(await statusOf(fetchDocuments("t1"))).toBe(status);
  });

  it("No answer at all → ApiError with status 0", async () => {
    stubFetch(new TypeError("Failed to fetch"));

    expect(await statusOf(fetchDocuments("t1"))).toBe(0);
  });
});

describe("putDocument — equivalence partitioning on the answer", () => {
  it("Sends the body, schema version 1 and the base, to the key's path", async () => {
    const { calls } = stubFetch(
      json(200, { updatedAt: "2026-06-15T10:00:00.001Z" }),
    );

    await expect(
      putDocument("t1", "settings", { defaultCurrency: "PLN" }, null),
    ).resolves.toEqual({
      kind: "saved",
      updatedAt: "2026-06-15T10:00:00.001Z",
    });
    expect(calls[0]?.url).toBe("/api/documents/settings");
    expect(calls[0]?.init?.method).toBe("PUT");
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({
      body: { defaultCurrency: "PLN" },
      schemaVersion: 1,
      baseUpdatedAt: null,
    });
  });

  it("409 → a conflict carrying the server's copy", async () => {
    const document = {
      body: "Other text",
      schemaVersion: 1,
      updatedAt: "2026-06-15T11:00:00.000Z",
    };
    stubFetch(json(409, { document }));

    await expect(
      putDocument("t1", "template", "Mine", "2026-06-15T10:00:00.000Z"),
    ).resolves.toEqual({ kind: "conflict", document });
  });

  it("409 with no row on the server → a conflict with a null document", async () => {
    stubFetch(json(409, { document: null }));

    await expect(
      putDocument("t1", "data", [], "2026-06-15T10:00:00.000Z"),
    ).resolves.toEqual({ kind: "conflict", document: null });
  });

  it("400 → ApiError carrying the server's reason", async () => {
    stubFetch(json(400, { error: "the body is not a valid data document" }));

    await expect(putDocument("t1", "data", [{}], null)).rejects.toMatchObject({
      status: 400,
      message: "the body is not a valid data document",
    });
  });
});

describe("isRetryable — equivalence partitioning on the status", () => {
  it.each([
    [0, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [403, false],
    [413, false],
  ])("status %i → %s", (status, retryable) => {
    expect(isRetryable(new ApiError(status, "x"))).toBe(retryable);
  });

  it("A thrown value that is not an ApiError is not retried", () => {
    expect(isRetryable(new Error("x"))).toBe(false);
  });
});

describe("withToken — error guessing on the token (review focus 1)", () => {
  const tokens = (...values: (string | null)[]) => {
    const asked: boolean[] = [];
    const getToken: GetToken = (options) => {
      asked.push(options?.fresh === true);
      return Promise.resolve(values.shift() ?? null);
    };
    return { getToken, asked };
  };

  it("A good token is used once, from the cache", async () => {
    const { getToken, asked } = tokens("good");
    const call = vi.fn((token: string) => Promise.resolve(token));

    await expect(withToken(getToken, call)).resolves.toBe("good");
    expect(asked).toEqual([false]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("401, then a fresh token succeeds → one retry with the fresh token", async () => {
    const { getToken, asked } = tokens("expired", "fresh");
    const call = vi.fn((token: string) =>
      token === "expired"
        ? Promise.reject(new ApiError(401, "invalid token"))
        : Promise.resolve(`used ${token}`),
    );

    await expect(withToken(getToken, call)).resolves.toBe("used fresh");
    expect(asked).toEqual([false, true]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("401 twice → throws 401 after exactly one retry, never a loop", async () => {
    const { getToken, asked } = tokens("expired", "also-refused", "third");
    const call = vi.fn(() =>
      Promise.reject(new ApiError(401, "invalid token")),
    );

    expect(await statusOf(withToken(getToken, call))).toBe(401);
    expect(asked).toEqual([false, true]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("No session at all → 401 without calling the API", async () => {
    const { getToken } = tokens(null, null);
    const call = vi.fn(() => Promise.resolve("x"));

    expect(await statusOf(withToken(getToken, call))).toBe(401);
    expect(call).not.toHaveBeenCalled();
  });

  it("No cached token, but a fresh one → one call with the fresh token", async () => {
    const { getToken, asked } = tokens(null, "fresh");
    const call = vi.fn((token: string) => Promise.resolve(token));

    await expect(withToken(getToken, call)).resolves.toBe("fresh");
    expect(asked).toEqual([false, true]);
  });

  it("A failure that is not a 401 is not retried with a new token", async () => {
    const { getToken, asked } = tokens("good", "fresh");
    const call = vi.fn(() => Promise.reject(new ApiError(500, "boom")));

    expect(await statusOf(withToken(getToken, call))).toBe(500);
    expect(asked).toEqual([false]);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
