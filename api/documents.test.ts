import { generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { sql } from "drizzle-orm";
import { SignJWT } from "jose";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createPgliteDb } from "@lesson-planner/db/testing";

import { app, resetJwksCache, setDb, verifyUserToken } from "./[...all].ts";

/**
 * The documents API: `GET /api/documents` and `PUT /api/documents/:key`
 * (plan batch 6.1, test conditions C1–C7).
 *
 * These are component integration tests. They call the Hono application
 * object directly, with a real PGlite database that has the real migration
 * applied, and with real EdDSA tokens. Only the network is stubbed: `fetch`
 * answers the JWKS request with this file's own public key.
 *
 * The tokens are signed here with `jose`'s `SignJWT`, never with code from the
 * entry, so a mistake in the verifier cannot hide behind the same mistake in
 * the fixture.
 *
 * **One database for the whole file** (testing.md §2.9: PGlite is slow). Each
 * test uses its own random `sub`, so tests cannot see each other's rows. The
 * isolation tests (C3) do not need a second database either: isolation between
 * users is a property of the queries, and that is what they test.
 */

const BASE_URL = "https://auth.example.test/neondb/auth";
const ORIGIN = "https://auth.example.test";
const KID = "documents-test-key";
const HER = "her@example.test";
const HIM = "him@example.test";

const own = generateKeyPairSync("ed25519");
const stranger = generateKeyPairSync("ed25519");
const jwks = {
  keys: [{ ...own.publicKey.export({ format: "jwk" }), kid: KID }],
};

type TokenOptions = {
  sub?: string;
  email?: string;
  iss?: string;
  aud?: string;
  /** Seconds since the epoch; `null` leaves the claim out. */
  exp?: number | null;
  /** Leaves the `email` claim out. */
  noEmail?: boolean;
  kid?: string;
  key?: KeyObject;
};

const now = (): number => Math.floor(Date.now() / 1000);

/** A Neon Auth-shaped token: EdDSA, `iss` and `aud` are the auth origin. */
const mint = (options: TokenOptions = {}): Promise<string> => {
  const jwt = new SignJWT(
    options.noEmail ? {} : { email: options.email ?? HER },
  )
    .setProtectedHeader({ alg: "EdDSA", kid: options.kid ?? KID })
    .setSubject(options.sub ?? randomUUID())
    .setIssuer(options.iss ?? ORIGIN)
    .setAudience(options.aud ?? ORIGIN)
    .setIssuedAt();
  if (options.exp !== null) {
    jwt.setExpirationTime(options.exp ?? now() + 15 * 60);
  }
  return jwt.sign(options.key ?? own.privateKey);
};

/** The algorithm-confusion token: HS256, keyed with a shared secret. */
const mintHs256 = (): Promise<string> =>
  new SignJWT({ email: HER })
    .setProtectedHeader({ alg: "HS256", kid: KID })
    .setSubject(randomUUID())
    .setIssuer(ORIGIN)
    .setAudience(ORIGIN)
    .setIssuedAt()
    .setExpirationTime(now() + 15 * 60)
    .sign(new TextEncoder().encode("a shared secret, which EdDSA never uses"));

const request = (
  method: string,
  path: string,
  token: string | null,
  body?: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> => {
  const headers = new Headers({
    "content-type": "application/json",
    ...extraHeaders,
  });
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return Promise.resolve(
    app.request(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    }),
  );
};

const getDocuments = (token: string | null) =>
  request("GET", "/api/documents", token);

type Put = { body: unknown; schemaVersion: unknown; baseUpdatedAt: unknown };

const putDocument = (
  token: string | null,
  key: string,
  payload: Partial<Put> & { body: unknown },
) =>
  request(
    "PUT",
    `/api/documents/${key}`,
    token,
    JSON.stringify({ schemaVersion: 1, baseUpdatedAt: null, ...payload }),
  );

type StoredDocument = {
  body: unknown;
  schemaVersion: number;
  updatedAt: string;
};
type Documents = Record<
  "data" | "settings" | "template",
  StoredDocument | null
>;

const documentsOf = async (response: Response): Promise<Documents> =>
  ((await response.json()) as { documents: Documents }).documents;

const GROUPS = [
  {
    name: "Monday Beginners",
    price: 250,
    currency: "UAH",
    dates: ["2026-07-06", "2026-07-13"],
    monthlyOverrides: {
      "2026-07": { price: 250, dates: ["2026-07-06", "2026-07-13"] },
    },
  },
];

