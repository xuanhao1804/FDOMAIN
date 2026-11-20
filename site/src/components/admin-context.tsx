"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DomainCapability, ProviderEnvStatus } from "@/lib/dns-providers/types";

const importAdminDialog = () =>
  import("./admin-login-dialog").then((mod) => mod.AdminLoginDialog);

const LazyAdminLoginDialog = dynamic(importAdminDialog, {
  ssr: false,
});

export interface InitialAdminState {
  authenticated: boolean;
  configured: boolean;
  envStatus: ProviderEnvStatus;
  capabilities: DomainCapability[];
}

interface AdminContextValue {
  authenticated: boolean;
  configured: boolean;
  loading: boolean;
  envStatus: ProviderEnvStatus;
  capabilities: DomainCapability[];
  openLoginModal: () => void;
  preloadLoginModal: () => void;
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
  loading: false,
  envStatus: DEFAULT_ENV,
  capabilities: [],
  openLoginModal: () => {},
  preloadLoginModal: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function useAdminSession(): AdminContextValue {
  return useContext(AdminContext);
}

export function AdminSessionProvider({
  initialState,
  children,
}: {
  initialState: InitialAdminState;
  children: ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(initialState.authenticated);
  const [configured, setConfigured] = useState(initialState.configured);
  const [loading, setLoading] = useState(false);
  const [envStatus, setEnvStatus] = useState<ProviderEnvStatus>(initialState.envStatus);
  const [capabilities, setCapabilities] = useState<DomainCapability[]>(initialState.capabilities);

  // Lazy mount dialog chunk only once user opens (or preloads on hover/focus)
  const [dialogMounted, setDialogMounted] = useState(false);
  const [openSignal, setOpenSignal] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
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
      // Keep SSR state cleanly on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  const preloadLoginModal = useCallback(() => {
    void importAdminDialog();
  }, []);

  const openLoginModal = useCallback(() => {
    setDialogMounted(true);
    setOpenSignal((prev) => prev + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuthenticated(false);
      await refresh();
    }
  }, [refresh]);

  const handleAuthenticated = useCallback(async () => {
    setAuthenticated(true);
    await refresh();
  }, [refresh]);

  const contextValue = useMemo(
    () => ({
      authenticated,
      configured,
      loading,
      envStatus,
      capabilities,
      openLoginModal,
      preloadLoginModal,
      logout,
      refresh,
    }),
    [
      authenticated,
      configured,
      loading,
      envStatus,
      capabilities,
      openLoginModal,
      preloadLoginModal,
      logout,
      refresh,
    ],
  );

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
      {dialogMounted ? (
        <LazyAdminLoginDialog
          openSignal={openSignal}
          configured={configured}
          onAuthenticated={handleAuthenticated}
        />
      ) : null}
    </AdminContext.Provider>
  );
}
