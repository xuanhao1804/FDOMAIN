"use client";

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

  // Progressive fallback for closedby="any" on browsers without native support (Safari)
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
      setLoginError("Please enter the admin password.");
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
        setLoginError(body.error ?? "Login failed.");
        passwordInputRef.current?.focus();
        return;
      }
      setAuthenticated(Boolean(body.authenticated));
      setPassword("");
      closeLoginModal();
      await refresh();
    } catch {
      setLoginError("Network error while signing in.");
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

      {/* Native top-layer modal <dialog> (no role="dialog" or aria-modal needed) */}
      <dialog
        ref={dialogRef}
        id="admin-login-dialog"
        aria-labelledby="admin-dialog-title"
        className="chibi-modal"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => {
          if (dialogRef.current) dialogRef.current.returnValue = "";
          setPassword("");
          setLoginError(null);
        }}
      >
        <div
          className="flex items-center justify-between border-b-2 px-5 py-3.5"
          style={{ backgroundColor: "var(--header-bg)", borderColor: "#24324a" }}
        >
          <h2 id="admin-dialog-title" className="font-display text-lg font-extrabold" style={{ color: "#24324a" }}>
            Admin Unlock
          </h2>
          <button
            type="button"
            aria-label="Close admin sign in"
            onClick={closeLoginModal}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-bold"
            style={{
              backgroundColor: "var(--bg-cream)",
              borderColor: "#24324a",
              color: "#24324a",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 p-5">
          {!configured ? (
            <div
              className="rounded-2xl border-2 p-3.5 text-xs leading-relaxed"
              style={{
                backgroundColor: "var(--badge-warn-bg)",
                borderColor: "var(--badge-warn-fg)",
                color: "var(--badge-warn-fg)",
              }}
            >
              <p className="font-bold">ADMIN_PASSWORD not set on server</p>
              <p className="mt-1">
                Add <code className="font-mono-code font-bold">ADMIN_PASSWORD</code> and{" "}
                <code className="font-mono-code font-bold">NAMECOM_USERNAME</code> /{" "}
                <code className="font-mono-code font-bold">NAMECOM_TOKEN</code> in Vercel
                Environment Variables (or <code className="font-mono-code">.env.local</code>) to enable 1-click live DNS writes.
              </p>
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Sign in to apply live DNS changes on Name.com or Cloudflare without opening a manual PR.
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="admin-password-input" className="block text-xs font-bold uppercase tracking-wide">
              Admin password
            </label>
            <div
              className="flex items-center overflow-hidden rounded-xl border-2"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)" }}
            >
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
                placeholder="Enter ADMIN_PASSWORD"
                className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base sm:text-sm"
                required
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="shrink-0 cursor-pointer border-l-2 px-3 py-2.5 text-xs font-bold"
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {loginError ? (
            <p
              id="admin-login-error"
              role="alert"
              className="rounded-xl border px-3 py-2 text-xs font-bold"
              style={{
                backgroundColor: "var(--badge-dead-bg)",
                borderColor: "var(--badge-dead-fg)",
                color: "var(--badge-dead-fg)",
              }}
            >
              {loginError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={closeLoginModal}
              className="chibi-secondary-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="chibi-cta"
            >
              {submitting ? "Checking..." : "Unlock Admin"}
            </button>
          </div>
        </form>
      </dialog>
    </AdminContext.Provider>
  );
}