let db: Awaited<ReturnType<typeof createPgliteDb>>;

type Row = Record<string, unknown>;
const rows = async (query: ReturnType<typeof sql>): Promise<Row[]> =>
  ((await db.execute(query)) as { rows: Row[] }).rows;

const countRows = async (sub: string): Promise<number> => {
  const [row] = await rows(
    sql`select (select count(*) from documents where user_id = ${sub})::int
             + (select count(*) from document_versions where user_id = ${sub})::int as n`,
  );
  return Number(row?.["n"]);
};

beforeAll(async () => {
  db = await createPgliteDb();
});

beforeEach(() => {
  resetJwksCache();
  setDb(db);
  vi.stubEnv("NEON_AUTH_BASE_URL", BASE_URL);
  vi.stubEnv("ALLOWED_EMAILS", `${HER}, ${HIM}`);
  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(
      url === `${BASE_URL}/.well-known/jwks.json`
        ? new Response(JSON.stringify(jwks), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response("not found", { status: 404 }),
    );
  });
});

afterEach(() => {
  setDb(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * C1. Eight rules, one column each. Every rule except the first is a way a
 * token can be wrong, and each must end in 401 — not 403, which would mean
 * the token was believed.
 */
describe("C1 token check — decision table", () => {
  it("rule 1, valid: verifyUserToken returns the sub and email", async () => {
    const sub = randomUUID();
    const token = await mint({ sub, email: HER });

    await expect(verifyUserToken(token, BASE_URL)).resolves.toEqual({
      sub,
      email: HER,
    });
    expect((await getDocuments(token)).status).toBe(200);
  });

  const invalid: [string, () => Promise<string>][] = [
    ["rule 2, expired", () => mint({ exp: now() - 60 })],
    ["rule 3, wrong iss", () => mint({ iss: "https://evil.example.test" })],
    ["rule 4, wrong aud", () => mint({ aud: "https://other.example.test" })],
    ["rule 5, wrong alg (HS256)", mintHs256],
    [
      "rule 6, unknown kid",
      () => mint({ kid: "not-in-the-set", key: stranger.privateKey }),
    ],
    [
      "rule 7, bad signature (right kid, wrong key)",
      () => mint({ key: stranger.privateKey }),
    ],
    // Error guessing, beyond the eight rules: jose accepts a token with no
    // `exp` unless told to require one, and that token would never expire.
    ["extra, no exp claim", () => mint({ exp: null })],
    ["extra, no email claim", () => mint({ noEmail: true })],
  ];

  it.each(invalid)(
    "%s: verifyUserToken returns null, GET is 401",
    async (_, make) => {
      const token = await make();

      await expect(verifyUserToken(token, BASE_URL)).resolves.toBeNull();
      expect((await getDocuments(token)).status).toBe(401);
      expect((await putDocument(token, "template", { body: "x" })).status).toBe(
        401,
      );
    },
  );

  it("rule 8, missing header: GET and PUT are 401", async () => {
    expect((await getDocuments(null)).status).toBe(401);
    expect((await putDocument(null, "template", { body: "x" })).status).toBe(
      401,
    );
  });

  /**
   * A base URL pasted with a trailing slash names the same service. Without
   * the strip, the key set address has `//` in it, the fetch misses, and every
   * request is a 401 — a lock-out that looks like a bad token.
   */
  it("extra, NEON_AUTH_BASE_URL with a trailing slash: a valid token is accepted", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", `${BASE_URL}/`);
    const sub = randomUUID();
    const token = await mint({ sub });

    await expect(verifyUserToken(token, `${BASE_URL}/`)).resolves.toEqual({
      sub,
      email: HER,
    });
    expect((await getDocuments(token)).status).toBe(200);
  });

  /**
   * Fails closed when the deployment cannot check a token at all: a server
   * fault (500), like the webhook's, and never a read.
   */
  it("extra, no NEON_AUTH_BASE_URL: 500 for a valid token, nothing read", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "");
    const response = await getDocuments(await mint());

    expect(response.status).toBe(500);
    expect(Object.keys((await response.json()) as object)).toEqual(["error"]);
  });

  /**
   * Decided in the Red step (the page's "Confirmation and regression testing"
   * asks): the deployed entry has no test door. The mint and JWKS routes live
   * in `scripts/serve.mjs` only, and the application object answers neither.
   */
  it("the deployed application has no mint route and no JWKS route", async () => {
    for (const path of [
      "/__neon-auth/__test/mint",
      "/api/__neon-auth/__test/mint",
      "/api/__test/mint",
    ]) {
      expect((await app.request(path, { method: "POST" })).status).toBe(404);
    }
    expect(
      (await app.request("/__neon-auth/.well-known/jwks.json")).status,
    ).toBe(404);
  });
});

