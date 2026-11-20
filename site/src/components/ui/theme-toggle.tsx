"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "./button";

const STORAGE_KEY = "color-scheme";

function getSystemScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredScheme(): "light" | "dark" | null {
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

function applyMetaColorScheme(value: "light" | "dark" | "light dark") {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  meta.content = value;
}

export function ThemeToggle() {
  const t = useTranslations("common");

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue === "light" || e.newValue === "dark" ? e.newValue : "light dark";
      applyMetaColorScheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleToggle() {
    const system = getSystemScheme();
    const stored = getStoredScheme();
    const rendered = stored ?? system;
    const target: "light" | "dark" = rendered === "dark" ? "light" : "dark";

    if (target === system) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage blocked; still apply in-memory meta
      }
      applyMetaColorScheme("light dark");
    } else {
      try {
        window.localStorage.setItem(STORAGE_KEY, target);
      } catch {
        // Storage blocked; still apply in-memory meta
      }
      applyMetaColorScheme(target);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="iconSm"
      onClick={handleToggle}
      aria-label={t("themeToggleAria")}
    >
      <span className="theme-icon-light items-center justify-center">
        <Moon size={16} weight="duotone" aria-hidden="true" />
        <span className="sr-only">{t("themeSwitchToDark")}</span>
      </span>
      <span className="theme-icon-dark items-center justify-center">
        <Sun size={16} weight="duotone" aria-hidden="true" />
        <span className="sr-only">{t("themeSwitchToLight")}</span>
      </span>
    </Button>
  );
}
