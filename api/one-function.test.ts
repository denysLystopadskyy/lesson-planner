import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The deployment has exactly one function.
 *
 * `api/` is Vercel's routing table: every `.ts` file in it becomes a function
 * at its own public path. That is easy to forget, because every other directory
 * in this repository is just a source folder — and forgetting it put
 * `/api/health.test`, `/api/deployed-entry.test` and `/api/vitest.config` on
 * the internet, four functions against a recorded budget of one.
 *
 * So this is a test about the *directory*, not about any code in it. A new file
 * under `api/` has to be classified on purpose: either it is the entry, or
 * `.vercelignore` keeps it off the deployment. Adding one and doing neither
 * fails here rather than on a deployment nobody re-counts.
 */
describe("api/ deploys one function", () => {
  const ENTRY = "[...all].ts";

  /**
   * Only the two pattern shapes `.vercelignore` actually uses are understood —
   * an exact path, and `api/*.suffix`. A pattern of any other shape throws
   * instead of being quietly treated as "no match", because a matcher that
   * silently fails open would report success for a file it never examined.
   */
  const ignoredByVercel = (name: string): boolean =>
    readFileSync(".vercelignore", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"))
      .filter((pattern) => pattern.startsWith("api/"))
      .some((pattern) => {
        const rest = pattern.slice("api/".length);
        if (!rest.includes("*")) return rest === name;
        if (rest.startsWith("*") && !rest.slice(1).includes("*")) {
          return name.endsWith(rest.slice(1));
        }
        throw new Error(`.vercelignore pattern not understood: ${pattern}`);
      });

  it("has one deployable file, and it is the entry", () => {
    const deployable = readdirSync("api")
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => !ignoredByVercel(name));

    expect(deployable).toEqual([ENTRY]);
  });

  it("keeps every test file off the deployment", () => {
    const tests = readdirSync("api").filter((name) =>
      name.endsWith(".test.ts"),
    );

    expect(tests.length).toBeGreaterThan(0);
    for (const name of tests) expect(ignoredByVercel(name)).toBe(true);
  });
});
