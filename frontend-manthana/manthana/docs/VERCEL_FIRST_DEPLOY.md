# Step 1 — Frontend only: new GitHub repo + Vercel (auto deploy)

This app is the **Next.js root** in this folder (`manthana`). Treat this directory as the **repository root** when you create the new repo.

Supabase is already configured; after Vercel gives you a URL, add it under **Supabase → Authentication → URL configuration** (see below).

---

## 1. Create an empty GitHub repository

1. On GitHub: **New repository** (this project uses e.g. `final-vercel-manthana` under user `shivakumar777-web`).
2. **Do not** add a README/license/gitignore if you want a clean first push from your machine (or add them—either works).
3. Copy the remote URL, e.g. `https://github.com/shivakumar777-web/final-vercel-manthana.git`.

---

## 2. Push this folder as that repo (on your PC, CMD or Git Bash)

Install [Git for Windows](https://git-scm.com/download/win) if `git` is not on your PATH.

```cmd
cd /d "d:\studio-backup\this_studio\oracle-2\frontend-manthana\manthana"

git init
git branch -M main
git add -A
git status
git commit -m "Initial commit: Manthana Next.js frontend"

git remote add origin https://github.com/shivakumar777-web/final-vercel-manthana.git
git push -u origin main
```

If the GitHub repo was created with a README and push is rejected:

```cmd
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## 3. Connect Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → **Import** your GitHub repo.
2. **Root Directory**: leave `.` (repo root **is** this Next.js app).
3. **Framework Preset**: Next.js (auto).
4. **Build Command**: `npm run build` (default).
5. **Output**: default (Next.js).
6. Deploy once; the first build may fail until env vars are set—add them and **Redeploy**.

---

## 4. Environment variables (Vercel → Project → Settings → Environment Variables)

Set at least these for **Production** (and Preview if you use preview URLs).

### Required for auth + DB (Supabase)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Public key (anon or publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to client; needed for webhooks/admin routes |

### Required for correct links and redirects

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_APP_URL` | Your live site, e.g. `https://manthana.yourdomain.com` |
| `NEXT_PUBLIC_APP_DOMAIN` | Hostname used in emails/links if your code references it |

### Backend / Oracle (Railway step 2)

Point these at wherever your APIs run. For **Manthana production** on `manthana.quaasx108.com`, the intended Oracle base is **`https://oracle.manthana.quaasx108.com`** (no trailing slash): deploy **oracle-service** on Railway, add that custom domain in Railway, create a DNS **CNAME** for `oracle.manthana` to Railway’s target, then set `ORACLE_INTERNAL_URL` in Vercel to match. Until the custom domain verifies, use Railway’s **`https://<service>.up.railway.app`** URL temporarily.

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_GATEWAY_URL` | Often same-origin: `/api/oracle-backend` or full URL to gateway |
| `NEXT_PUBLIC_API_URL` | Public API base the **browser** may call |
| `ORACLE_INTERNAL_URL` | **Server-side only** — URL Vercel serverless uses to reach Oracle (Railway); not localhost on Vercel |

Use **relative** paths like `/api/oracle-backend` for same-origin routes where your Next app proxies.

### Optional (enable when you use them)

- Razorpay: `RAZORPAY_*`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- AWS SES: `AWS_*`, SMTP if used
- `SUPABASE_SEND_EMAIL_HOOK_SECRET` if using send-email hook

Copy values from your local `.env.local`; **do not commit** `.env.local`.

---

## 5. Supabase dashboard (after first Vercel URL exists)

**Authentication → URL configuration**

- **Site URL**: set to your **production** URL (HTTPS), e.g. `https://manthana.quaasx108.com`. If this stays `http://localhost:3000`, OAuth can send users back to localhost after Google.
- **Redirect URLs**: add (wildcard is fine)  
  `https://YOUR-VERCEL-APP.vercel.app/**`  
  and your custom domain, including the auth callback explicitly, e.g.  
  `https://manthana.quaasx108.com/auth/callback`  
  and `http://localhost:3000/**` for local dev.

### Google sign-in (`Unsupported provider` / `provider is not enabled`)

That response comes from **Supabase**, not Vercel. Updating env vars on Vercel does not enable Google.

1. **Supabase** → **Authentication** → **Providers** → **Google** → turn **Enable** on.
2. In **Google Cloud Console** → **APIs & Services** → **Credentials** → **OAuth 2.0 Client ID** (Web application):
   - **Authorized redirect URIs** must include exactly:  
     `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`  
     (use the ref from `NEXT_PUBLIC_SUPABASE_URL`, not your Vercel domain).
   - Optionally **Authorized JavaScript origins**: your site `https://manthana.quaasx108.com` (and localhost for dev).
3. Paste **Client ID** and **Client Secret** into the Supabase Google provider form and **Save**.

---

## 6. Confirm auto deploy

Every `git push` to `main` should trigger a Vercel deployment. Pull requests can use Preview deployments (optional in Vercel settings).

---

## Next steps (your roadmap)

- **Step 2 — Railway**: deploy Oracle/backend services; set `ORACLE_INTERNAL_URL` and public API URLs in Vercel to those hosts.
- **Modal**: same idea—set env vars to Modal HTTP endpoints when ready.

---

## Troubleshooting

- **Build fails on Vercel**: open the build log; often missing `NEXT_PUBLIC_*` or wrong Node version (Vercel defaults are usually fine for Next 14).
- **Login works locally but not on Vercel**: fix **Site URL** + **Redirect URLs** in Supabase; set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS URL.
- **Middleware redirect loop**: ensure `NEXT_PUBLIC_SUPABASE_*` match the same Supabase project you use in production.
