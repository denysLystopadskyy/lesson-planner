import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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
 * The Drizzle schema.
 *
 * The four tables below are Better Auth's core schema (plan batch 5.2a). They
 * are the library's, not ours: the column names and types are what its Drizzle
 * adapter queries, so a rename here is a runtime failure, not a refactor.
 *
 * **They are verified rather than transcribed.** `api/auth.test.ts` runs the
 * real adapter against a real PGlite database with these migrations applied,
 * creating and reading a user. A column this file gets wrong fails that test
 * instead of failing a sign-in on production.
 *
 * The app's own tables — `documents` and `document_versions` — are still Phase
 * 6's, with their shape decided in `.claude/context/storage-data-contract.md`.
 *
 * **Migrations are additive only.** Never drop or rename a column that running
 * code still reads. The rule and its reason are in
 * `.claude/context/backend.md`.
 */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // Better Auth looks a user up by e-mail on every sign-in, and treats the
  // address as the identity. The unique index is what stops two rows claiming
  // the same person if a race ever slips past the application check.
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("session_token_unique").on(table.token)],
);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  // Present for the test-only e-mail-and-password provider, which exists so the
  // end-to-end suite can hold a session without Google. Never set on a
  // deployment: that provider is enabled only when AUTH_TEST_MODE=1.
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Rate-limit counters.
 *
 * Required because this configuration sets `rateLimit.storage: "database"`, and
 * Better Auth refuses to start without the table — `SchemaMismatchError:
 * Missing tables: rateLimit`. It was missing from the first version of batch
 * 5.2a, and the deployment and the local server both answered 500 on every
 * `/api/auth/*` request because of it.
 *
 * The property names are what matter, not the column names: the adapter looks a
 * field up by the key in this object, so `lastRequest` may sit in a
 * `last_request` column. `lastRequest` is a bigint because it holds
 * `Date.now()` in milliseconds, which leaves the range of a 32-bit integer.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)],
);

const schema = { user, session, account, verification, rateLimit };

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
 * Is the test-only sign-in path on?
 *
 * The e-mail-and-password provider exists so the end-to-end suite can hold a
 * real session without Google, which allows no wildcard redirect URIs and so
 * cannot work against a preview deployment. `scripts/serve.mjs` sets the flag;
 * Vercel never does, and `api/auth.test.ts` asserts that the configuration
 * built without it has no such provider.
 *
 * Exactly `"1"`, not "truthy". A variable that is present but empty, or set to
 * "false", must not open a password door on a deployment.
 */
export const isTestMode = (): boolean => process.env["AUTH_TEST_MODE"] === "1";

/**
 * Where sign-in is allowed to come back to.
 *
 * Google forbids wildcard redirect URIs, so real Google sign-in works on
 * production and on localhost only — a preview's URL changes per commit. The
 * preview pattern is still listed because Better Auth uses `trustedOrigins` for
 * its own CSRF check, which is a different question from Google's.
 */
const trustedOrigins = (): string[] => {
  const origins = ["http://localhost:4173"];
  const base = process.env["BETTER_AUTH_URL"];
  if (base) origins.push(base);
  const vercel = process.env["VERCEL_URL"];
  if (vercel) origins.push(`https://${vercel}`);
  return origins;
};

/**
 * The Better Auth instance, built once and reused.
 *
 * Built lazily rather than at module load for one reason: this file is imported
 * by `GET /api/health`, by the unit tests and by `scripts/serve.mjs`, and a
 * module-scope `betterAuth()` call would need a database and a secret before
 * anything had decided which. Building it on first use lets the health route
 * answer on a deployment that has no auth configured yet.
 *
 * `buildAuth` is exported so a test can build a configuration and inspect it
 * without touching module state — which is how the "production has no password
 * provider" guard is written.
 */