/** C2. The allowlist is checked on the token's email on every request. */
describe("C2 allowlist per request — equivalence partitioning", () => {
  it("listed: 200", async () => {
    expect((await getDocuments(await mint({ email: HIM }))).status).toBe(200);
  });

  it("listed with other case or spaces: 200", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "  HER@Example.Test ,him@example.test");
    const token = await mint({ email: " Her@EXAMPLE.test " });

    expect((await getDocuments(token)).status).toBe(200);
  });

  it("not listed: 403 on GET and PUT, and nothing is written", async () => {
    const sub = randomUUID();
    const token = await mint({ sub, email: "stranger@example.test" });

    expect((await getDocuments(token)).status).toBe(403);
    expect((await putDocument(token, "data", { body: GROUPS })).status).toBe(
      403,
    );
    expect(await countRows(sub)).toBe(0);
  });

  it("list empty: 403, even for her address", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    const sub = randomUUID();
    const token = await mint({ sub, email: HER });

    expect((await getDocuments(token)).status).toBe(403);
    expect((await putDocument(token, "data", { body: GROUPS })).status).toBe(
      403,
    );
    expect(await countRows(sub)).toBe(0);
  });
});

/**
 * C3. RP-09 acceptance criterion 21. A CRUD matrix of user B against user A's
 * rows: B can read none of them, can update none of them, makes no version of
 * them, and has no route that deletes them (erasure arrives in batch 6.5).
 */
describe("C3 isolation — CRUD matrix", () => {
  const setUp = async () => {
    const aSub = randomUUID();
    const a = await mint({ sub: aSub, email: HER });
    const b = await mint({ email: HIM });
    const created = await putDocument(a, "data", { body: GROUPS });
    expect(created.status).toBe(200);
    const { updatedAt } = (await created.json()) as { updatedAt: string };
    return { a, aSub, b, updatedAt };
  };

  it("R: B's GET returns none of A's documents", async () => {
    const { b } = await setUp();

    expect(await documentsOf(await getDocuments(b))).toEqual({
      data: null,
      settings: null,
      template: null,
    });
  });

  it("U: B cannot overwrite A's row, even with A's updatedAt as the base", async () => {
    const { a, b, updatedAt } = await setUp();

    const response = await putDocument(b, "data", {
      body: [],
      baseUpdatedAt: updatedAt,
    });

    // B has no row, so A's timestamp is a stale base for B: 409, and B is
    // shown B's own (absent) copy, not A's.
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ document: null });
    expect((await documentsOf(await getDocuments(a))).data).toEqual({
      body: GROUPS,
      schemaVersion: 1,
      updatedAt,
    });
  });

  it("C and V: B's own writes create B's rows and no version of A's", async () => {
    const { a, aSub, b, updatedAt } = await setUp();

    const first = await putDocument(b, "data", { body: [] });
    const { updatedAt: bBase } = (await first.json()) as { updatedAt: string };
    expect(
      (await putDocument(b, "data", { body: [], baseUpdatedAt: bBase })).status,
    ).toBe(200);

    expect((await documentsOf(await getDocuments(a))).data).toEqual({
      body: GROUPS,
      schemaVersion: 1,
      updatedAt,
    });
    const versionsOfA = await rows(
      sql`select id from document_versions where user_id = ${aSub}`,
    );
    expect(versionsOfA).toEqual([]);
  });

  it("V: a save copies only the caller's own row into the versions", async () => {
    const { aSub } = await setUp();
    const bSub = randomUUID();
    const bToken = await mint({ sub: bSub, email: HIM });
    const first = (await (
      await putDocument(bToken, "data", { body: [] })
    ).json()) as { updatedAt: string };

    expect(
      (
        await putDocument(bToken, "data", {
          body: GROUPS,
          baseUpdatedAt: first.updatedAt,
        })
      ).status,
    ).toBe(200);

    // B's one version is B's old body, and A has no version at all.
    expect(
      await rows(
        sql`select user_id, body from document_versions where user_id in (${aSub}, ${bSub})`,
      ),
    ).toEqual([{ user_id: bSub, body: [] }]);
  });

  it("D: there is no delete route, so B cannot remove A's rows", async () => {
    const { a, b } = await setUp();

    expect((await request("DELETE", "/api/documents", b)).status).toBe(404);
    expect((await request("DELETE", "/api/documents/data", b)).status).toBe(
      404,
    );
    expect((await documentsOf(await getDocuments(a))).data?.body).toEqual(
      GROUPS,
    );
  });
});

