import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * The entry file, compiled the way Vercel compiles it, and then actually run.
 *
 * This test exists because of a production failure the whole rest of the suite
 * was blind to. `api/health.test.ts` imports the application object and
 * `e2e/features/api-health.spec.ts` goes through `scripts/serve.mjs`; both run
 * the TypeScript directly, because Node 24 strips types. Vercel does not — it
 * compiles each file under `api/` to JavaScript. The first deployment therefore
 * ran code no test had ever executed, and died on module load:
 *
 *     Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/app.ts'
 *       imported from /var/task/api/[...all].js
 *
 * The source said `import app from "./app.ts"`. That resolves under type
 * stripping and cannot resolve after compilation, and nothing local could tell
 * the difference. So: compile, then load the compiled output, then call it.
 *
 * Kept deliberately end-to-end rather than asserting on the emitted text. A
 * check for `.ts` import specifiers would have caught this one bug; running the
 * output catches the class — an unresolvable import, a dependency that is not
 * really there, a top-level crash.
 */
describe("The Vercel entry file survives compilation", () => {
  const outDir = mkdtempSync(
    path.join(process.cwd(), "node_modules", ".api-entry-test-"),
  );

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  const compile = () => {
    // No `allowImportingTsExtensions` on purpose. That option is what lets the
    // source spell an import `./x.ts`, and it is only legal while nothing is
    // emitted. Compiling for real is the point here, so a `.ts` specifier fails
    // this step — earlier and louder than Vercel, which emits it happily and
    // only fails at runtime.
    execFileSync(
      "npx",
      [
        "tsc",
        "api/[...all].ts",
        "--ignoreConfig",
        "--outDir",
        outDir,
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--target",
        "es2022",
        "--types",
        "node",
        "--skipLibCheck",
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" },
    );
    // The emitted code is ESM only if something says so, exactly as on the
    // deployment, where Vercel copies this file alongside the compiled output.
    cpSync("api/package.json", path.join(outDir, "package.json"));
  };

  it("compiles, loads, and answers a real request", async () => {
    compile();

    const entry: unknown = await import(path.join(outDir, "[...all].js")).then(
      (m: { default: unknown }) => m.default,
    );

    expect(typeof entry).toBe("function");

    const handler = entry as (request: Request) => Promise<Response>;
    const response = await handler(
      new Request("https://example.test/api/health"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  }, 120_000);
});
