/**
 * Supabase Auth — Send Email hook (HTTPS).
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email:
 *   URL: https://<your-domain>/api/supabase/auth-send-email
 *   Secret: copy into SUPABASE_SEND_EMAIL_HOOK_SECRET (format v1,whsec_...)
 *
 * When this hook is enabled, Supabase does not send auth mail itself; this route
 * sends via AWS SES using @/lib/email/ses (same credentials as receipts).
 */
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendEmail } from "@/lib/email/ses";
import { getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailActionType = string;

interface HookUser {
  id: string;
  email: string;
  new_email?: string;
  user_metadata?: Record<string, unknown>;
}

interface HookEmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: EmailActionType;
  site_url: string;
  token_new: string;
  token_hash_new: string;
  old_email?: string;
}

interface HookPayload {
  user: HookUser;
  email_data: HookEmailData;
}

function headersFromRequest(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    h[k] = v;
  });
  return h;
}

function webhookFromEnv(): Webhook {
  const raw = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim();
  if (!raw) {
    throw new Error("SUPABASE_SEND_EMAIL_HOOK_SECRET is not set");
  }
  const secret = raw.replace(/^v1,/, "");
  return new Webhook(secret);
}

function buildVerifyLink(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string
): string {
  const base = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`;
  const params = new URLSearchParams();
  params.set("token", tokenHash);
  params.set("type", type);
  if (redirectTo) params.set("redirect_to", redirectTo);
  return `${base}?${params.toString()}`;
}

function buttonHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#00c8b4;color:#000;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">${label}</a>`;
}

async function sendLinkEmail(
  to: string,
  subject: string,
  title: string,
  intro: string,
  linkLabel: string,
  url: string,
  otp?: string
): Promise<void> {
  const otpBlock = otp
    ? `<p style="color:#666;font-size:14px;">Or enter this code: <strong>${otp}</strong></p>`
    : "";
  await sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0a0f1e;">${title}</h2>
        <p>${intro}</p>
        ${buttonHtml(url, linkLabel)}
        ${otpBlock}
        <p style="color:#666;font-size:12px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
    text: `${intro}\n\n${url}${otp ? `\n\nCode: ${otp}` : ""}`,
  });
}

async function dispatchEmails(payload: HookPayload): Promise<void> {
  const { user, email_data: ed } = payload;
  const supabaseUrl = getSupabaseUrl();
  const type = ed.email_action_type;

  if (type === "email_change") {
    const newEmail = user.new_email?.trim();
    const hasDual =
      newEmail &&
      ed.token_hash_new &&
      ed.token_hash &&
      ed.token_new &&
      ed.token;

    if (hasDual) {
      const urlCurrent = buildVerifyLink(
        supabaseUrl,
        ed.token_hash_new,
        "email_change",
        ed.redirect_to
      );
      await sendLinkEmail(
        user.email,
        "Confirm email change — Manthana Labs",
        "Confirm email change",
        `Confirm updating your email on Manthana Labs.`,
        "Confirm change",
        urlCurrent,
        ed.token
      );

      const urlNew = buildVerifyLink(
        supabaseUrl,
        ed.token_hash,
        "email_change",
        ed.redirect_to
      );
      await sendLinkEmail(
        newEmail,
        "Confirm new email — Manthana Labs",
        "Confirm your new email",
        `Confirm this address for your Manthana Labs account.`,
        "Confirm new email",
        urlNew,
        ed.token_new
      );
      return;
    }

    const singleTo = newEmail || user.email;
    const hash = ed.token_hash || ed.token_hash_new;
    const tok = ed.token_new || ed.token;
    if (hash && tok) {
      const url = buildVerifyLink(supabaseUrl, hash, "email_change", ed.redirect_to);
      await sendLinkEmail(
        singleTo,
        "Confirm email change — Manthana Labs",
        "Confirm email change",
        `Complete the email change for your Manthana Labs account.`,
        "Confirm",
        url,
        tok
      );
    }
    return;
  }

  const withLink = new Set([
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email",
    "reauthentication",
  ]);

  if (withLink.has(type) && ed.token_hash) {
    const url = buildVerifyLink(supabaseUrl, ed.token_hash, type, ed.redirect_to);
    const map: Record<string, { subject: string; title: string; intro: string; label: string }> = {
      signup: {
        subject: "Verify your Manthana Labs account",
        title: "Welcome to Manthana Labs",
        intro: "Click below to verify your email address.",
        label: "Verify email",
      },
      invite: {
        subject: "You’re invited to Manthana Labs",
        title: "Invitation",
        intro: "You’ve been invited to create an account. Click below to accept.",
        label: "Accept invite",
      },
      magiclink: {
        subject: "Sign in to Manthana Labs",
        title: "Magic link",
        intro: "Click below to sign in. This link expires shortly.",
        label: "Sign in",
      },
      recovery: {
        subject: "Reset your Manthana Labs password",
        title: "Reset password",
        intro: "Click below to reset your password.",
        label: "Reset password",
      },
      email: {
        subject: "Confirm your email — Manthana Labs",
        title: "Confirm email",
        intro: "Click below to confirm your email address.",
        label: "Confirm email",
      },
      reauthentication: {
        subject: "Confirm it’s you — Manthana Labs",
        title: "Reauthentication",
        intro: "Use the code or link below to continue.",
        label: "Continue",
      },
    };
    const m = map[type] ?? map.signup;
    await sendLinkEmail(
      user.email,
      m.subject,
      m.title,
      m.intro,
      m.label,
      url,
      ed.token || undefined
    );
    return;
  }

  const notices: Record<string, { subject: string; body: string }> = {
    password_changed_notification: {
      subject: "Your Manthana Labs password was changed",
      body: "The password on your account was just changed. If this wasn’t you, contact support immediately.",
    },
    email_changed_notification: {
      subject: "Your Manthana Labs email was changed",
      body: "The email address on your account was updated.",
    },
    phone_changed_notification: {
      subject: "Your phone number was updated — Manthana Labs",
      body: "The phone number on your account was updated.",
    },
    identity_linked_notification: {
      subject: "Identity linked — Manthana Labs",
      body: "A new sign-in method was linked to your account.",
    },
    identity_unlinked_notification: {
      subject: "Identity unlinked — Manthana Labs",
      body: "A sign-in method was removed from your account.",
    },
    mfa_factor_enrolled_notification: {
      subject: "MFA enabled — Manthana Labs",
      body: "A new MFA factor was added to your account.",
    },
    mfa_factor_unenrolled_notification: {
      subject: "MFA removed — Manthana Labs",
      body: "An MFA factor was removed from your account.",
    },
  };

  const n = notices[type];
  if (n) {
    await sendEmail({
      to: user.email,
      subject: n.subject,
      html: `<div style="font-family:sans-serif;max-width:600px;"><p>${n.body}</p></div>`,
      text: n.body,
    });
    return;
  }

  await sendEmail({
    to: user.email,
    subject: "Manthana Labs notification",
    html: `<p>Account notification (${type}).</p>`,
    text: `Account notification (${type}).`,
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim()) {
    console.error("[auth-send-email] SUPABASE_SEND_EMAIL_HOOK_SECRET not set");
    return NextResponse.json({ error: "Hook not configured" }, { status: 503 });
  }

  const body = await req.text();
  let payload: HookPayload;
  try {
    const wh = webhookFromEnv();
    payload = wh.verify(body, headersFromRequest(req)) as HookPayload;
  } catch (e) {
    console.error("[auth-send-email] Webhook verify failed:", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dispatchEmails(payload);
  } catch (e) {
    console.error("[auth-send-email] SES error:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({});
}
