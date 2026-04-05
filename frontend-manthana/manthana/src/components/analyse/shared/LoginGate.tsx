"use client";

import { useState } from "react";
import { GATEWAY_URL } from "@/lib/analyse/constants";
import { setGatewayAuthToken } from "@/lib/analyse/auth-token";

interface Props {
  onAuthenticated: () => void;
}

/** Local UI bypass only (`next dev`). Real gateway calls still need a valid JWT from `/auth/token`. */
const DEV_LOGIN_USERNAME = "radiologist1";
const DEV_LOGIN_PASSWORD = "707";
const DEV_GATEWAY_TOKEN_PLACEHOLDER = "dev-manthana-ui-bypass";

export function LoginGate({ onAuthenticated }: Props) {
  const [username, setUsername] = useState("radiologist1");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (
        process.env.NODE_ENV === "development" &&
        username === DEV_LOGIN_USERNAME &&
        password === DEV_LOGIN_PASSWORD
      ) {
        setGatewayAuthToken(DEV_GATEWAY_TOKEN_PLACEHOLDER);
        onAuthenticated();
        return;
      }

      const res = await fetch(`${GATEWAY_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        throw new Error("Invalid credentials");
      }
      const data = await res.json();
      setGatewayAuthToken(data.access_token as string);
      onAuthenticated();
    } catch (e) {
      setGatewayAuthToken(null);
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "radial-gradient(circle at top, rgba(0,0,0,0.8), rgba(0,0,0,0.95))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-panel"
        style={{
          width: "90%",
          maxWidth: 420,
          padding: "22px 24px 18px",
          borderRadius: "var(--r-lg)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        <p
          className="font-display"
          style={{
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--scan-400)",
            marginBottom: 10,
          }}
        >
          Manthana Radiologist Login
        </p>
        <p className="font-body" style={{ fontSize: 11, color: "var(--text-55)", marginBottom: 12 }}>
          Sign in with your pilot credentials to access the AI analysis gateway.
        </p>

        <div style={{ marginBottom: 10 }}>
          <label className="text-caption" style={{ fontSize: 10, color: "var(--text-40)", display: "block", marginBottom: 4 }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--glass-border)",
              background: "rgba(10,10,10,0.85)",
              color: "var(--text-80)",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label className="text-caption" style={{ fontSize: 10, color: "var(--text-40)", display: "block", marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--glass-border)",
              background: "rgba(10,10,10,0.85)",
              color: "var(--text-80)",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {error && (
          <p
            className="text-caption"
            style={{ fontSize: 10, color: "var(--danger-300)", marginBottom: 8 }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button
            type="submit"
            disabled={submitting}
            className="btn-teal"
            style={{
              fontSize: 11,
              padding: "7px 18px",
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

