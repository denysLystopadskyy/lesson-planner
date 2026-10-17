import { defineConfig } from "vitest/config";

/**
 * Component tests for the scripts in this folder. A project of the root
 * `vitest.config.ts`, which is what `npm run test:unit` runs (plan batch T.3).
 *
 * Plain JavaScript like the scripts themselves: Node runs them as they are,
 * and `typecheck:api` checks them through JSDoc.
 */
export default defineConfig({
  test: {
    name: "scripts",
    include: ["**/*.test.mjs"],
    environment: "node",
  },
});
