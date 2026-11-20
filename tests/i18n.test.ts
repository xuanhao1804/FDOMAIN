import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "../site/src/i18n/config.js";

function flattenCatalog(
  obj: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedVal] of flattenCatalog(
        value as Record<string, unknown>,
        full,
      )) {
        out.set(nestedKey, nestedVal);
      }
    } else if (typeof value === "string") {
      out.set(full, value);
    } else {
      throw new Error(`Invalid non-string leaf at locale key "${full}"`);
    }
  }
  return out;
}

/** Extract top-level ICU variable names like `{domain}` or `{count, plural, ...}`. */
function extractIcuVars(template: string): string[] {
  const vars = new Set<string>();
  let depth = 0;
  let tokenStart = -1;

  for (let i = 0; i < template.length; i += 1) {
    const ch = template[i];
    if (ch === "{") {
      if (depth === 0) tokenStart = i + 1;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && tokenStart !== -1) {
        const inner = template.slice(tokenStart, i).trim();
        const varName = inner.split(",")[0]?.trim();
        if (varName && /^[a-zA-Z0-9_]+$/.test(varName)) {
          vars.add(varName);
        }
        tokenStart = -1;
      }
    }
  }

  return [...vars].sort();
}

describe("next-intl message catalogs", () => {
  const messagesDir = join(process.cwd(), "site", "messages");
  const jsonFiles = readdirSync(messagesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  it("includes every SUPPORTED_LOCALE json catalog under site/messages", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(jsonFiles).toContain(`${locale}.json`);
    }
  });

  it("keeps 100% key and ICU placeholder parity across all site/messages/*.json files", () => {
    const baseRaw = JSON.parse(
      readFileSync(join(messagesDir, "en.json"), "utf8"),
    ) as Record<string, unknown>;
    const baseFlat = flattenCatalog(baseRaw);
    const baseKeys = [...baseFlat.keys()].sort();

    expect(baseKeys.length).toBeGreaterThan(50);

    for (const file of jsonFiles) {
      const raw = JSON.parse(
        readFileSync(join(messagesDir, file), "utf8"),
      ) as Record<string, unknown>;
      const flat = flattenCatalog(raw);
      const keys = [...flat.keys()].sort();

      expect(keys, `${file} keys must match en.json`).toEqual(baseKeys);

      for (const [key, val] of flat.entries()) {
        expect(val.trim().length, `${file} -> ${key} must be non-empty`).toBeGreaterThan(0);
        const expectedVars = extractIcuVars(baseFlat.get(key)!);
        const actualVars = extractIcuVars(val);
        expect(actualVars, `${file} -> ${key} ICU variables must match en.json`).toEqual(
          expectedVars,
        );
      }
    }
  });

  it("resolves NEXT_LOCALE cookies safely and defaults to Vietnamese", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
    expect(LOCALE_COOKIE_NAME).toBe("NEXT_LOCALE");
    expect(resolveLocale(undefined)).toBe("vi");
    expect(resolveLocale("")).toBe("vi");
    expect(resolveLocale("fr")).toBe("vi");
    expect(resolveLocale("vi-VN")).toBe("vi");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("EN-US")).toBe("en");
  });
});
