/**
 * Amazon SES Email Service
 * Handles transactional emails: receipts, notifications, and (when configured)
 * Supabase auth mail via the Send Email hook at /api/supabase/auth-send-email.
 *
 * IMPORTANT: SES Sandbox Mode vs Production
 * - SANDBOX: You can ONLY send TO verified email addresses
 * - PRODUCTION: Can send to any address (request via AWS SES console)
 *
 * To verify a recipient email in sandbox:
 * AWS SES → Verified identities → Create identity → Email address
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Validate required environment variables
function validateSESConfig() {
  const required = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "NEXT_PUBLIC_APP_DOMAIN",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      "[SES] Missing required environment variables:",
      missing.join(", ")
    );
    console.error(
      "[SES] Please check your .env.local file and ensure all AWS SES variables are set"
    );
  }
}

// Validate on module load
validateSESConfig();

const sesClient = new SESClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const fromAddress =
    options.from ||
    `noreply@${process.env.NEXT_PUBLIC_APP_DOMAIN || "manthana.quaasx108.com"}`;

  console.log("[SES] Attempting to send email:", {
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    region: process.env.AWS_REGION || "ap-south-1",
  });

  const command = new SendEmailCommand({
    Source: fromAddress,
    Destination: { ToAddresses: [options.to] },
    Message: {
      Subject: { Data: options.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: options.html, Charset: "UTF-8" },
        Text: options.text
          ? { Data: options.text, Charset: "UTF-8" }
          : undefined,
      },
    },
  });

  try {
    const result = await sesClient.send(command);
    console.log("[SES] Email sent successfully:", {
      messageId: result.MessageId,
      to: options.to,
    });
  } catch (error: any) {
    console.error("[SES] Failed to send email:", {
      error: error.message,
      to: options.to,
      from: fromAddress,
      code: error.name,
    });

    // Provide helpful guidance for common SES errors
    if (error.message?.includes("not verified")) {
      console.error(
        "[SES] TIP: In SANDBOX mode, recipient email must be verified in AWS SES console"
      );
      console.error(
        "[SES] TIP: Go to AWS SES → Verified identities → Create identity → Email address"
      );
      console.error(
        "[SES] TIP: Or request production access to send to any email address"
      );
    }

    if (error.message?.includes("credentials")) {
      console.error(
        "[SES] TIP: Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local"
      );
    }

    throw error;
  }
}

// Specific email templates
export async function sendVerificationEmail(
  to: string,
  verificationUrl: string
): Promise<void> {
  console.log("[SES] Sending verification email to:", to);
  await sendEmail({
    to,
    subject: "Verify your Manthana Labs account",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a0f1e;">Welcome to Manthana Labs</h2>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationUrl}" 
           style="display: inline-block; background: #00c8b4; color: #000; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 12px;">If you didn't create an account, ignore this email.</p>
      </div>
    `,
    text: `Verify your Manthana Labs account: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPaymentReceipt(
  to: string,
  amount: number,
  planName: string,
  invoiceId: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Payment confirmed - Manthana Labs ${planName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a0f1e;">Payment Confirmed</h2>
        <p>Thank you for subscribing to Manthana Labs!</p>
        <table style="margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Plan:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${planName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">₹${amount}</td></tr>
          <tr><td style="padding: 8px;"><strong>Invoice:</strong></td>
              <td style="padding: 8px;">${invoiceId}</td></tr>
        </table>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/analyse" 
           style="display: inline-block; background: #00c8b4; color: #000; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Access Premium Features
        </a>
      </div>
    `,
    text: `Payment confirmed for ${planName}. Amount: ₹${amount}. Invoice: ${invoiceId}. Access: ${process.env.NEXT_PUBLIC_APP_URL}/analyse`,
  });
}

export async function sendSubscriptionExpiringEmail(
  to: string,
  expiryDate: string
): Promise<void> {
  await sendEmail({
    to,
    subject: "Your Manthana Labs subscription expires soon",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a0f1e;">Subscription Expiring</h2>
        <p>Your subscription expires on <strong>${expiryDate}</strong>.</p>
        <p>Renew now to keep unlimited access to premium AI analysis features.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription" 
           style="display: inline-block; background: #00c8b4; color: #000; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Renew Subscription
        </a>
      </div>
    `,
    text: `Your subscription expires on ${expiryDate}. Renew: ${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription`,
  });
}
