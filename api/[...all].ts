import { attachDatabasePool } from "@vercel/functions";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createPublicKey, verify, type webcrypto } from "node:crypto";

import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";

/**
 * The whole backend, as one Hono application, and the Vercel function that
 * serves it.
 *
 * The application and the entry point are **one file on purpose.** Vercel
 * compiles each file under `api/` on its own — it transpiles rather than
 * bundles, so `api/[...all].ts` becomes `api/[...all].js` — while Node 24 runs
 * the TypeScript directly by stripping types. Those two disagree about how a
 * relative import must be spelled, and no spelling satisfies both:
 *
 * | in the source | Node 24, locally | after Vercel compiles it |
 * | ------------- | ---------------- | ------------------------ |
 * | `./app.ts`    | resolves         | `app.ts` is gone         |
 * | `./app.js`    | no such file     | resolves                 |
 * | `./app`       | no such file     | resolves                 |
 *
 * Shipping `./app.ts` passed every local check and then failed on the first
 * deployment with `ERR_MODULE_NOT_FOUND`. A file with no relative imports
 * cannot have that argument. `api/deployed-entry.test.ts` compiles this file
 * the way Vercel does and loads the result, so the next relative import fails
 * a test rather than a deployment. Lesson 26.
 *
 * Handlers stay on the Web-standard `Request` and `Response`, so the same
 * object runs as a Vercel function, under `scripts/serve.mjs` on Node, and on
 * Cloudflare Workers — the hedge for the hosting risk in deployment.md.
 * Nothing here imports a Vercel helper: `hono/vercel`'s `handle()` is exactly
 * `(req) => app.fetch(req)`, which `app.fetch` already is.
 *
 * Why one application and not one file per route: Vercel's Hobby plan caps a
 * deployment at 12 functions, and one is easy to count. The budget and the
 * reasoning are in .claude/context/backend.md.
 *
 * **This file imports published npm packages and nothing else** — not a
 * sibling, and not a workspace package of this repository either.
 *
 * Batch 5.1a tried the workspace package. Lesson 26 had prescribed it, and it
 * worked in every local direction: Node 24 strips types inside `node_modules`,
 * `tsc` leaves a bare specifier untouched, and `deployed-entry.test.ts` passed
 * while failing correctly when the specifier was broken. The deployment still
 * returned 500 on every request:
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module
 *     '/var/task/node_modules/@lesson-planner/db/index.ts'
 *     imported from /var/task/api/[...all].js
 *
 * Read the path. Vercel traced the package and made the directory, then shipped
 * no `index.ts` into it: it compiles what is under `api/` and treats a
 * workspace package's TypeScript source as nothing it needs to build. So the
 * specifier resolved and the file behind it did not exist. **A bare specifier
 * is necessary but not sufficient — the thing it names has to be something the
 * platform actually ships.** Lesson 31.
 *
 * Hence the database seam below lives in this file. `pg` and `drizzle-orm` are
 * ordinary dependencies in the root `package.json`, so `npm ci` puts real
 * JavaScript in `node_modules` where the function can find it. `db/` still
 * exists for the schema, the migrations and the PGlite helper — all of which
 * run on a laptop, in CI and in the build, and none of which the function
 * loads.
 */
export const app = new Hono().basePath("/api");

/**
 * The database, and how this function gets one.
 *
 * Narrow on purpose. `Db` is the shape both drizzle instances satisfy — the
 * node-postgres one this file builds, and the PGlite one the tests and
 * `scripts/serve.mjs` inject. Two operations are needed: running a statement,
 * and running several in one transaction, which the documents `PUT` needs
 * (batch 6.1) so that a save, its version copy and the prune land together or
 * not at all.
 *
 * PGlite is never named in this file. It is a devDependency, absent from a
 * deployment, and an ESM import resolves when the module loads rather than when
 * a branch is taken — so naming it on a branch that never runs would still
 * crash the function on import, while passing every local check. Lesson 30.
 */
export type DbExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export type Db = DbExecutor & {
  transaction: <T>(run: (tx: DbExecutor) => Promise<T>) => Promise<T>;
};

let currentDb: Db | null = null;

/**
 * Replace the database this process uses.
 *
 * Called by the tests and by `scripts/serve.mjs`, which pass a PGlite database
 * so that `npm run serve` and the whole Playwright suite need no account and no
 * secret. A deployment never calls it, so `getDb()` builds the real pool.
 */
