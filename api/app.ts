import { Hono } from "hono";

/**
 * The whole backend, as one Hono application.
 *
 * It runs unchanged in three places: as one Vercel function (`api/[...all].ts`),
 * on Node for local work and the end-to-end suite (`scripts/serve.mjs`), and —
 * if the hosting risk in deployment.md ever forces the move — on Cloudflare
 * Workers. That is only true while the handlers stay on the Web-standard
 * `Request` and `Response`, so nothing here imports a Vercel helper.
 *
 * Why one application and not one file per route: Vercel's Hobby plan caps a
 * deployment at 12 functions, and one is easy to count. The budget and the
 * reasoning are in .claude/context/backend.md.
 */
const app = new Hono().basePath("/api");

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
app.get("/health", (c) =>
  c.json({
    ok: true,
    commit: process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
    region: process.env["VERCEL_REGION"] ?? null,
  }),
);

export default app;
