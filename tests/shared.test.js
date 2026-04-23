import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRules,
  normalizeDomain,
  normalizePattern,
  parseDomainLines,
} from "../shared.js";

test("normalizeDomain handles bare domains and URLs", () => {
  assert.equal(normalizeDomain("Example.COM"), "example.com");
  assert.equal(normalizeDomain("https://Foo.com/path?q=1#x"), "foo.com");
  assert.equal(normalizeDomain("http://bar.com:8080"), "bar.com");
});

test("normalizeDomain rejects invalid inputs", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("bad host"), null);
  assert.equal(normalizeDomain("ftp://example.com"), null);
  assert.equal(normalizeDomain("-foo.com"), null);
});

test("normalizePattern supports wildcard and rejects bad wildcard targets", () => {
  assert.equal(normalizePattern("*.Example.com"), "*.example.com");
  assert.equal(normalizePattern("*.localhost"), null);
  assert.equal(normalizePattern("*.127.0.0.1"), null);
  assert.equal(normalizePattern("example.com"), "example.com");
});

test("parseDomainLines de-duplicates and captures invalid rows", () => {
  const { valid, invalid } = parseDomainLines(`
example.com
https://foo.com/path
*.example.com
example.com
bad host
# comment
`);

  assert.deepEqual(valid, ["example.com", "foo.com", "*.example.com"]);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].trim(), "bad host");
});

test("buildRules keeps ignore precedence over wildcard redirect", () => {
  const rules = buildRules(["*.example.com"], ["www.example.com"]);

  assert.equal(rules.length, 2);

  const ignoreRule = rules[0];
  assert.equal(ignoreRule.action.type, "allow");
  assert.equal(ignoreRule.priority, 2);
  assert.deepEqual(ignoreRule.condition.resourceTypes, ["main_frame"]);

  const redirectRule = rules[1];
  assert.equal(redirectRule.action.type, "redirect");
  assert.equal(redirectRule.action.redirect.transform.scheme, "http");
  assert.equal(redirectRule.priority, 1);
  assert.deepEqual(redirectRule.condition.resourceTypes, ["main_frame"]);

  const wildcardRegex = new RegExp(redirectRule.condition.regexFilter);
  assert.equal(wildcardRegex.test("https://api.example.com/path"), true);
  assert.equal(wildcardRegex.test("https://www.example.com/"), true);
  assert.equal(wildcardRegex.test("https://example.com/"), false);
});