export const setDb = (db: Db | null): void => {
  currentDb = db;
};

/**
 * The database for this process, created once and reused.
 *
 * One pool at module scope, not one per request: a pool per invocation is how a
 * serverless function exhausts a database's connection limit, and Neon's pooled
 * endpoint expects a long-lived client. `pg` over TCP against the pooled string
 * rather than Neon's HTTP driver — that driver's pool must be opened and closed
 * inside one handler, which does not suit an auth library holding one pool.
 * The reasoning is in .claude/context/backend.md.
 *
 * Throws when there is no connection string and nothing was injected. A clear
 * message at the first query beats a connection error further away from its
 * cause.
 */
export const getDb = (): Db => {
  if (currentDb) return currentDb;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "No database: DATABASE_URL is unset and no database was injected with setDb().",
    );
  }

  const pool = new Pool({ connectionString: url });
  // Vercel suspends a function between requests. Without this, idle clients
  // stay open across the suspension and leak; with it, Vercel waits for idle
  // clients to close before it suspends (batch 6.1). Outside Vercel it does
  // nothing, so the local server and the tests are unaffected.
  attachDatabasePool(pool);
  currentDb = drizzle(pool);
  return currentDb;
};

/** What `GET /api/health` reports about the database. */
export type DbHealth =
  | { status: "ok"; queryMs: number }
  | { status: "error"; queryMs: number }
  | { status: "unconfigured" };

/**
 * Ask the database whether it is answering, and how long it took.
 *
 * `SELECT 1` and nothing else. This route answers before anyone has signed in,
 * so it must never read or write application data.
 *
 * A failure is reported, never thrown: a health check that crashes tells a
 * caller less than one that answers "error". `unconfigured` is a third answer
 * rather than a failure, because "no database is configured here" is the true
 * state on a laptop with no `.env.local`, in CI, and on a deployment that has
 * not been given a connection string — the same distinction `commit: null`
 * draws between "not deployed" and "deployed and wrong".
 */
export const pingDb = async (): Promise<DbHealth> => {
  let db: Db;
  try {
    db = getDb();
  } catch {
    return { status: "unconfigured" };
  }

  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", queryMs: Math.round(performance.now() - started) };
  } catch {
    return {
      status: "error",
      queryMs: Math.round(performance.now() - started),
    };
  }
};

/**
 * Who may sign in.
 *
 * `ALLOWED_EMAILS` is a comma-separated list, and exactly two people are on it.
 * Parsing and matching are separate exported functions because they are the
 * whole security boundary and deserve tests of their own — building a Better
 * Auth instance to check that a comma is handled would test the wrong thing.
 *
 * Addresses are compared trimmed and lower-cased on **both** sides. Google
 * returns the address it holds, and the person who types the allowlist is not
 * the person who typed the Google account.
 */
export const parseAllowlist = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

/**
 * Is this address on the list?
 *
 * **An empty list allows nobody.** That is the deliberate direction to fail: a
 * missing or mistyped `ALLOWED_EMAILS` locks the owner out, which she will
 * report in a minute, rather than opening the app to anyone with a Google
 * account, which nobody would notice. The library's own gate fails closed for
 * the same reason, so this agrees with it.
 */
export const isAllowed = (
  email: string | null | undefined,
  allowlist: string[],
): boolean => {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
};

/**
 * The allowlist, as a webhook Neon calls before it creates a user.
 *
 * Neon Auth runs the sign-in server (batch 5.5), and the self-run Better Auth
 * server with its `validateUserInfo` gate was removed in batch 5.7. This is
 * the gate now: `user.before_create` is a **blocking** event, and the response
 * here decides whether the sign-up completes.
 *
 * It sits under `/api/hooks/`, not `/api/auth/`. When batch 5.6 added it,
 * `/api/auth/*` still went to the self-run handler, which would have swallowed
 * it. That handler is gone, and the path stays where Neon is configured to
 * call it.
 *
 * Two properties this handler has to have, and one it gets for free.
 *
 * - **It fails closed.** Every path that is not "verified, and on the list"
 *   refuses. A webhook that answers "allowed" when it is confused is a door.
 * - **It is idempotent**, which Neon requires because a retry carries the same
 *   `X-Neon-Event-Id`. That is free here rather than built: the answer is a pure
 *   function of the e-mail against the allowlist, so the same event always gets
 *   the same reply and nothing has to be remembered.
 *
 * What it does **not** do is run on a returning sign-in — that event only fires
 * on creation. The per-request allowlist check arrived with the first route
 * that reads user data: `identify()`, below, runs on every documents request
 * (batch 6.1, closing batch 5.4's checklist row 13).
 */

