#!/usr/bin/env node
/**
 * AWS SES Test Script
 *
 * Usage:
 *   npm run test-ses -- your@email.com
 *   OR
 *   node --env-file=.env.local scripts/test-ses.mjs your@email.com
 *
 * IMPORTANT: SES Sandbox Mode
 * - If your SES account is in SANDBOX mode (default), you can ONLY send to VERIFIED addresses
 * - To verify an email: AWS Console → SES → Verified identities → Create identity → Email address
 * - To get production access: AWS Console → SES → Request production access (removes recipient restrictions)
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error("❌ ERROR: No recipient email provided");
  console.error("\nUsage:");
  console.error('  npm run test-ses -- your@email.com');
  console.error("\nExample:");
  console.error('  npm run test-ses -- test@manthana.quaasx108.com');
  process.exit(1);
}

// Validate environment variables
const required = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ ERROR: Missing required environment variables:");
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error("\nPlease check your .env.local file and ensure all AWS SES variables are set.");
  process.exit(1);
}

const region = process.env.AWS_REGION || "ap-south-1";
const domain = process.env.NEXT_PUBLIC_APP_DOMAIN || "manthana.quaasx108.com";
const fromAddress = `noreply@${domain}`;

console.log("========================================");
console.log("📧 AWS SES Test Script");
console.log("========================================");
console.log(`Region: ${region}`);
console.log(`From: ${fromAddress}`);
console.log(`To: ${recipientEmail}`);
console.log(`AWS Key ID: ${process.env.AWS_ACCESS_KEY_ID?.slice(0, 8)}...`);
console.log("========================================\n");

const sesClient = new SESClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const command = new SendEmailCommand({
  Source: fromAddress,
  Destination: { ToAddresses: [recipientEmail] },
  Message: {
    Subject: {
      Data: "Manthana Labs - SES Test Email",
      Charset: "UTF-8",
    },
    Body: {
      Html: {
        Data: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0a0f1e;">✅ SES Test Successful</h2>
            <p>This is a test email from Manthana Labs platform.</p>
            <p>Your AWS SES configuration is working correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px;">
              Region: ${region}<br/>
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
        Charset: "UTF-8",
      },
      Text: {
        Data: `SES Test Email\n\nThis is a test email from Manthana Labs. Your AWS SES configuration is working!\nRegion: ${region}\nSent at: ${new Date().toISOString()}`,
        Charset: "UTF-8",
      },
    },
  },
});

console.log("⏳ Sending email...\n");

sesClient
  .send(command)
  .then((result) => {
    console.log("✅ SUCCESS! Email sent successfully.");
    console.log(`   Message ID: ${result.MessageId}`);
    console.log("\n📋 Next Steps:");
    console.log("   1. Check your inbox (and spam folder)");
    console.log("   2. Verify Better Auth integration");
    console.log("   3. Test sign-up flow to see verification email");
  })
  .catch((error) => {
    console.error("\n❌ FAILED to send email");
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.name}`);

    // Provide specific guidance based on error
    console.error("\n🔍 Diagnosis:");

    if (error.message?.includes("not verified")) {
      console.error("\n   SES is in SANDBOX mode.");
      console.error("   You can only send to VERIFIED email addresses.");
      console.error("\n   💡 FIX: Verify this email in AWS SES console:");
      console.error(`      1. Go to: https://${region}.console.aws.amazon.com/ses/home`);
      console.error("      2. Click 'Verified identities'");
      console.error("      3. Click 'Create identity'");
      console.error(`      4. Enter: ${recipientEmail}`);
      console.error("      5. Click 'Create identity'");
      console.error("\n   OR request production access to send to any email.");
    } else if (error.message?.includes("credentials")) {
      console.error("\n   AWS credentials are invalid or missing.");
      console.error("   Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local");
    } else if (error.message?.includes("region")) {
      console.error("\n   Invalid AWS region specified.");
      console.error(`   Current region: ${region}`);
      console.error("   Check AWS_REGION in .env.local");
    } else if (error.message?.includes("domain")) {
      console.error("\n   The 'From' domain is not verified.");
      console.error(`   From address: ${fromAddress}`);
      console.error("\n   💡 FIX: Verify your domain in AWS SES:");
      console.error(`      1. Go to: https://${region}.console.aws.amazon.com/ses/home`);
      console.error("      2. Click 'Verified identities'");
      console.error(`      3. Verify domain: ${domain}`);
    } else {
      console.error("\n   Unknown error. Check AWS SES console for details.");
    }

    process.exit(1);
  });
