console.log("Starting SES debug...");
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("AWS_ACCESS_KEY_ID present:", !!process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY present:", !!process.env.AWS_SECRET_ACCESS_KEY);
console.log("NEXT_PUBLIC_APP_DOMAIN:", process.env.NEXT_PUBLIC_APP_DOMAIN);
console.log("BETTER_AUTH_SECRET present:", !!process.env.BETTER_AUTH_SECRET);

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const region = process.env.AWS_REGION || "ap-south-1";
const domain = process.env.NEXT_PUBLIC_APP_DOMAIN || "manthana.quaasx108.com";
const fromAddress = `noreply@${domain}`;
const toEmail = process.argv[2] || "test@example.com";

console.log("\nSES Config:");
console.log("  Region:", region);
console.log("  From:", fromAddress);
console.log("  To:", toEmail);

const sesClient = new SESClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log("\nSending email...");

const command = new SendEmailCommand({
  Source: fromAddress,
  Destination: { ToAddresses: [toEmail] },
  Message: {
    Subject: { Data: "Manthana SES Test", Charset: "UTF-8" },
    Body: {
      Html: { Data: "<p>Test email from Manthana</p>", Charset: "UTF-8" },
    },
  },
});

sesClient
  .send(command)
  .then((result) => {
    console.log("SUCCESS! MessageId:", result.MessageId);
    process.exit(0);
  })
  .catch((error) => {
    console.error("FAILED:", error.message);
    console.error("Error name:", error.name);
    if (error.message?.includes("not verified")) {
      console.error("\nTIP: Email address not verified in SES sandbox mode.");
      console.error("Verify this email in AWS SES console or request production access.");
    }
    process.exit(1);
  });