/** How long a signed webhook stays acceptable. Replay protection. */
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

// Typed as Node's own JWK rather than a local shape, so the key goes into
// `createPublicKey` with no cast — and a malformed key is a type error here
// instead of a runtime one inside the crypto library.
// Node's own JWK, so the key goes into `createPublicKey` with no cast. The
// intersection adds `kid`, which the JOSE spec has and Node's type does not —
// it is how the right key is picked out of the set.
type Jwks = { keys: (webcrypto.JsonWebKey & { kid?: string })[] };
let jwksCache: { at: number; jwks: Jwks } | null = null;

/**
 * Neon's signing keys, cached for a minute.
 *
 * Fetched rather than configured because they rotate, and cached because this
 * runs on the path of every sign-up. A minute is short enough that a rotation
 * is picked up promptly and long enough that a burst does not hammer Neon.
 */
const neonJwks = async (baseUrl: string): Promise<Jwks> => {
  if (jwksCache && Date.now() - jwksCache.at < 60_000) return jwksCache.jwks;

  const response = await fetch(`${baseUrl}/.well-known/jwks.json`);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed with ${String(response.status)}`);
  }
  const jwks = (await response.json()) as Jwks;
  jwksCache = { at: Date.now(), jwks };
  return jwks;
};

/** Forget the cached keys, the webhook's and the documents API's. Tests only. */
export const resetJwksCache = (): void => {
  jwksCache = null;
  userJwks.clear();
};

/**
 * Is this really Neon, and is it recent?
 *
 * Ed25519 over a detached JWS, exactly as Neon documents it. **The raw body is
 * the input** — re-serialising the parsed JSON would produce different bytes
 * and a signature that never verifies, which is the trap their own guide warns
 * about.
 */
export const verifyNeonWebhook = async (
  rawBody: string,
  headers: Headers,
  baseUrl: string,
): Promise<boolean> => {
  const signature = headers.get("x-neon-signature");
  const kid = headers.get("x-neon-signature-kid");
  const timestamp = headers.get("x-neon-timestamp");
  if (!signature || !kid || !timestamp) return false;

  // Replay protection before any cryptography: an old signature is a valid
  // signature, and this is the cheaper check.
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age > WEBHOOK_MAX_AGE_MS) return false;

  const [headerB64, detached, signatureB64] = signature.split(".");
  if (headerB64 === undefined || detached !== "" || !signatureB64) return false;

  const jwks = await neonJwks(baseUrl);
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) return false;

  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signed = Buffer.from(`${timestamp}.${payloadB64}`, "utf8").toString(
    "base64url",
  );

  return verify(
    null,
    Buffer.from(`${headerB64}.${signed}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signatureB64, "base64url"),
  );
};

/** What the webhook answers. `allowed: false` is a refusal, not an error. */
export type WebhookDecision = {
  allowed: boolean;
  error_message?: string;
  error_code?: string;
};

/** The decision itself, separated so it can be tested without a signature. */
export const decideSignUp = (
  email: string | null | undefined,
): WebhookDecision =>
  isAllowed(email, parseAllowlist(process.env["ALLOWED_EMAILS"]))
    ? { allowed: true }
    : {
        allowed: false,
        error_message:
          "This account is not allowed to sign in to this planner.",
        error_code: "NOT_ALLOWED",
      };

app.post("/hooks/neon-auth", async (c) => {
  const baseUrl = process.env["NEON_AUTH_BASE_URL"];
  // No base URL means the signature cannot be checked, and an unverifiable
  // request is not one to say yes to.
  if (!baseUrl)
    return c.json({ allowed: false } satisfies WebhookDecision, 500);

  const rawBody = await c.req.text();

  let verified: boolean;
  try {
    verified = await verifyNeonWebhook(rawBody, c.req.raw.headers, baseUrl);
  } catch {
    // Our own failure — Neon's keys were unreachable, say. A 500 is retried
    // (three attempts), which is kinder to a real person than an immediate
    // refusal, and still ends in a refusal if it never succeeds.
    return c.json({ allowed: false } satisfies WebhookDecision, 500);
  }

  // Not signed by Neon, so not Neon. 401 rather than a decision: there is no
  // sign-up here to allow or deny.
  if (!verified) return c.json({ error: "invalid signature" }, 401);

  let email: string | null = null;
  try {
    const body = JSON.parse(rawBody) as { user?: { email?: string } };
    email = body.user?.email ?? null;
  } catch {
    return c.json({ allowed: false } satisfies WebhookDecision, 400);
  }

  return c.json(decideSignUp(email));
});

