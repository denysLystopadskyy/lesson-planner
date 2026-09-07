import { describe, expect, it } from "vitest";
import { MAIN, formatRoute, parseRoute, type Route } from "./route";

/**
 * Reading and writing the hash.
 *
 * ISTQB technique: equivalence partitioning on the hash. A hash is one of the
 * known routes, a known route with a bad parameter, or something nobody wrote
 * on purpose — a stale bookmark, a hand-edited URL, a link that lost its tail.
 * The last partition is the one that matters, because it must show the planner
 * rather than a blank page.
 */

describe("parseRoute — equivalence partitioning", () => {
  it("An empty hash is the main screen", () => {
    expect(parseRoute("")).toEqual(MAIN);
    expect(parseRoute("#")).toEqual(MAIN);
    expect(parseRoute("#/")).toEqual(MAIN);
  });

  it("A group route carries its index", () => {
    expect(parseRoute("#/group/0")).toEqual({ view: "group", index: 0 });
    expect(parseRoute("#/group/12")).toEqual({ view: "group", index: 12 });
  });

  it("The add flow is its own route, not index -1", () => {
    // It was `{ index: -1 }` in the component's state before routing. A URL
    // saying "minus one" would be a puzzle in a shared link.
    expect(parseRoute("#/group/new")).toEqual({ view: "newGroup" });
  });

  it("The template editor has a route", () => {
    expect(parseRoute("#/template")).toEqual({ view: "template" });
  });

  it("An index that is not a whole number is not a group route", () => {
    // Each of these falls back to the main screen rather than opening a dialog
    // for a group that cannot exist.
    for (const hash of [
      "#/group/-1",
      "#/group/1.5",
      "#/group/",
      "#/group/one",
      "#/group/0/extra",
      "#/group",
    ]) {
      expect(parseRoute(hash), hash).toEqual(MAIN);
    }
  });

  it("An unknown route is the main screen, not an error", () => {
    for (const hash of [
      "#/nope",
      "#/Template",
      "#/GROUP/0",
      "#!/group/0",
      "#anything",
    ]) {
      expect(parseRoute(hash), hash).toEqual(MAIN);
    }
  });

  it("A large index parses, because only the app knows how many groups exist", () => {
    // `parseRoute` deliberately does not check whether the group is there:
    // it has no way to know. The component renders the empty dialog state.
    expect(parseRoute("#/group/9999")).toEqual({ view: "group", index: 9999 });
  });
});

describe("formatRoute — equivalence partitioning", () => {
  it("Writes each route as the hash that parses back to it", () => {
    const routes: Route[] = [
      MAIN,
      { view: "newGroup" },
      { view: "template" },
      { view: "group", index: 0 },
      { view: "group", index: 7 },
    ];
    for (const route of routes) {
      // The round trip is the property worth asserting: a route written into
      // the URL bar has to come back as itself when the page is reloaded.
      expect(parseRoute(formatRoute(route)), formatRoute(route)).toEqual(route);
    }
  });

  it("Writes the main screen as a slash, not an empty hash", () => {
    // `location.hash = ""` leaves the previous hash in place in some browsers,
    // so the main route needs a path of its own.
    expect(formatRoute(MAIN)).toBe("#/");
  });
});
