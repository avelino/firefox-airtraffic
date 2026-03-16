import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isIgnoredUrl, resolveRoute } from "../src/route-resolver";
import type { Rule, Settings } from "../src/types";

describe("isIgnoredUrl", () => {
  it("ignores about: URLs", () => {
    assert.equal(isIgnoredUrl("about:blank"), true);
    assert.equal(isIgnoredUrl("about:config"), true);
  });

  it("ignores moz-extension: URLs", () => {
    assert.equal(isIgnoredUrl("moz-extension://abc/popup.html"), true);
  });

  it("ignores chrome: and resource: URLs", () => {
    assert.equal(isIgnoredUrl("chrome://settings"), true);
    assert.equal(isIgnoredUrl("resource://foo"), true);
  });

  it("ignores data: and blob: URLs", () => {
    assert.equal(isIgnoredUrl("data:text/html,hello"), true);
    assert.equal(isIgnoredUrl("blob:http://example.com/abc"), true);
  });

  it("ignores empty string", () => {
    assert.equal(isIgnoredUrl(""), true);
  });

  it("allows http/https URLs", () => {
    assert.equal(isIgnoredUrl("https://github.com"), false);
    assert.equal(isIgnoredUrl("http://example.com"), false);
  });
});

describe("resolveRoute", () => {
  const rules: Rule[] = [
    { id: "1", pattern: "github.com", matchType: "domain", cookieStoreId: "container-dev" },
    { id: "2", pattern: "slack.com", matchType: "domain", cookieStoreId: "container-work" },
  ];

  describe("route_matched mode", () => {
    const settings: Settings = { mode: "route_matched", defaultContainer: "", useSync: false };

    it("returns redirect when URL matches a rule and tab is in wrong container", () => {
      const result = resolveRoute("https://github.com/repo", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "redirect", cookieStoreId: "container-dev" });
    });

    it("returns none when URL matches but tab is already in correct container", () => {
      const result = resolveRoute("https://github.com/repo", rules, settings, "container-dev");
      assert.deepEqual(result, { action: "none" });
    });

    it("returns none when no rule matches", () => {
      const result = resolveRoute("https://example.com", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });

    it("returns none for ignored URLs", () => {
      const result = resolveRoute("about:blank", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });
  });

  describe("route_all mode", () => {
    const settings: Settings = { mode: "route_all", defaultContainer: "container-personal", useSync: false };

    it("redirects unmatched URLs to default container", () => {
      const result = resolveRoute("https://example.com", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "redirect", cookieStoreId: "container-personal" });
    });

    it("returns none when URL matches a rule (excluded from default)", () => {
      const result = resolveRoute("https://github.com/repo", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });

    it("returns none when tab is already in default container", () => {
      const result = resolveRoute("https://random.com", rules, settings, "container-personal");
      assert.deepEqual(result, { action: "none" });
    });

    it("returns none when no default container is set", () => {
      const noDefault: Settings = { mode: "route_all", defaultContainer: "", useSync: false };
      const result = resolveRoute("https://example.com", rules, noDefault, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });

    it("returns none for ignored URLs", () => {
      const result = resolveRoute("moz-extension://abc", rules, settings, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });
  });

  describe("negated rules integration", () => {
    const negatedRules: Rule[] = [
      { id: "1", pattern: "work.company.com", matchType: "domain", cookieStoreId: "container-personal", negate: true },
    ];
    const settings: Settings = { mode: "route_matched", defaultContainer: "", useSync: false };

    it("redirects non-matching URLs (negate inverts the match)", () => {
      const result = resolveRoute("https://github.com", negatedRules, settings, "firefox-default");
      assert.deepEqual(result, { action: "redirect", cookieStoreId: "container-personal" });
    });

    it("does not redirect the excluded domain", () => {
      const result = resolveRoute("https://work.company.com/dashboard", negatedRules, settings, "firefox-default");
      assert.deepEqual(result, { action: "none" });
    });

    it("does not redirect when already in correct container", () => {
      const result = resolveRoute("https://random.com", negatedRules, settings, "container-personal");
      assert.deepEqual(result, { action: "none" });
    });
  });

  describe("rule priority (first match wins)", () => {
    it("positive rule before negated catch-all", () => {
      const mixed: Rule[] = [
        { id: "pos", pattern: "github.com", matchType: "domain", cookieStoreId: "container-dev" },
        { id: "neg", pattern: "work.com", matchType: "domain", cookieStoreId: "container-personal", negate: true },
      ];
      const settings: Settings = { mode: "route_matched", defaultContainer: "", useSync: false };

      // github.com matches positive rule -> redirect to dev
      const r1 = resolveRoute("https://github.com", mixed, settings, "firefox-default");
      assert.deepEqual(r1, { action: "redirect", cookieStoreId: "container-dev" });

      // work.com doesn't match positive, doesn't match negated (negate inverts) -> none
      const r2 = resolveRoute("https://work.com", mixed, settings, "firefox-default");
      assert.deepEqual(r2, { action: "none" });

      // random.com doesn't match positive, matches negated (negate inverts) -> redirect to personal
      const r3 = resolveRoute("https://random.com", mixed, settings, "firefox-default");
      assert.deepEqual(r3, { action: "redirect", cookieStoreId: "container-personal" });
    });
  });
});