/**
 * The documents API (batch 6.1): `GET /api/documents` and
 * `PUT /api/documents/:key`. Nothing in the app calls it yet; batch 6.2 does.
 *
 * The teacher's three planner keys become three rows on the server, one per
 * user and key. The rules are in .claude/context/backend.md and
 * security-auth.md, "Decided on 2026-11-15":
 *
 * - **Every request is checked, not only sign-up.** The Neon Auth token is
 *   verified, then its e-mail is checked against the allowlist. Both fail
 *   closed.
 * - **Every query has `WHERE user_id = <sub>`.** There is no other way in to a
 *   row: no admin route and no user listing.
 * - **Every write keeps the previous version**, capped at 50 per key, in the
 *   same transaction as the write.
 * - **A write names the version it replaces** (`baseUpdatedAt`). A stale base
 *   is a 409 with the server copy; a person chooses, nothing is merged.
 *
 * The queries are drizzle `sql` templates. This file does not import
 * `db/schema.ts`, because the deployed entry may import published packages
 * only (lesson 31); the PGlite tests apply the real migration, so a column
 * that exists here and not in the schema fails a test.
 */

/** The three documents a user has, one per planner key (batch 6.1). */
export type DocumentKey = "data" | "settings" | "template";

const DOCUMENT_KEYS: readonly DocumentKey[] = ["data", "settings", "template"];

const isDocumentKey = (key: string): key is DocumentKey =>
  (DOCUMENT_KEYS as readonly string[]).includes(key);

/** The one schema version this server accepts (RP-09 AC 23). */
const SCHEMA_VERSION = 1;

/** How many previous bodies each user and key keeps. */
const VERSION_CAP = 50;

/** 256 KB. A Vercel function body is capped at 4.5 MB, well above this. */
const BODY_LIMIT_BYTES = 262_144;

/**
 * Neon's key set for each auth URL, made once and reused.
 *
 * `createRemoteJWKSet` caches the keys itself and fetches them again when a
 * token names a `kid` it has not seen, which is how a key rotation is picked
 * up. Keyed by URL so that a test, or a change of variable, never reuses a set
 * for another issuer.
 */
const userJwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const userJwksFor = (
  baseUrl: string,
): ReturnType<typeof createRemoteJWKSet> => {
  let jwks = userJwks.get(baseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));
    userJwks.set(baseUrl, jwks);
  }
  return jwks;
};

/**
 * Who sent this token, or `null` if it proves nothing.
 *
 * The rules are Neon's, from its JWT guide: EdDSA only, and `iss` and `aud`
 * both equal to the origin of the auth URL. `exp` and `sub` are **required**:
 * jose accepts a token with no `exp` unless told otherwise, and such a token
 * would never expire. A token with no `email` proves nothing the allowlist can
 * use, so it is refused here too.
 *
 * Every failure is `null`, including Neon's keys being unreachable: the caller
 * answers 401 and the client asks for a fresh token.
 */
export const verifyUserToken = async (
  token: string,
  baseUrl: string,
): Promise<{ sub: string; email: string } | null> => {
  try {
    const origin = new URL(baseUrl).origin;
    const { payload } = await jwtVerify(token, userJwksFor(baseUrl), {
      algorithms: ["EdDSA"],
      issuer: origin,
      audience: origin,
      requiredClaims: ["exp", "sub"],
    });
    const { sub } = payload;
    const email: unknown = payload["email"];
    if (typeof sub !== "string" || sub === "") return null;
    if (typeof email !== "string" || email === "") return null;
    return { sub, email };
  } catch {
    return null;
  }
};

/** The outcome of checking a request's `Authorization` header. */
type Caller =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Token first, then the allowlist, on every request.
 *
 * No `NEON_AUTH_BASE_URL` means no token can be checked at all. That is this
 * deployment's fault, not the caller's, so it is a 500 — the webhook answers
 * the same way — and nothing is read.
 */
