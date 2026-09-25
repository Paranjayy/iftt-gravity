import { test, expect } from "bun:test";
import {
  autoClassifyClip,
  cleanMarkdownUrl,
  prettifyJson,
  wrapInPromptQuotes,
} from "../clip_transformers";

test("detects url + media clips", () => {
  const tags = autoClassifyClip("https://www.youtube.com/watch?v=abc123");
  expect(tags).toContain("url");
  expect(tags).toContain("media");
});

test("detects code clips", () => {
  const tags = autoClassifyClip("const x = await import('./thing');\nexport default function main() {}");
  expect(tags).toContain("code");
});

test("detects design hex colors", () => {
  const tags = autoClassifyClip("#FFB432");
  expect(tags).toContain("design");
});

test("short plain text is throwaway", () => {
  const tags = autoClassifyClip("ok thanks");
  expect(tags).toContain("throwaway");
});

test("strips tracking params but keeps real query", () => {
  const out = cleanMarkdownUrl("https://example.com/a?utm_source=x&id=42&fbclid=zzz");
  expect(out).toContain("id=42");
  expect(out).not.toContain("utm_source");
  expect(out).not.toContain("fbclid");
});

test("leaves non-url text untouched", () => {
  expect(cleanMarkdownUrl("not a url")).toBe("not a url");
});

test("prettifies valid json and rejects garbage", () => {
  expect(prettifyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  expect(prettifyJson("nope")).toBeNull();
});

test("wraps prompt quotes", () => {
  expect(wrapInPromptQuotes("hello")).toBe('"""\nhello\n"""');
});