/**
 * C4. The row's states are "absent" and "present at updatedAt T". A `PUT`
 * carries a base, and only a base equal to T (or null, while absent) moves the
 * state on. Every other transition is a 409 that writes nothing.
 */
describe("C4 optimistic concurrency — state transition", () => {
  it("no row + null base → 200 {updatedAt}, and GET returns the body", async () => {
    const token = await mint();

    const response = await putDocument(token, "settings", {
      body: { defaultCurrency: "PLN" },
    });

    expect(response.status).toBe(200);
    const { updatedAt } = (await response.json()) as { updatedAt: string };
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
    expect((await documentsOf(await getDocuments(token))).settings).toEqual({
      body: { defaultCurrency: "PLN" },
      schemaVersion: 1,
      updatedAt,
    });
  });

  it("row + same base → 200, a new updatedAt, and the old body kept as a version", async () => {
    const sub = randomUUID();
    const token = await mint({ sub });
    const first = (await (
      await putDocument(token, "template", { body: "First {{month}}" })
    ).json()) as { updatedAt: string };

    const response = await putDocument(token, "template", {
      body: "Second {{month}}",
      baseUpdatedAt: first.updatedAt,
    });

    expect(response.status).toBe(200);
    const second = (await response.json()) as { updatedAt: string };
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect((await documentsOf(await getDocuments(token))).template?.body).toBe(
      "Second {{month}}",
    );
    const versions = await rows(
      sql`select body, schema_version, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
          from document_versions where user_id = ${sub} and key = 'template'`,
    );
    expect(versions).toEqual([
      {
        body: "First {{month}}",
        schema_version: 1,
        updated_at: first.updatedAt,
      },
    ]);
  });

  it("row + stale base → 409 with the server copy, and nothing is overwritten", async () => {
    const token = await mint();
    const first = (await (
      await putDocument(token, "data", { body: GROUPS })
    ).json()) as { updatedAt: string };
    const second = (await (
      await putDocument(token, "data", {
        body: [],
        baseUpdatedAt: first.updatedAt,
      })
    ).json()) as { updatedAt: string };

    const response = await putDocument(token, "data", {
      body: GROUPS,
      baseUpdatedAt: first.updatedAt,
    });

    expect(response.status).toBe(409);
    const copy = { body: [], schemaVersion: 1, updatedAt: second.updatedAt };
    expect(await response.json()).toEqual({ document: copy });
    expect((await documentsOf(await getDocuments(token))).data).toEqual(copy);
  });

  it("row + null base → 409 with the server copy", async () => {
    const token = await mint();
    const first = (await (
      await putDocument(token, "data", { body: GROUPS })
    ).json()) as { updatedAt: string };

    const response = await putDocument(token, "data", { body: [] });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      document: { body: GROUPS, schemaVersion: 1, updatedAt: first.updatedAt },
    });
  });

  it("no row + a base → 409 with a null copy, and nothing is written", async () => {
    const sub = randomUUID();
    const token = await mint({ sub });

    const response = await putDocument(token, "data", {
      body: GROUPS,
      baseUpdatedAt: "2026-11-01T00:00:00.000Z",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ document: null });
    expect(await countRows(sub)).toBe(0);
  });
});

/**
 * C5. One invalid value per case, every other field valid, so each 400 is
 * caused by the value named. Error guessing adds the last three. Every case
 * must also write nothing (RP-09 AC 23 for the schema versions).
 */
