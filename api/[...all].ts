import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createPublicKey, verify, type webcrypto } from "node:crypto";

import { Hono } from "hono";
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
 * `scripts/serve.mjs` inject — and the only operation either needs here is
 * running a statement. Batch 5.2 widens it when Better Auth's adapter asks for
 * more.
 *
 * PGlite is never named in this file. It is a devDependency, absent from a
 * deployment, and an ESM import resolves when the module loads rather than when
 * a branch is taken — so naming it on a branch that never runs would still
 * crash the function on import, while passing every local check. Lesson 30.
 */
export type Db = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
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

  currentDb = drizzle(new Pool({ connectionString: url }));
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
 * Neon Auth runs the sign-in server now (batch 5.5), so the in-process
 * `validateUserInfo` gate below is parked and no longer decides anything. Its
 * replacement is this: `user.before_create` is a **blocking** event, and the
 * response here decides whether the sign-up completes.
 *
 * **It is not at a path under `/api/auth/`** on purpose. That prefix is still
 * routed to the parked Better Auth handler, which would swallow it.
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
 * on creation. The allowlist is therefore also enforced per request by the API,
 * which Phase 6 needs regardless. See batch 5.5 for why that is the trade.
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

/** Forget the cached keys. Tests only. */
export const resetJwksCache = (): void => {
  jwksCache = null;
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
