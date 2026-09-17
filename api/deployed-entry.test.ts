import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/** The one file Vercel deploys. Both suites below are about it. */
const ENTRY = "api/[...all].ts";

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

  const loadEntry = async (): Promise<unknown> => {
    compile();
    // `import()` of a path only known at run time is `any`. Land it in
    // `unknown` first so the assertions below have to earn every property they
    // read — which is the whole point of a test about an object's shape.
    const imported: unknown = await import(path.join(outDir, "[...all].js"));
    return (imported as { default: unknown }).default;
  };

  /**
   * Vercel supports two export shapes and tells them apart by what the default
   * export *is*. An object carrying a `fetch` method is a Web-standard handler;
   * a bare function is a Node.js `(request, response)` handler. Getting this
   * wrong does not throw — Vercel calls the function with Node's
   * `IncomingMessage` and `ServerResponse`, discards the `Response` that comes
   * back, and waits for a `response.end()` that never comes. Every request then
   * hangs until the function times out, which is what `export default
   * app.fetch` did in production.
   *
   * So this assertion is about the shape, not only the behaviour: calling
   * `entry.fetch()` from a test passes under either export, which is why the
   * first version of this file missed it.
   */
  it("exports the shape Vercel reads as a Web-standard handler", async () => {
    const entry = await loadEntry();

    expect(typeof entry).not.toBe("function");
    expect(typeof (entry as { fetch?: unknown }).fetch).toBe("function");
  }, 120_000);

  it("compiles, loads, and answers a real request", async () => {
    const entry = (await loadEntry()) as {
      fetch: (request: Request) => Promise<Response>;
    };

    const response = await entry.fetch(
      new Request("https://example.test/api/health"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  }, 120_000);
});

/**
 * Every import in the deployed entry must resolve to real JavaScript.
 *
 * This is the check that batch 5.1a did not have, and the deployment it cost.
 * That batch imported an npm **workspace** package whose `exports` pointed at
 * `index.ts`. Everything local passed — including the compile-and-run test
 * above, because `node_modules/@lesson-planner/db/index.ts` genuinely exists on
 * a laptop. Production returned 500 on every request:
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module
 *     '/var/task/node_modules/@lesson-planner/db/index.ts'
 *
 * Vercel traced the package and created the directory, then shipped no `.ts`
 * into it: it compiles what is under `api/` and does not build a workspace
 * package's TypeScript. The specifier resolved; the file behind it did not
 * exist.
 *
 * So the test above is necessary and not sufficient. It models Vercel's
 * *compiler*; this one models its *packaging*. A specifier that resolves to a
 * `.ts` file works under Node's type stripping and cannot work anywhere that
 * ships only what it compiled. Node builtins are fine — they resolve to
 * `node:` and are never shipped at all.
 */
describe("every import in the entry resolves to JavaScript", () => {
  it("names nothing that only exists as TypeScript", () => {
    const source = readFileSync(ENTRY, "utf8");
    const specifiers = [
      ...source.matchAll(/^import\s[^"']*["']([^"']+)["']/gm),
    ].map((match) => match[1] as string);

    // A guard that inspected nothing would pass silently, so prove it looked.
    expect(specifiers.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      const resolved = import.meta.resolve(specifier);
      if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) {
        offenders.push(`${specifier} -> ${resolved}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