describe("C5 validation — equivalence partitioning and error guessing", () => {
  const cases: [string, string, string][] = [
    ["non-array data", "data", JSON.stringify({ body: { name: "A" } })],
    [
      "group with no name",
      "data",
      JSON.stringify({ body: [{ price: 250, dates: [] }] }),
    ],
    [
      "price not a number",
      "data",
      JSON.stringify({ body: [{ name: "A", price: "250", dates: [] }] }),
    ],
    [
      "date not YYYY-MM-DD",
      "data",
      JSON.stringify({
        body: [{ name: "A", price: 250, dates: ["2026-7-6"] }],
      }),
    ],
    ["settings with no currency", "settings", JSON.stringify({ body: {} })],
    ["template not a string or null", "template", JSON.stringify({ body: 42 })],
    ["unknown key", "passwords", JSON.stringify({ body: "x" })],
    [
      "schemaVersion 0",
      "template",
      JSON.stringify({ body: "x", schemaVersion: 0 }),
    ],
    [
      "schemaVersion 2",
      "template",
      JSON.stringify({ body: "x", schemaVersion: 2 }),
    ],
    // Error guessing.
    [
      "month key not YYYY-MM",
      "data",
      JSON.stringify({
        body: [
          {
            name: "A",
            price: 250,
            dates: [],
            monthlyOverrides: { "2026-7": { price: 250, dates: [] } },
          },
        ],
      }),
    ],
    [
      "baseUpdatedAt not a date",
      "template",
      JSON.stringify({ body: "x", baseUpdatedAt: "yesterday" }),
    ],
    ["request not JSON", "template", "{not json"],
    // Postgres jsonb refuses U+0000 in any string, so without a check these
    // would be 500s from the database rather than 400s from the API.
    [
      "U+0000 in the template",
      "template",
      JSON.stringify({ body: "a\u0000b" }),
    ],
    [
      "U+0000 in a group name",
      "data",
      JSON.stringify({ body: [{ name: "A\u0000", price: 250, dates: [] }] }),
    ],
    [
      "U+0000 in a currency",
      "data",
      JSON.stringify({
        body: [{ name: "A", price: 250, currency: "UA\u0000H", dates: [] }],
      }),
    ],
    [
      "U+0000 in the default currency",
      "settings",
      JSON.stringify({ body: { defaultCurrency: "PLN\u0000" } }),
    ],
    [
      "U+0000 in a property name",
      "data",
      JSON.stringify({
        body: [{ name: "A", price: 250, dates: [], "x\u0000": 1 }],
      }),
    ],
  ];

  it.each(cases)("%s → 400 {error}, nothing written", async (_, key, raw) => {
    const sub = randomUUID();
    const token = await mint({ sub });
    // Fill in the fields the case does not name, without overriding it.
    let payload = raw;
    try {
      payload = JSON.stringify({
        schemaVersion: 1,
        baseUpdatedAt: null,
        ...(JSON.parse(raw) as object),
      });
    } catch {
      // "request not JSON" is sent as it is.
    }

    const response = await request(
      "PUT",
      `/api/documents/${key}`,
      token,
      payload,
    );

    expect(response.status).toBe(400);
    const answer = (await response.json()) as { error?: unknown };
    expect(Object.keys(answer)).toEqual(["error"]);
    expect(typeof answer.error).toBe("string");
    expect(await countRows(sub)).toBe(0);
  });
});

/**
 * C6. Three-value boundary value analysis on the cap of 50 previous versions.
 * The key starts with 49, 50 or 51 versions; one more save adds a copy of the
 * current row; afterwards exactly 50 remain, and the oldest are the ones gone.
 * The 51 case is a state the code never makes, so it is seeded directly.
 */
