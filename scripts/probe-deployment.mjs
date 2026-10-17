#!/usr/bin/env node
/**
 * Reads one deployment with two requests, and names the wall when one answers
 * instead of the app — plan batch 5.4b.
 *
 * ## What it is for
 *
 * A deployment can turn a request away in two ways, and from the outside they
 * look alike. Both are recorded in .claude/context/deployment.md.
 *
 * - **Vercel Authentication**, on previews and deployment URLs: a 302 to
 *   `vercel.com/sso-api`. Protection Bypass for Automation gets past it, and
 *   this script sends that secret when it may (see "Where the secret goes").
 * - **The "Vercel Security Checkpoint"**: a 403 from the firewall's automatic
 *   mitigation, scoped to one IP. The secret does not get past it. The
 *   mitigation runs first, and the one exemption that would help — an IP
 *   bypass rule — is not on the Hobby plan. Lesson 29: a full suite run against
 *   production provoked it, and the 403s looked exactly like a broken
 *   deployment while the site was healthy.
 *
 * So the script sends as little as it can — two requests, one after the other
 * — and says which wall answered rather than failing on a parse error.
 *
 * ## Three choices that are easy to undo by accident
 *
 * **Redirects are not followed.** `fetch` follows a 302 by default. It would go
 * on to `vercel.com/sso-api`, come back with a login page, and the wall this
 * script exists to name would never be seen. The self-test checks the option.
 *
 * **Where the secret goes.** Only to this project's own preview and deployment
 * hosts: HTTPS, a name that starts `lesson-planner-` and ends
 * `-denys13.vercel.app`. deployment.md records that `lesson-planner.vercel.app`
 * is somebody else's project, answering the same health route. Sending the
 * secret there would put it in that owner's logs. This stops the accidental
 * case — a typo, that look-alike, any other host. It cannot stop a host built
 * on purpose to look like ours; nothing a script can check from the outside
 * can. Production needs no secret, because it is public.
 *
 * **Only the bypass header.** Not `x-vercel-set-bypass-cookie`: that header
 * asks for a cookie, and a script with no cookie store has nowhere to keep one.
 *
 * ## Reading the answer
 *
 * `x-vercel-cache: HIT` or `STALE` means the edge answered from its cache, so
 * the reading may be older than the latest deploy — lesson 34. The `commit` in
 * the health body is looked up in this repository. A commit we do not have
 * means `git fetch` is due, or the deployment is not ours, and either way the
 * run fails: a reading we cannot place is not a pass.
 *
 * ## Never in CI
 *
 * It sends requests to a live system, and its secret is not a GitHub Actions
 * secret (.claude/context/security-auth.md). Like check-no-personal-data.mjs it
 * runs its self-test on every invocation; `--self-test` runs only that.
 *
 * Usage: npm run probe:deployment -- <url>
 *
 * The npm script loads `.env.local` with Node's `--env-file-if-exists`, which
 * needs no dependency and does not fail when the file is absent. Run directly
 * with `node`, the script sees only the environment it was started with.
 */

import { execFileSync } from "node:child_process";

const SECRET_ENV = "VERCEL_AUTOMATION_BYPASS_SECRET";
const BYPASS_HEADER = "x-vercel-protection-bypass";
const OWN_HOST_PREFIX = "lesson-planner-";
const OWN_HOST_SUFFIX = "-denys13.vercel.app";
const HEALTH_PATH = "/api/health";
const PATHS = [HEALTH_PATH, "/"];
const TIMEOUT_MS = 20_000;

/**
 * @typedef {"sso" | "mitigation" | "wrong-shape" | "pass" | "unexpected"} Kind
 * @typedef {{ kind: Kind; cached: boolean }} Classification
 * @typedef {{ get(name: string): string | null }} HeaderReader
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {string} text
 * @returns {unknown}
 */
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * What one response means. A pure function of the response, so the self-test
 * can drive it with no network.
 *
 * @param {{ path: string; status: number; headers: HeaderReader; body: string }} response
 * @returns {Classification}
 */
