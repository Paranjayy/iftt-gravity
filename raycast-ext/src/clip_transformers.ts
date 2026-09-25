// Automatic classifier / semantic bucketizer for clipboard items.
// Pure functions, zero external runtime deps.

export type SmartTag = "code" | "media" | "design" | "throwaway" | "thoughts" | "url";

export function autoClassifyClip(text: string): SmartTag[] {
  const tags = new Set<SmartTag>();
  const norm = text.trim();

  // URL / Media detection
  if (/https?:\/\//.test(norm)) {
    tags.add("url");
    if (/youtube\.com|youtu\.be|reddit\.com|x\.com|twitter\.com|instagram\.com/.test(norm)) {
      tags.add("media");
    }
  }

  // Code detection
  if (/```|function |const .*=|import .*from|def |class |interface |export |struct /.test(norm)) {
    tags.add("code");
  }

  // Design system detection (Hex colors, rgb, hsl, oklch)
  if (/^#([0-9a-fA-F]{3,8})$|^rgb\(|^hsl\(|^oklch\(/i.test(norm) || /#(?:[0-9a-fA-F]{3,8})\b/.test(norm)) {
    tags.add("design");
  }

  // Throwaway vs Thoughts
  if (norm.length < 40 && !tags.has("code") && !tags.has("url")) {
    tags.add("throwaway");
  } else if (norm.length > 500 || tags.has("code")) {
    tags.add("thoughts");
  }

  return Array.from(tags);
}

export function cleanMarkdownUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip common tracking parameters
    const paramsToDrop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "si", "fbclid", "gclid"];
    paramsToDrop.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

export function wrapInPromptQuotes(text: string): string {
  return `"""\n${text}\n"""`;
}

export function prettifyJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}
