/**
 * The schema, for drizzle-kit only.
 *
 * The tables themselves are defined in `api/[...all].ts`, and this file
 * re-exports them. That looks backwards and it is forced, by two constraints
 * that pull in opposite directions:
 *
 * - **The deployed entry cannot import project TypeScript.** Vercel traces a
 *   workspace package and then ships no `.ts` into it, so the import resolves
 *   and the file does not exist — one production outage, lesson 31. The entry
 *   may import published npm packages and nothing else.
 * - **drizzle-kit cannot read the entry directly.** Its `schema` path is a
 *   glob, and `api/[...all].ts` contains `[...]`, which glob reads as a
 *   character class: "No schema files found for path config".
 *
 * So the definitions live where the function can reach them with no import at
 * all, and drizzle-kit reads them through this file, whose name it can glob.
 * There is still exactly one definition of every table.
 *
 * Nothing deployed imports this file, and nothing should: it pulls in the whole
 * Hono application. `api/deployed-entry.test.ts` fails if the entry ever
 * imports project TypeScript again.
 */
export {
  account,
  rateLimit,
  session,
  user,
  verification,
} from "../api/[...all].ts";
