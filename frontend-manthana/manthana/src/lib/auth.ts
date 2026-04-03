/**
 * Better Auth — server config
 * Handles sign-in, sign-up, sessions, and JWT for Python backend validation.
 */
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "auth.db");

export const auth = betterAuth({
  database: new Database(dbPath),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    jwt({
      // JWKS at /api/auth/jwks for Python backend validation
      jwks: {
        rotationInterval: 60 * 60 * 24 * 30, // 30 days
        gracePeriod: 60 * 60 * 24 * 30,
      },
    }),
  ],
});
