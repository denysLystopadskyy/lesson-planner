import { configureTest } from "../ui/fixtures/test";
import { expect } from "@playwright/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";

/**
 * The response headers, and whether the Content-Security-Policy is survivable.
 *
 * `vercel.json` is where these are set — the decision is in security-auth.md —
 * and Vercel applies it on the deployment. `scripts/serve.mjs` reads the same
 * file and applies the same list, so this spec means something locally. Without
 * that it could only run against a deployment, and a CSP would first be tested
 * by the teacher.
 *
 * What this spec **cannot** prove is that Vercel applies them; that is batch
 * 5.4's checklist row 18, read off the live response by a person. What it does
 * prove is that the policy the repository declares is one the app can live
 * under — which is the part that used to be a guess.
 */

const EXPECTED = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const headers = configureTest();

headers.describe("Response headers — equivalence partitioning", () => {
  // Two partitions: a static file and the API. They are served by different
  // things on the deployment, so a header set on one says nothing about the
  // other — which is exactly what checklist row 18 asks about.
  for (const path of ["/", "/api/health"]) {
    headers(`${path} carries the security headers`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      for (const [name, value] of Object.entries(EXPECTED)) {
        expect(response.headers()[name], `${name} on ${path}`).toBe(value);
      }
      expect(response.headers()["content-security-policy"]).toContain(
        "default-src 'self'",
      );
    });
  }
});

const csp = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Policy Group", dates: ["2026-06-03"] })],
  }),
});

csp.describe(
  "The Content-Security-Policy is one the app can live under",
  () => {
    /**
     * A policy nobody has exercised is a guess. This walks the surfaces that
     * would break first — every dialog, and the one component that sets a style
     * from JavaScript (`GroupModal`'s date section) — and fails on any violation
     * the browser reports.
     *
     * The collector is proved before it is trusted: an inline script is injected
     * on purpose, and the spec fails if **that** is not blocked. Otherwise a
     * listener attached to the wrong event, or a policy that was never applied,
     * would look exactly like a clean run. That mistake was made by hand while
     * writing this: an `eval` in a devtools context is not governed by the page's
     * policy, and "nothing was blocked" meant nothing.
     */
    csp(
      "No violations while the app is used, and the collector works",
      async ({ page }) => {
        const violations: string[] = [];
        page.on("console", (message) => {
          const text = message.text();
          if (text.includes("Content Security Policy")) violations.push(text);
        });

        // Open every dialog. `GroupModal` is the one that sets a style from
        // JavaScript, which is what `style-src 'self'` would block if React wrote a
        // style attribute rather than going through the CSSOM.
        await page.getByRole("button", { name: "Policy Group" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: "Edit Template" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");

        expect(violations, "the app itself must violate nothing").toEqual([]);

        // Now prove the collector and the policy are both real. Without this the
        // assertion above passes just as happily against a page with no policy.
        await page.evaluate(() => {
          const script = document.createElement("script");
          script.textContent = "window.__cspProbe = true;";
          document.head.appendChild(script);
        });
        await expect
          .poll(() => violations.length, {
            message: "an injected inline script must be blocked and reported",
          })
          .toBeGreaterThan(0);

        // And it really did not run.
        expect(
          await page.evaluate(
            () => (window as unknown as { __cspProbe?: boolean }).__cspProbe,
          ),
        ).toBeUndefined();
      },
    );
  },
);
