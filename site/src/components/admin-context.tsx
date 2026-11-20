"use client";

import { Eye, EyeSlash, LockKey, WarningCircle, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { DomainCapability, ProviderEnvStatus } from "@/lib/dns-providers/types";
import { Button } from "./ui/button";

interface AdminContextValue {
  authenticated: boolean;
  configured: boolean;
  loading: boolean;
  envStatus: ProviderEnvStatus;
  capabilities: DomainCapability[];
  openLoginModal: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_ENV: ProviderEnvStatus = {
  adminAuthConfigured: false,
  namecomConfigured: false,
  cloudflareConfigured: false,
};

const AdminContext = createContext<AdminContextValue>({
  authenticated: false,
  configured: false,
  loading: true,
  envStatus: DEFAULT_ENV,
  capabilities: [],
  openLoginModal: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function useAdminSession(): AdminContextValue {
  return useContext(AdminContext);
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [envStatus, setEnvStatus] = useState<ProviderEnvStatus>(DEFAULT_ENV);
  const [capabilities, setCapabilities] = useState<DomainCapability[]>([]);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [sessionRes, domainsRes] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch("/api/domains", { cache: "no-store" }),
      ]);
      if (sessionRes.ok) {
        const s = (await sessionRes.json()) as {
          authenticated: boolean;
          configured: boolean;
        };
        setAuthenticated(Boolean(s.authenticated));
        setConfigured(Boolean(s.configured));
      }
      if (domainsRes.ok) {
        const d = (await domainsRes.json()) as {
          domains?: DomainCapability[];
          env?: ProviderEnvStatus;
        };
        if (d.domains) setCapabilities(d.domains);
        if (d.env) setEnvStatus(d.env);
      }
    } catch {
      // Offline / static fallback: keep defaults silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Progressive fallback for closedby="any" on browsers without native support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const openLoginModal = useCallback(() => {
    setLoginError(null);
    setPassword("");
    setShowPassword(false);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    requestAnimationFrame(() => passwordInputRef.current?.focus());
  }, []);

  const closeLoginModal = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuthenticated(false);
      await refresh();
    }
  }, [refresh]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError(t("enterPasswordError"));
      passwordInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json()) as { authenticated?: boolean; error?: string };
      if (!res.ok) {
        setLoginError(body.error ?? t("loginFailedError"));
        passwordInputRef.current?.focus();
        return;
      }
      setAuthenticated(Boolean(body.authenticated));
      setPassword("");
      closeLoginModal();
      await refresh();
    } catch {
      setLoginError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminContext.Provider
      value={{
        authenticated,
        configured,
        loading,
        envStatus,
        capabilities,
        openLoginModal,
        logout,
        refresh,
      }}
    >
      {children}

      {/* Native top-layer modal <dialog> */}
      <dialog
        ref={dialogRef}
        id="admin-login-dialog"
        aria-labelledby="admin-dialog-title"
        className="editorial-modal"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => {
          if (dialogRef.current) dialogRef.current.returnValue = "";
          setPassword("");
          setLoginError(null);
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-paper)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-terracotta-bg)] text-[var(--accent-terracotta)]">
              <LockKey size={16} weight="duotone" aria-hidden="true" />
            </span>
            <h2 id="admin-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
              {t("dialogTitle")}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label={t("closeAriaLabel")}
            onClick={closeLoginModal}
          >
            <X size={15} weight="bold" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 p-5">
          {!configured ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] p-3.5 text-xs leading-relaxed text-[var(--badge-warn-fg)]">
              <WarningCircle size={16} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">{t("envMissingTitle")}</p>
                <p>{t("envMissingDesc")}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t("signInDesc")}</p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="admin-password-input"
              className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]"
            >
              {t("passwordLabel")}
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] focus-within:border-[var(--focus-ring)]">
              <input
                ref={passwordInputRef}
                id="admin-password-input"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                aria-invalid={loginError ? "true" : "false"}
                aria-describedby={loginError ? "admin-login-error" : undefined}
                placeholder={t("passwordPlaceholder")}
                className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:text-sm"
                required
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                onClick={() => setShowPassword((prev) => !prev)}
                className="inline-flex min-w-[4.5rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 border-l border-[var(--border-color)] bg-[var(--bg-paper)] px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                {showPassword ? (
                  <EyeSlash size={14} weight="bold" aria-hidden="true" />
                ) : (
                  <Eye size={14} weight="bold" aria-hidden="true" />
                )}
                <span>{showPassword ? t("hideLabel") : t("showLabel")}</span>
              </button>
            </div>
          </div>

          {loginError ? (
            <p
              id="admin-login-error"
              role="alert"
              className="rounded-lg border border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] px-3 py-2 text-xs font-medium text-[var(--badge-dead-fg)]"
            >
              {loginError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeLoginModal}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("checkingAction") : t("unlockAction")}
            </Button>
          </div>
        </form>
      </dialog>
    </AdminContext.Provider>
  );
}