export const buildAuth = (db: Db, testMode: boolean) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:4173",
    secret: process.env["BETTER_AUTH_SECRET"] ?? undefined,
    trustedOrigins: trustedOrigins(),
    // Sessions live in the database, not in a signed cookie, so signing out
    // actually ends them server-side — checklist row 17 in batch 5.4.
    session: { storeSessionInDatabase: true },
    // Counters in memory do not survive a serverless instance, so a burst can
    // simply land on a fresh one. The database is the only shared place.
    // Off in test mode, and on everywhere else.
    //
    // Locally there is no client IP — no proxy sets one — so Better Auth falls
    // back to a single shared bucket, and the end-to-end suite then competes
    // with itself: each spec signs in once, and the later ones were answered
    // 429. Throttling the suite proves nothing about throttling an attacker.
    //
    // `AUTH_TEST_MODE` therefore means two things now, and both belong to the
    // same idea — *this is not a deployment*. The guard in `api/auth.test.ts`
    // asserts the production configuration keeps rate limiting on, so this
    // cannot quietly become the default. Real throttling is observed on a
    // deployment in batch 5.4's checklist row 16, which is the only place a
    // per-IP limit means anything.
    rateLimit: { enabled: !testMode, storage: "database" },
    advanced: {
      /**
       * Where the client's IP comes from, and why only these two headers.
       *
       * Without this, Better Auth cannot resolve an address and warns that it
       * is "falling back to a single shared per-path bucket" — one bucket for
       * everybody, so one person's failed attempts would throttle the other.
       * With two users that is not an abuse risk, it is an availability one.
       *
       * **An IP header is only as trustworthy as whatever set it.** These two
       * are set by Vercel's edge on the way in, and a client-supplied value is
       * overwritten there, so on the deployment they can be believed. Locally
       * there is no proxy and neither header is present, which is why the
       * warning appears under `scripts/serve.mjs` and is correct to: there
       * genuinely is one client. Never add a header here that an origin does
       * not control — that is how a rate limit becomes opt-out.
       *
       * Batch 5.4's checklist row 16 observes the throttling on a deployment,
       * which is the only place this configuration can be shown to work.
       */
      ipAddress: {
        ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
      },
    },
    // Google is configured only when it can be.
    //
    // Empty strings are not a neutral placeholder: Better Auth rejects them
    // with `CLIENT_ID_AND_SECRET_REQUIRED` and logs a SERVER_ERROR on requests
    // that touch the provider. On a laptop and in CI there are no Google
    // credentials and there should not be — the suite signs in through the
    // test-only path — so the honest configuration has no Google provider at
    // all there, rather than one that cannot work.
    socialProviders: socialProviders(),
    // The test-only door, and it is the only conditional in this configuration.
    ...(testMode ? { emailAndPassword: { enabled: true } } : {}),
    user: {
      /**
       * The allowlist, enforced server-side.
       *
       * Verified in the installed library rather than taken from its
       * documentation: this gate is invoked from three places in
       * better-auth 1.7.5 — `db/internal-adapter.mjs` with `action:
       * "create-user"`, and `oauth2/link-account.mjs` with `action:
       * "link-account"` and, on the returning-user path, `action: "sign-in"`.
       * So it runs on every sign-in and not only the first, which is what
       * batch 5.4's checklist row 13 asks for.
       *
       * The library also fails closed: if this function throws, provisioning is
       * rejected rather than allowed.
       */
      validateUserInfo: ({ user }: { user: { email?: string | null } }) => {
        if (
          isAllowed(user.email, parseAllowlist(process.env["ALLOWED_EMAILS"]))
        ) {
          return;
        }
        return {
          error: "not_allowed",
          errorDescription:
            "This account is not allowed to sign in to this planner.",
        };
      },
    },
  });

/**
 * The type is inferred from `buildAuth` rather than written as
 * `ReturnType<typeof betterAuth>`. Better Auth's return type is generic in the
 * exact options object it was given, so the annotated version is a *different*
 * type from what this configuration produces and will not accept it.
 */
/**
 * Google, if it can be configured — otherwise no social provider at all.
 *
 * Both credentials or neither: a client id without a secret is a configuration
 * half-done, and Better Auth would reject it when somebody tried to sign in
 * rather than when it was set.
 *
 * Empty strings are not a neutral placeholder. Better Auth rejects them with
 * `CLIENT_ID_AND_SECRET_REQUIRED` and logs a SERVER_ERROR on every request that
 * touches the provider — which is what the end-to-end suite provoked on every
 * run before this, because a laptop and CI have no Google credentials and
 * should not. There the honest configuration has no Google provider at all.
 */
const socialProviders = ():
  | { google: { clientId: string; clientSecret: string } }
  | Record<string, never> => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return {};
  return { google: { clientId, clientSecret } };
};

type Auth = ReturnType<typeof buildAuth>;

let currentAuth: Auth | null = null;

const getAuth = (): Auth => {
  currentAuth ??= buildAuth(getDb(), isTestMode());
  return currentAuth;
};

/** Reset the built instance. Tests only — a deployment builds it once. */
export const resetAuth = (): void => {
  currentAuth = null;
};

/**
 * Better Auth owns every route under `/api/auth/`.
 *
 * `app` already carries the `/api` base path, so `/auth/*` here is
 * `/api/auth/*` on the wire — which is the path registered as Google's redirect
 * URI, and the one `createAuthClient` assumes on the same origin.
 *
 * The handler takes the raw `Request` and returns a `Response`; nothing
 * Vercel-specific is involved, so this runs identically under
 * `scripts/serve.mjs` and on the deployment.
 */
app.on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw));

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

  return c.json({
    ok: true,
    commit: process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
    region: process.env["VERCEL_REGION"] ?? null,
    db: db.status,
    dbQueryMs: db.status === "unconfigured" ? null : db.queryMs,
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
