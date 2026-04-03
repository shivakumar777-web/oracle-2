/**
 * Better Auth — catch-all handler for /api/auth/*
 * Sign-in, sign-up, session, JWT, JWKS, etc.
 */
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
