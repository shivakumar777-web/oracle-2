"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";

export type OracleTier = "full" | "limited";

export type ProductAccessValue = {
  loading: boolean;
  labsAccess: boolean;
  /** Non-Pro: free lifetime trial scans left; null when Pro/Premium (subscription limits apply). */
  labsTrialRemaining: number | null;
  oracleTier: OracleTier;
  oracleDailyCap: number;
  oracleUsedToday: number;
  signedIn: boolean;
  plan: string;
  status: string;
  refetch: () => Promise<void>;
};

const defaultValue: ProductAccessValue = {
  loading: true,
  labsAccess: false,
  labsTrialRemaining: null,
  oracleTier: "limited",
  oracleDailyCap: 35,
  oracleUsedToday: 0,
  signedIn: false,
  plan: "free",
  status: "inactive",
  refetch: async () => {},
};

const ProductAccessContext = createContext<ProductAccessValue>(defaultValue);

export function useProductAccess() {
  return useContext(ProductAccessContext);
}

export function ProductAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = authClient.useSession();
  const [state, setState] = useState<Omit<ProductAccessValue, "refetch">>({
    loading: true,
    labsAccess: false,
    labsTrialRemaining: null,
    oracleTier: "limited",
    oracleDailyCap: 35,
    oracleUsedToday: 0,
    signedIn: false,
    plan: "free",
    status: "inactive",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/product-access", { cache: "no-store" });
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const j = await res.json();
      setState({
        loading: false,
        labsAccess: Boolean(j.labsAccess),
        labsTrialRemaining:
          typeof j.labsTrialRemaining === "number" ? j.labsTrialRemaining : null,
        oracleTier: j.oracleTier === "full" ? "full" : "limited",
        oracleDailyCap: typeof j.oracleDailyCap === "number" ? j.oracleDailyCap : 35,
        oracleUsedToday: typeof j.oracleUsedToday === "number" ? j.oracleUsedToday : 0,
        signedIn: Boolean(j.signedIn),
        plan: typeof j.plan === "string" ? j.plan : "free",
        status: typeof j.status === "string" ? j.status : "inactive",
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, session?.user?.id]);

  useEffect(() => {
    const onInvalidate = () => {
      void load();
    };
    window.addEventListener("manthana:product-access-invalidate", onInvalidate);
    return () =>
      window.removeEventListener(
        "manthana:product-access-invalidate",
        onInvalidate
      );
  }, [load]);

  const value: ProductAccessValue = {
    ...state,
    refetch: load,
  };

  return (
    <ProductAccessContext.Provider value={value}>
      {children}
    </ProductAccessContext.Provider>
  );
}