describe("C6 version cap — 3-value BVA", () => {
  it.each([49, 50, 51])(
    "%i previous versions, one more save → 50 remain, the oldest removed",
    async (existing) => {
      const sub = randomUUID();
      const base = "2026-11-01T00:00:00.000Z";
      await db.execute(
        sql`insert into documents (user_id, key, body, schema_version, updated_at)
            values (${sub}, 'data', '[]'::jsonb, 1, ${base}::timestamptz)`,
      );
      await db.execute(
        sql`insert into document_versions (user_id, key, body, schema_version, updated_at, saved_at)
            select ${sub}, 'data', to_jsonb(i), 1, ${base}::timestamptz,
                   '2026-01-01T00:00:00Z'::timestamptz + make_interval(mins => i)
            from generate_series(1, ${existing}::int) as i`,
      );
      // Another key of the same user, which the prune must not touch.
      await db.execute(
        sql`insert into document_versions (user_id, key, body, schema_version, updated_at, saved_at)
            values (${sub}, 'settings', '"other key"'::jsonb, 1, ${base}::timestamptz, '2020-01-01T00:00:00Z')`,
      );
      // Another user, with a row and old versions of the same key and of
      // another key. Neither the copy nor the prune may touch them.
      const other = randomUUID();
      await db.execute(
        sql`insert into documents (user_id, key, body, schema_version, updated_at)
            values (${other}, 'data', '"other user"'::jsonb, 1, ${base}::timestamptz)`,
      );
      await db.execute(
        sql`insert into document_versions (user_id, key, body, schema_version, updated_at, saved_at)
            select ${other}, k, to_jsonb(k), 1, ${base}::timestamptz,
                   '2019-01-01T00:00:00Z'::timestamptz + make_interval(mins => i)
            from generate_series(1, 3) as i, unnest(array['data', 'settings']) as k`,
      );
      const token = await mint({ sub });

      const response = await putDocument(token, "data", {
        body: GROUPS,
        baseUpdatedAt: base,
      });

      expect(response.status).toBe(200);
      const kept = await rows(
        sql`select body from document_versions
            where user_id = ${sub} and key = 'data' order by saved_at desc, id desc`,
      );
      expect(kept).toHaveLength(50);
      // The newest version is the row this save replaced.
      expect(kept[0]?.["body"]).toEqual([]);
      // The rest are the newest 49 seeds: existing − 48 … existing.
      const seeds = kept.slice(1).map((row) => Number(row["body"]));
      expect(Math.min(...seeds)).toBe(existing - 48);
      expect(Math.max(...seeds)).toBe(existing);
      expect(
        await rows(
          sql`select id from document_versions where user_id = ${sub} and key = 'settings'`,
        ),
      ).toHaveLength(1);
      expect(
        await rows(
          sql`select key, count(*)::int as n from document_versions
              where user_id = ${other} group by key order by key`,
        ),
      ).toEqual([
        { key: "data", n: 3 },
        { key: "settings", n: 3 },
      ]);
      expect(
        await rows(sql`select body from documents where user_id = ${other}`),
      ).toEqual([{ body: "other user" }]);
    },
  );
});

/**
 * C7. Three-value boundary value analysis on the 262 144-byte body limit. The
 * request is a valid template save padded to the exact size, so the only
 * thing that changes between the three cases is the length.
 */
describe("C7 body limit — 3-value BVA", () => {
  const LIMIT = 262_144;
  const bodyOfSize = (bytes: number): string => {
    const empty = JSON.stringify({
      body: "",
      schemaVersion: 1,
      baseUpdatedAt: null,
    });
    const padded = JSON.stringify({
      body: "x".repeat(bytes - Buffer.byteLength(empty)),
      schemaVersion: 1,
      baseUpdatedAt: null,
    });
    expect(Buffer.byteLength(padded)).toBe(bytes);
    return padded;
  };

  it.each([
    [LIMIT - 1, 200],
    [LIMIT, 200],
    [LIMIT + 1, 413],
  ])("%i bytes → %i", async (bytes, status) => {
    const sub = randomUUID();
    const token = await mint({ sub });

    const response = await request(
      "PUT",
      "/api/documents/template",
      token,
      bodyOfSize(bytes),
    );

    expect(response.status).toBe(status);
    expect(await countRows(sub)).toBe(status === 200 ? 1 : 0);
  });

  /**
   * The declared length is checked before the body is read. The proof is a
   * small, valid body that declares more than the limit: reading it would
   * find it small and save it, so a 413 means the header was enough.
   */
  it("a Content-Length over the limit → 413, before the body is read", async () => {
    const sub = randomUUID();
    const token = await mint({ sub });

    const response = await request(
      "PUT",
      "/api/documents/template",
      token,
      JSON.stringify({ body: "small", schemaVersion: 1, baseUpdatedAt: null }),
      { "content-length": String(LIMIT + 1) },
    );

    expect(response.status).toBe(413);
    expect(await countRows(sub)).toBe(0);
  });

  it("a Content-Length exactly at the limit, with that many bytes → 200", async () => {
    const sub = randomUUID();
    const token = await mint({ sub });

    const response = await request(
      "PUT",
      "/api/documents/template",
      token,
      bodyOfSize(LIMIT),
      { "content-length": String(LIMIT) },
    );

    expect(response.status).toBe(200);
    expect(await countRows(sub)).toBe(1);
  });
});