const identify = async (header: string | undefined): Promise<Caller> => {
  const baseUrl = process.env["NEON_AUTH_BASE_URL"];
  if (!baseUrl) {
    return { ok: false, status: 500, error: "sign-in is not configured" };
  }

  const token = /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];
  if (!token) return { ok: false, status: 401, error: "no token" };

  const user = await verifyUserToken(token, baseUrl);
  if (!user) return { ok: false, status: 401, error: "invalid token" };

  if (!isAllowed(user.email, parseAllowlist(process.env["ALLOWED_EMAILS"]))) {
    return { ok: false, status: 403, error: "not allowed" };
  }
  return { ok: true, userId: user.sub };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const isDateList = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every((date) => typeof date === "string" && DATE.test(date));

const isMonthRow = (value: unknown): boolean =>
  isRecord(value) &&
  isFiniteNumber(value["price"]) &&
  isDateList(value["dates"]);

const isGroup = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const { name, price, currency, dates, monthlyOverrides } = value;
  if (typeof name !== "string" || name.trim() === "") return false;
  if (!isFiniteNumber(price) || !isDateList(dates)) return false;
  // Both are absent in data written by older versions (DEF-003).
  if (currency !== undefined && typeof currency !== "string") return false;
  if (monthlyOverrides === undefined) return true;
  return (
    isRecord(monthlyOverrides) &&
    Object.entries(monthlyOverrides).every(
      ([month, row]) => MONTH.test(month) && isMonthRow(row),
    )
  );
};

/**
 * Is this a body the app could have stored under this key?
 *
 * The shapes are the storage contract's (storage-data-contract.md, "The three
 * keys"). The app's loader **mends** a bad value; this check **refuses** one,
 * because a server copy is what every device loads next, and a mend made here
 * would be made silently. Properties the contract does not name are allowed,
 * so that nothing the legacy app wrote is refused for an extra field.
 *
 * `api/validation-parity.test.ts` runs the app's fixtures through both this
 * and the app's loader, which is what keeps the two from drifting.
 */
export const validateDocument = (key: DocumentKey, body: unknown): boolean => {
  switch (key) {
    case "data":
      return Array.isArray(body) && body.every(isGroup);
    case "settings":
      return (
        isRecord(body) &&
        typeof body["defaultCurrency"] === "string" &&
        body["defaultCurrency"] !== ""
      );
    case "template":
      // `null` means "use the default template", as an absent key does.
      return body === null || typeof body === "string";
  }
};

/** One document as the API returns it. */
type StoredDocument = {
  body: unknown;
  schemaVersion: number;
  updatedAt: string;
};

type DocumentRow = {
  key: string;
  body: string | null;
  schema_version: number;
  updated_at: string;
};

/**
 * `updated_at` as an ISO 8601 string in UTC, to the millisecond, made by the
 * database so the two drivers cannot format it differently. The client sends
 * this exact string back as `baseUpdatedAt`.
 */