const classify = ({ path, status, headers, body }) => {
  const cache = (headers.get("x-vercel-cache") ?? "").toUpperCase();
  const cached = cache === "HIT" || cache === "STALE";
  const location = headers.get("location") ?? "";
  const type = headers.get("content-type") ?? "";

  if (
    status >= 300 &&
    status < 400 &&
    location.includes("vercel.com/sso-api")
  ) {
    return { kind: "sso", cached };
  }
  const checkpoint =
    body.includes("Vercel Security Checkpoint") ||
    body.includes("ANOMALY_SCORE_EXCEEDED");
  if ((status === 403 || status === 429) && checkpoint) {
    return { kind: "mitigation", cached };
  }
  if (status !== 200) return { kind: "unexpected", cached };

  if (path === HEALTH_PATH) {
    const json = type.includes("application/json")
      ? parseJson(body)
      : undefined;
    const ok = isRecord(json) && json["ok"] === true;
    return { kind: ok ? "pass" : "wrong-shape", cached };
  }
  return { kind: type.includes("text/html") ? "pass" : "wrong-shape", cached };
};

/**
 * Whether the secret may be sent to this URL. See "Where the secret goes".
 *
 * @param {URL} url
 */
const mayCarrySecret = (url) =>
  url.protocol === "https:" &&
  url.hostname.startsWith(OWN_HOST_PREFIX) &&
  url.hostname.endsWith(OWN_HOST_SUFFIX);

/**
 * The options for one request, kept apart so the self-test can check the two
 * properties that matter: redirects stay visible, and the secret goes only
 * where it may.
 *
 * @param {URL} url
 * @param {string | undefined} secret
 * @returns {{ redirect: "manual"; headers: Record<string, string> }}
 */
const requestOptions = (url, secret) => ({
  redirect: "manual",
  headers:
    secret !== undefined && secret !== "" && mayCarrySecret(url)
      ? { [BYPASS_HEADER]: secret }
      : {},
});

/**
 * Proves the classifier and the host rule still do what they are for —
 * `--self-test`. Each case must be told apart from the others: a test that only
 * checked that `classify` returns *something* would pass against a classifier
 * that has stopped working.
 */
/** @type {{ why: string; path: string; status: number; headers: Record<string, string>; body: string; kind: Kind; cached: boolean }[]} */
const CLASSIFY_CASES = [
  {
    why: "Vercel Authentication on a preview",
    path: HEALTH_PATH,
    status: 302,
    headers: {
      location:
        "https://vercel.com/sso-api?url=https%3A%2F%2Flesson-planner-git-main-denys13.vercel.app%2Fapi%2Fhealth&nonce=abc123",
    },
    body: "Protected by Vercel Authentication",
    kind: "sso",
    cached: false,
  },
  {
    why: "the Security Checkpoint",
    path: HEALTH_PATH,
    status: 403,
    headers: { "content-type": "text/html" },
    body: "<title>Vercel Security Checkpoint</title>",
    kind: "mitigation",
    cached: false,
  },
  {
    why: "HTML where the health route serves JSON",
    path: HEALTH_PATH,
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: "<!doctype html>",
    kind: "wrong-shape",
    cached: false,
  },
  {
    why: "a fresh health answer",
    path: HEALTH_PATH,
    status: 200,
    headers: { "content-type": "application/json", "x-vercel-cache": "MISS" },
    body: '{"ok":true,"db":"ok"}',
    kind: "pass",
    cached: false,
  },
  {
    why: "a health answer from the edge cache",
    path: HEALTH_PATH,
    status: 200,
    headers: { "content-type": "application/json", "x-vercel-cache": "HIT" },
    body: '{"ok":true,"db":"ok"}',
    kind: "pass",
    cached: true,
  },
  {
    why: "the app's page",
    path: "/",
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: "<!doctype html>",
    kind: "pass",
    cached: false,
  },
  {
    why: "a redirect that is not the login wall",
    path: "/",
    status: 307,
    headers: { location: "/elsewhere" },
    body: "",
    kind: "unexpected",
    cached: false,
  },
  {
    why: "a server error",
    path: HEALTH_PATH,
    status: 500,
    headers: { "content-type": "text/plain" },
    body: "Internal Server Error",
    kind: "unexpected",
    cached: false,
  },
];

