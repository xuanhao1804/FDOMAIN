import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, resolveLocale, SUPPORTED_LOCALES } from "../site/src/lib/i18n/config.js";
import { createTranslator, translate } from "../site/src/lib/i18n/messages.js";

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

function extractPlaceholders(template: string): string[] {
  const matches = [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]!);
  return [...new Set(matches)].sort();
}

describe("i18n locale catalogs", () => {
  const localesDir = join(process.cwd(), "site", "src", "locales");
  const jsonFiles = readdirSync(localesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  it("includes every SUPPORTED_LOCALE json catalog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(jsonFiles).toContain(`${locale}.json`);
    }
  });

  it("keeps 100% key and {placeholder} parity across all locales/*.json files", () => {
    const baseRaw = JSON.parse(
      readFileSync(join(localesDir, "en.json"), "utf8"),
    ) as Record<string, unknown>;
    const baseFlat = flattenCatalog(baseRaw);
    const baseKeys = [...baseFlat.keys()].sort();

    expect(baseKeys.length).toBeGreaterThan(50);

    for (const file of jsonFiles) {
      const raw = JSON.parse(
        readFileSync(join(localesDir, file), "utf8"),
      ) as Record<string, unknown>;
      const flat = flattenCatalog(raw);
      const keys = [...flat.keys()].sort();

      expect(keys, `${file} keys must match en.json`).toEqual(baseKeys);

      for (const [key, val] of flat.entries()) {
        expect(val.trim().length, `${file} -> ${key} must be non-empty`).toBeGreaterThan(0);
        const expectedVars = extractPlaceholders(baseFlat.get(key)!);
        const actualVars = extractPlaceholders(val);
        expect(actualVars, `${file} -> ${key} placeholders must match en.json`).toEqual(
          expectedVars,
        );
      }
    }
  });

  it("resolves locale cookies safely and defaults to Vietnamese", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
    expect(resolveLocale(undefined)).toBe("vi");
    expect(resolveLocale("")).toBe("vi");
    expect(resolveLocale("fr")).toBe("vi");
    expect(resolveLocale("vi-VN")).toBe("vi");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("EN-US")).toBe("en");
  });

  it("interpolates template variables cleanly in both vi and en", () => {
    expect(translate("vi", "overview.claimOnDomainCta", { domain: "harrylee.dev" })).toBe(
      "Tạo .harrylee.dev",
    );
    expect(translate("en", "overview.claimOnDomainCta", { domain: "harrylee.dev" })).toBe(
      "Claim .harrylee.dev",
    );

    const tVi = createTranslator("vi");
    expect(tVi("directory.summaryCount", { registry: 0, live: 3 })).toBe(
      "0 trong repo · 3 trực tiếp",
    );
  });
});
