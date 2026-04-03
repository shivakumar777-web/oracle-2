/**
 * Better Auth — client for React components
 * Use authClient.signIn.email(), authClient.signUp.email(), authClient.useSession(), etc.
 */
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [jwtClient()],
});
