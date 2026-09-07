/**
 * The hash routes, as pure functions.
 *
 * Hash routing and not the History API, for one reason: this is a project
 * GitHub Pages site with no server to rewrite paths, so `/lesson-planner/group/0`
 * would be a 404 on a refresh and a shared link would be dead. Everything after
 * the `#` never reaches the server.
 *
 * **The group is addressed by its array position, and that is a known
 * weakness.** A group's identity today *is* its index — the stored data has no
 * id field (see .claude/context/storage-data-contract.md). So a link to
 * `#/group/1` points at whatever is second in the array, and a CSV import,
 * which replaces everything, can put a different group there. Deleting a group
 * shifts every link after it. A stable id needs the schema change that Phase 4
 * designs; until then a link is reliable within a session and a guess between
 * them.
 */

export type Route =
  | { view: "main" }
  | { view: "group"; index: number }
  | { view: "newGroup" }
  | { view: "template" };

export const MAIN: Route = { view: "main" };

/**
 * Reads a route out of a location hash.
 *
 * Anything unrecognised is the main screen rather than an error: a hand-edited
 * URL, a stale bookmark and an empty hash should all show the planner instead
 * of a blank page.
 */
export const parseRoute = (hash: string): Route => {
  const path = hash.replace(/^#/, "");
  if (path === "/template") return { view: "template" };
  if (path === "/group/new") return { view: "newGroup" };

  const group = /^\/group\/(\d+)$/.exec(path);
  if (group !== null) {
    const index = Number(group[1]);
    // A negative index cannot be written by the regexp, but a huge one can;
    // whether the group exists is the caller's business, since only it knows
    // how many there are.
    return { view: "group", index };
  }

  return MAIN;
};

/** The hash a route should be written as. */
export const formatRoute = (route: Route): string => {
  switch (route.view) {
    case "group":
      return `#/group/${String(route.index)}`;
    case "newGroup":
      return "#/group/new";
    case "template":
      return "#/template";
    case "main":
      return "#/";
  }
};