const UPDATED_AT_ISO = sql.raw(
  `to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
);

const rowsOf = <T>(result: unknown): T[] => (result as { rows: T[] }).rows;

/**
 * The body is read as text and parsed here, so both drivers hand back the
 * same JSON. A SQL `NULL` and a JSON `null` both read as `null`.
 */
const toDocument = (row: DocumentRow): StoredDocument => ({
  body: row.body === null ? null : (JSON.parse(row.body) as unknown),
  schemaVersion: row.schema_version,
  updatedAt: row.updated_at,
});

const selectDocument = async (
  db: DbExecutor,
  userId: string,
  key: DocumentKey,
  lock: boolean,
): Promise<StoredDocument | null> => {
  const [row] = rowsOf<DocumentRow>(
    await db.execute(
      sql`select key, body::text as body, schema_version, ${UPDATED_AT_ISO} as updated_at
          from documents
          where user_id = ${userId} and key = ${key}
          ${lock ? sql`for update` : sql``}`,
    ),
  );
  return row ? toDocument(row) : null;
};

app.get("/documents", async (c) => {
  const caller = await identify(c.req.header("authorization"));
  if (!caller.ok) return c.json({ error: caller.error }, caller.status);

  const rows = rowsOf<DocumentRow>(
    await getDb().execute(
      sql`select key, body::text as body, schema_version, ${UPDATED_AT_ISO} as updated_at
          from documents
          where user_id = ${caller.userId}`,
    ),
  );

  const documents: Record<DocumentKey, StoredDocument | null> = {
    data: null,
    settings: null,
    template: null,
  };
  for (const row of rows) {
    if (isDocumentKey(row.key)) documents[row.key] = toDocument(row);
  }
  return c.json({ documents });
});

/** What a save did, decided inside the transaction and answered outside it. */
type SaveOutcome =
  | { saved: true; updatedAt: string }
  | { saved: false; document: StoredDocument | null };

/**
 * The save itself, in one transaction.
 *
 * The current row is locked first (`for update`), so two saves of one key
 * queue rather than both reading the same base. The new `updated_at` is the
 * database clock to the millisecond, and always at least a millisecond after
 * the old one, so a base can never match two versions.
 *
 * With no row, a save with a `null` base creates one. `on conflict do nothing`
 * covers the race where two first saves arrive together: the second inserts
 * nothing, reads the winner's row, and gets the 409 it would have got had it
 * arrived a moment later.
 */
const saveDocument = (
  db: Db,
  userId: string,
  key: DocumentKey,
  body: unknown,
  base: string | null,
): Promise<SaveOutcome> =>
  db.transaction(async (tx) => {
    const json = JSON.stringify(body);
    const current = await selectDocument(tx, userId, key, true);

    if (current === null) {
      if (base !== null) return { saved: false, document: null };
      const [created] = rowsOf<{ updated_at: string }>(
        await tx.execute(
          sql`insert into documents (user_id, key, body, schema_version, updated_at)
              values (${userId}, ${key}, ${json}::jsonb, ${SCHEMA_VERSION},
                      date_trunc('milliseconds', clock_timestamp()))
              on conflict (user_id, key) do nothing
              returning ${UPDATED_AT_ISO} as updated_at`,
        ),
      );
      if (created) return { saved: true, updatedAt: created.updated_at };
      return {
        saved: false,
        document: await selectDocument(tx, userId, key, false),
      };
    }

    if (base === null || base !== current.updatedAt) {
      return { saved: false, document: current };
    }

    await tx.execute(
      sql`insert into document_versions (user_id, key, body, schema_version, updated_at)
          select user_id, key, body, schema_version, updated_at
          from documents
          where user_id = ${userId} and key = ${key}`,
    );
    const [updated] = rowsOf<{ updated_at: string }>(
      await tx.execute(
        sql`update documents
            set body = ${json}::jsonb,
                schema_version = ${SCHEMA_VERSION},
                updated_at = greatest(
                  date_trunc('milliseconds', clock_timestamp()),
                  updated_at + interval '1 millisecond')
            where user_id = ${userId} and key = ${key}
            returning ${UPDATED_AT_ISO} as updated_at`,
      ),
    );
    await tx.execute(
      sql`delete from document_versions
          where user_id = ${userId} and key = ${key}
            and id not in (
              select id from document_versions
              where user_id = ${userId} and key = ${key}
              order by saved_at desc, id desc
              limit ${VERSION_CAP})`,
    );
    if (!updated) throw new Error("the locked row disappeared");
    return { saved: true, updatedAt: updated.updated_at };
  });

/**
 * Reads the request body, refusing it above the limit.
 *
 * A `Content-Length` over the limit is refused before anything is read. The
 * bytes are counted as well, because a request need not carry the header.
 */
const readLimitedBody = async (
  request: Request,
): Promise<{ text: string } | { tooLarge: true }> => {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_LIMIT_BYTES) {
    return { tooLarge: true };
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > BODY_LIMIT_BYTES) return { tooLarge: true };
  return { text: new TextDecoder().decode(bytes) };
};

/** A `PUT` body, checked field by field, or the reason it was refused. */
const parseSave = (
  key: DocumentKey,
  raw: string,
): { body: unknown; base: string | null } | { error: string } => {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { error: "the request is not JSON" };
  }
  if (!isRecord(payload) || !("body" in payload)) {
    return { error: "the request has no body field" };
  }
  if (payload["schemaVersion"] !== SCHEMA_VERSION) {
    return { error: `schemaVersion must be ${String(SCHEMA_VERSION)}` };
  }
  const base = payload["baseUpdatedAt"];
  if (
    base !== null &&
    (typeof base !== "string" || Number.isNaN(Date.parse(base)))
  ) {
    return { error: "baseUpdatedAt must be a timestamp or null" };
  }
  if (!validateDocument(key, payload["body"])) {
    return { error: `the body is not a valid ${key} document` };
  }
  // Compared as the canonical ISO string the server hands out, so an
  // equivalent spelling of the same instant still matches.
  return {
    body: payload["body"],
    base: base === null ? null : new Date(base).toISOString(),
  };
};

app.put("/documents/:key", async (c) => {
  const caller = await identify(c.req.header("authorization"));
  if (!caller.ok) return c.json({ error: caller.error }, caller.status);

  const key = c.req.param("key");
  if (!isDocumentKey(key)) return c.json({ error: "unknown key" }, 400);

  const raw = await readLimitedBody(c.req.raw);
  if ("tooLarge" in raw) {
    return c.json({ error: "the body is too large" }, 413);
  }

  const save = parseSave(key, raw.text);
  if ("error" in save) return c.json({ error: save.error }, 400);

  const outcome = await saveDocument(
    getDb(),
    caller.userId,
    key,
    save.body,
    save.base,
  );
  return outcome.saved
    ? c.json({ updatedAt: outcome.updatedAt })
    : c.json({ document: outcome.document }, 409);
});

/** Whether sign-in can work on this deployment. */
export type AuthHealth = "ready" | "unconfigured";

/**
 * Can this deployment sign anyone in?
 *
 * It used to ask whether the auth tables existed in our database, because we
 * ran the auth server. Neon runs it now (batch 5.5) and owns those tables in
 * its own `neon_auth` schema, so that question stopped being about us.
 *
 * What is left is the thing this deployment actually controls: whether the
 * allowlist webhook can verify that a request came from Neon. Without
 * `NEON_AUTH_BASE_URL` it cannot fetch the signing keys, so it refuses every
 * sign-up — and this route says so rather than leaving it to be discovered by
 * somebody who cannot sign in.
 *
 * It makes no network call. Reaching Neon on every health check would turn a
 * cheap route into a slow one and make our health depend on theirs.
 */
export const authHealth = (): AuthHealth =>
  process.env["NEON_AUTH_BASE_URL"] ? "ready" : "unconfigured";

/**
 * The deployment's own identity, never the app's data.
 *
 * Both variables are Vercel *system* variables, which are public by definition —
 * the commit SHA is already visible in the repository and the region is visible
 * in a response header. No secret is read here, and none should be: this route
 * answers before anyone has signed in.
 *
 * `null` rather than a guess when a variable is absent. Locally there is no
 * deployment, so there is no commit and no region, and saying so is more useful
 * than "unknown" — a caller can tell "not deployed" from "deployed and broken".
 */
app.get("/health", async (c) => {
  const db = await pingDb();
  const auth = authHealth();

  return c.json({
    ok: true,
    commit: process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
    region: process.env["VERCEL_REGION"] ?? null,
    db: db.status,
    dbQueryMs: db.status === "unconfigured" ? null : db.queryMs,
    // Separate from `db` on purpose: sign-in no longer lives in this database
    // at all, so a healthy database says nothing about whether anyone can sign
    // in. It reports whether the allowlist webhook can verify Neon's signature,
    // which is the part of sign-in this deployment is responsible for.
    auth,
  });
});

/**
 * The Vercel entry point. One catch-all file takes every `/api/*` request, so
 * the deployment has one function rather than one per route.
 *
 * **Export the application, not `app.fetch`.** Vercel's Web-standard export is
 * an *object carrying a `fetch` method* — its documented example is
 * `export default { fetch(request) { … } }` — and a Hono app is exactly that.
 * A bare function is read as the other supported shape, a Node.js
 * `(request, response)` handler. Exporting `app.fetch` therefore did not fail
 * loudly: Vercel called it with Node's `IncomingMessage` and `ServerResponse`,
 * threw away the `Response` it returned, and waited for a `response.end()` that
 * a Web-standard handler never calls. Every request hung for the full function
 * timeout. `hono/vercel`'s `handle()` has the same bare-function shape and is
 * not the fix either.
 *
 * The catch-all name is **proven**: the first deployment returned a function
 * error for `/api/health` and `/api/nope` alike, and a name Vercel had not
 * accepted would have returned the static site's 404 instead.
 */
export default app;
