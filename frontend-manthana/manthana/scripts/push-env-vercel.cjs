/**
 * Push KEY=VALUE lines from .env.local to Vercel Production via REST API
 * (avoids Windows stdin issues with `vercel env add`).
 *
 * CMD:
 *   set VERCEL_TOKEN=your_token
 *   cd /d D:\...\manthana
 *   node scripts\push-env-vercel.cjs
 *
 * Needs: .vercel/project.json from `vercel link` (projectId + orgId).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.resolve(process.argv[2] || path.join(root, ".env.local"));
const token = process.env.VERCEL_TOKEN;

const projectFile = path.join(root, ".vercel", "project.json");

if (!token) {
  console.error("Missing VERCEL_TOKEN — https://vercel.com/account/tokens");
  process.exit(1);
}

if (!fs.existsSync(projectFile)) {
  console.error("Missing .vercel/project.json — run: vercel link");
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error("File not found:", envPath);
  process.exit(1);
}

const { projectId, orgId } = JSON.parse(fs.readFileSync(projectFile, "utf8"));
if (!projectId) {
  console.error(".vercel/project.json must contain projectId");
  process.exit(1);
}

const SKIP = new Set([
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
]);

function parseLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const eq = t.indexOf("=");
  if (eq === -1) return null;
  const key = t.slice(0, eq).trim();
  if (!key || SKIP.has(key)) return null;
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return { key, val };
}

function envType(key) {
  if (key.startsWith("NEXT_PUBLIC_")) return "plain";
  return "encrypted";
}

async function upsertEnv(key, value) {
  const params = new URLSearchParams({ upsert: "true" });
  if (orgId) params.set("teamId", orgId);

  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(
    projectId
  )}/env?${params}`;

  const body = {
    key,
    value,
    type: envType(key),
    target: ["production"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, json };
}

function main() {
  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);

  return (async () => {
    let ok = 0;
    let fail = 0;

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const { key, val } = parsed;

      if (val === "") {
        console.log("⊘ skip empty:", key);
        continue;
      }

      if (key === "ORACLE_INTERNAL_URL" && /127\.0\.0\.1|localhost/i.test(val)) {
        console.warn(
          `[warn] ${key} is local — production Oracle proxy will not work until you set a public HTTPS URL.`
        );
      }
      if (key === "NEXT_PUBLIC_APP_URL" && /localhost/i.test(val)) {
        console.warn(
          `[warn] ${key} is localhost — use https://manthana.quaasx108.com for production.`
        );
      }

      process.stdout.write(`→ ${key} … `);
      const r = await upsertEnv(key, val);
      if (r.ok) {
        console.log("ok");
        ok += 1;
      } else {
        console.log("FAILED", r.status);
        console.error(JSON.stringify(r.json, null, 2));
        fail += 1;
      }
    }

    console.log(`\nDone. ${ok} ok, ${fail} failed.`);
    if (fail === 0) {
      console.log("Redeploy: vercel --prod --token %VERCEL_TOKEN%");
    }
  })();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