/** @type {[string, boolean, string][]} */
const HOST_CASES = [
  [
    "https://lesson-planner-git-main-denys13.vercel.app/",
    true,
    "a branch preview",
  ],
  ["https://lesson-planner-denys13.vercel.app/", true, "the team alias"],
  ["https://lesson-planner.vercel.app/", false, "somebody else's project"],
  [
    "https://lesson-planner-lac.vercel.app/",
    false,
    "production, which is public",
  ],
  ["https://other-app-denys13.vercel.app/", false, "another project's host"],
  [
    "https://lesson-planner-x-denys13.vercel.app.example.com/",
    false,
    "our name inside a foreign host",
  ],
  ["http://lesson-planner-git-main-denys13.vercel.app/", false, "plain HTTP"],
];

/**
 * @param {Record<string, string>} init
 * @returns {HeaderReader}
 */
const headersOf = (init) => {
  const lower = new Map(
    Object.entries(init).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return { get: (name) => lower.get(name.toLowerCase()) ?? null };
};

const runSelfTest = () => {
  /** @type {string[]} */
  const failures = [];
  const fakeSecret = "x".repeat(32);

  for (const fixture of CLASSIFY_CASES) {
    const got = classify({ ...fixture, headers: headersOf(fixture.headers) });
    if (got.kind !== fixture.kind || got.cached !== fixture.cached) {
      failures.push(
        `${fixture.why}: wanted ${fixture.kind}${fixture.cached ? " (cached)" : ""}, ` +
          `got ${got.kind}${got.cached ? " (cached)" : ""}`,
      );
    }
  }

  for (const [href, wanted, why] of HOST_CASES) {
    const sent =
      BYPASS_HEADER in requestOptions(new URL(href), fakeSecret).headers;
    if (sent !== wanted) {
      failures.push(
        `${why}: the secret should ${wanted ? "" : "not "}be sent to ${href}`,
      );
    }
  }

  const ownHost = new URL(
    "https://lesson-planner-git-main-denys13.vercel.app/",
  );
  if (requestOptions(ownHost, fakeSecret).redirect !== "manual") {
    failures.push(
      "redirects must not be followed, or the login wall is never seen",
    );
  }
  if (BYPASS_HEADER in requestOptions(ownHost, undefined).headers) {
    failures.push("with no secret set, no bypass header may be sent");
  }

  if (failures.length > 0) {
    console.error("Deployment probe SELF-TEST failed:\n");
    for (const failure of failures) console.error(`  ${failure}`);
    console.error("\nThe probe no longer tells its answers apart.");
    process.exit(1);
  }
  console.log(
    `Deployment probe self-test passed: ${String(CLASSIFY_CASES.length)} responses classified, ` +
      `${String(HOST_CASES.length)} hosts checked.`,
  );
};

if (process.argv.includes("--self-test")) {
  runSelfTest();
  process.exit(0);
}

runSelfTest();

/**
 * Runs git and returns its trimmed output, or `null` when git fails.
 *
 * @param {string[]} args
 * @returns {string | null}
 */
const git = (args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

/**
 * Where the deployed commit stands in this repository, and whether that is a
 * failure. The commit comes from the network, so it is checked for shape before
 * it reaches a git argument.
 *
 * @param {unknown} commit
 * @returns {{ text: string; failed: boolean }}
 */
const placeCommit = (commit) => {
  if (commit === null || commit === undefined) {
    return { text: "none reported — not running on Vercel", failed: false };
  }
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) {
    return { text: "not a commit hash", failed: true };
  }
  const short = commit.slice(0, 7);
  if (git(["rev-parse", "--git-dir"]) === null) {
    return {
      text: `${short}, not checked: git is not available`,
      failed: false,
    };
  }
  if (git(["cat-file", "-e", `${commit}^{commit}`]) === null) {
    return {
      text: `${short} is NOT in this repository — run \`git fetch\`, or this deployment is not ours`,
      failed: true,
    };
  }
  if (commit === git(["rev-parse", "origin/main"])) {
    return { text: `${short} (= origin/main)`, failed: false };
  }
  if (commit === git(["rev-parse", "HEAD"])) {
    return { text: `${short} (= HEAD)`, failed: false };
  }
  return {
    text: `${short} (ours, but neither HEAD nor origin/main)`,
    failed: false,
  };
};

/**
 * @param {Kind} kind
 * @param {{ secretSet: boolean; secretSent: boolean; status: number }} context
 * @returns {string}
 */
const explain = (kind, { secretSet, secretSent, status }) => {
  switch (kind) {
    case "sso":
      if (secretSent) {
        return "Vercel Authentication refused the secret. It may have been revoked, or it belongs to another project.";
      }
      if (secretSet) {
        return "Vercel Authentication. The secret is set but was not sent: this is not one of this project's preview hosts.";
      }
      return `Vercel Authentication. Put ${SECRET_ENV} in .env.local — see .env.example.`;
    case "mitigation":
      return (
        "Vercel Security Checkpoint: attack mitigation against this IP. The bypass secret " +
        "does not get past it, and nothing on the Hobby plan does. Wait, or check from " +
        "another network. The deployment is probably healthy (lesson 29)."
      );
    case "wrong-shape":
      return "Answered 200, but not with what this route serves. HTML where JSON was expected usually means a block page or the wrong host.";
    case "unexpected":
      return `Status ${String(status)}: not a pass, and not a wall this script knows.`;
    case "pass":
      return "";
  }
};

const arg = process.argv.slice(2).find((value) => !value.startsWith("--"));
if (arg === undefined) {
  console.error("Usage: npm run probe:deployment -- <url>");
  console.error(
    "The production URL is recorded in .claude/context/deployment.md; previews are listed on each pull request.",
  );
  process.exit(2);
}

/** @type {URL | null} */
let base = null;
try {
  base = new URL(arg);
} catch {
  base = null;
}
if (base === null) {
  console.error(`Not a URL: ${arg}`);
  process.exit(2);
}

const secret = process.env[SECRET_ENV];
const secretSet = secret !== undefined && secret !== "";
console.log(
  `Probing ${base.origin} — bypass secret ${secretSet ? "set" : "not set"}`,
);

let failed = false;
for (const path of PATHS) {
  const url = new URL(path, base.origin);
  const options = requestOptions(url, secret);
  const secretSent = BYPASS_HEADER in options.headers;

  /** @type {Response} */
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`GET ${path}  no response: ${reason}`);
    failed = true;
    continue;
  }

  const body = await response.text();
  const type = response.headers.get("content-type") ?? "-";
  const cache = response.headers.get("x-vercel-cache") ?? "-";
  const result = classify({
    path,
    status: response.status,
    headers: response.headers,
    body,
  });
  console.log(
    `GET ${path}  ${String(response.status)}  ${type}  cache ${cache}  ` +
      `${secretSent ? "secret sent  " : ""}→ ${result.kind}`,
  );

  if (result.kind !== "pass") {
    console.log(
      `    ${explain(result.kind, { secretSet, secretSent, status: response.status })}`,
    );
    failed = true;
    continue;
  }
  if (result.cached) {
    console.log(
      "    Warning: answered from the edge cache, so this may predate the latest deploy (lesson 34).",
    );
  }
  if (path === HEALTH_PATH) {
    const json = parseJson(body);
    const health = isRecord(json) ? json : {};
    const commit = placeCommit(health["commit"]);
    if (commit.failed) failed = true;
    console.log(
      `    commit ${commit.text} · region ${String(health["region"])} · ` +
        `db ${String(health["db"])} (${String(health["dbQueryMs"])} ms) · auth ${String(health["auth"])}`,
    );
  }
}

console.log(
  failed
    ? "\nThe deployment did not answer as expected."
    : "\nBoth requests passed.",
);
process.exit(failed ? 1 : 0);
