# Allowlist Path B — Flip-day Runbook

**Status:** DRAFT — PR open, not deployed. This document is the full set of
commands to run **when we decide to enable backend JWT validation + staff
allowlist**. Nothing here changes the live app by itself; every step is gated
behind an explicit `az` or `gh` command you run yourself.

Related documents:

- [`docs/auth-allowlist-experiment-2026-04-23.md`](../auth-allowlist-experiment-2026-04-23.md) — post-mortem of Path A (Easy Auth) that motivated Path B.
- PR `feat/jwt-allowlist-backend-v2` — the code changes this runbook activates.

## Design recap

Path B enforces access at the Express layer, using the Entra ID token that
the existing frontend MSAL login already issues. No Easy Auth, no edge
proxy, no second app registration secret.

```
Browser ── (MSAL ID token) ──▶ Express ── (API-Key) ──▶ PwC Shared Services
              │                     │
              │                     ├── verify JWT against tenant JWKS
              │                     ├── extract preferred_username
              │                     └── check lowercase email in allowlist.txt
              │
              └── /api/whoami bootstrap decides which UI to render
```

Three operating modes (`ALLOWLIST_MODE` app setting):

| Mode    | JWT required | Non-listed behaviour | Use for                               |
|---------|--------------|----------------------|---------------------------------------|
| off     | no           | allow everyone       | default post-merge state              |
| log     | yes          | allow + log warning  | observe claim mapping with real users |
| enforce | yes          | `403 ACCESS_DENIED`  | real access control                   |

Under all three modes `/health` is public (Azure needs it for warm-up probes).

---

## 0. Pre-merge checks (one-off)

Run these before merging the PR. None of them touch the live app.

```bash
# Make sure the code compiles cleanly locally
cd backend && npm install && npm run build && cd ..
cd slide-generator && npm install && npm run build && cd ..

# Confirm the Entra app registration we already use is the right one
az ad app show \
  --id e16ab8c3-85e6-4437-960f-18b668ec58ff \
  --query "{appId:appId, tenantId:publisherDomain, web:web.redirectUris, spa:spa.redirectUris}"
```

The SPA redirect URIs must contain `https://app-edwin-slides.azurewebsites.net/`
(this is already configured — leftover from the MSAL SSO that shipped months
ago). **No app-registration changes are needed for Path B.**

---

## 1. Merge the PR

```bash
# From your workstation
gh pr checks feat/jwt-allowlist-backend-v2
gh pr merge feat/jwt-allowlist-backend-v2 --admin --merge --delete-branch
```

At this point `main` has the middleware wired up but every environment is
still in `ALLOWLIST_MODE=off`, so behaviour is identical to today.

---

## 2. Build the allowlist file locally

```bash
# Re-run whenever HR publishes a new Active staff list
cd /Users/bkaaki001/Developer/edwin-slides-creator

python3 backend/scripts/build-allowlist.py \
  --input '/Users/bkaaki001/Downloads/Active staff list.xlsx' \
  --output backend/config/allowlist.txt

# Sanity-check -- prints count + sha256 prefix only, never emails
wc -l backend/config/allowlist.txt
head -7 backend/config/allowlist.txt   # header comment block
```

The file is gitignored (see `.gitignore` block for `backend/config/`). Never
commit it.

Optional status filter (include only `Active` rows, for example):

```bash
python3 backend/scripts/build-allowlist.py \
  --input '/Users/bkaaki001/Downloads/Active staff list.xlsx' \
  --output backend/config/allowlist.txt \
  --include-statuses 'Active'
```

---

## 3. Set app settings on Azure (start in LOG mode)

```bash
SUB='pzi-gxx1-sw5t3-dev001'
RG='rg-edwin-slides'
APP='app-edwin-slides'

az account set --subscription "$SUB"

az webapp config appsettings set \
  --resource-group "$RG" --name "$APP" \
  --settings \
    AZURE_CLIENT_ID='e16ab8c3-85e6-4437-960f-18b668ec58ff' \
    AZURE_TENANT_ID='a9f9e7ba-fbed-4833-9b92-d42ac92ea7cf' \
    ALLOWLIST_MODE='log' \
    ALLOWLIST_PATH='config/allowlist.txt' \
  --output none
```

> Replace `AZURE_TENANT_ID` with the actual PwC tenant ID if different --
> grab it from `az account show --query tenantId -o tsv`. The tenant ID above
> is a placeholder; verify before applying.

---

## 4. Deploy

`deploy.sh` already copies `backend/config/` into the zip. So:

```bash
./deploy.sh
```

Inside the Azure container, the middleware will:

1. Read `config/allowlist.txt` at boot. If missing while mode is not `off`,
   the process fails to start (loud failure, safer than silent default-allow).
2. Verify Entra ID JWTs against the tenant's JWKS.
3. Log every request with `email` and whether it's on the allowlist. No 403s
   yet — we're in `log` mode.

---

## 5. Observe for an hour or two

```bash
# Tail the app logs and watch for [allowlist] LOG-ONLY lines
az webapp log tail --resource-group "$RG" --name "$APP" \
  | grep -E '\[allowlist\]|\[entraAuth\]'

# Expected output shape:
#  [allowlist] loaded 217 entries from /home/site/wwwroot/config/allowlist.txt (mode=log)
#  [allowlist] LOG-ONLY path=/api/ai/chat email=someone@pwc.com oid=... (would block in enforce mode)
```

Confirm:

- Known good users (you, known testers) appear with `onAllowlist` behaviour
  matching expectation (you should NOT see their emails in `LOG-ONLY` lines).
- The email format coming out of Entra (`preferred_username` claim) matches
  the format in `allowlist.txt`. If there's a mismatch, rebuild the allowlist
  with `--status-column` / status filter tweaks or adjust the Python script.
- `/api/whoami` returns `{mode:"log", allowed:true, onAllowlist:<bool>}` in
  the browser devtools network tab for at least one logged-in user.

---

## 6. Flip to ENFORCE

Once the logs look clean:

```bash
az webapp config appsettings set \
  --resource-group "$RG" --name "$APP" \
  --settings ALLOWLIST_MODE='enforce' \
  --output none

# Hard restart so Node picks up the new setting without module-cache drag
az webapp restart --resource-group "$RG" --name "$APP"

# Quick smoke check from an allowlisted account
# (open https://app-edwin-slides.azurewebsites.net/ in a browser, log in,
# verify the editor loads and a chat message round-trips)
```

A **non**-allowlisted account should see the `<AccessDenied/>` screen instead
of the editor, and the server logs should show `[allowlist] BLOCKED ...`.

---

## 7. Rollback

At any point:

```bash
# Back to log-only (keeps observing, stops blocking)
az webapp config appsettings set \
  --resource-group "$RG" --name "$APP" \
  --settings ALLOWLIST_MODE='log' \
  --output none
az webapp restart --resource-group "$RG" --name "$APP"

# Fully disable (identical to pre-PR behaviour)
az webapp config appsettings set \
  --resource-group "$RG" --name "$APP" \
  --settings ALLOWLIST_MODE='off' \
  --output none
az webapp restart --resource-group "$RG" --name "$APP"
```

The frontend still sends the Authorization header in `off` mode — the
middleware simply ignores it, so there's no breakage from leftover tokens.

---

## 8. Adding / removing someone later

Edit the XLSX (or regenerate via HR export), rerun step 2 locally, and
redeploy. There's no database; the allowlist is just a text file shipped
with each deploy.

For emergency one-off additions without a full deploy, you can upload the
updated `config/allowlist.txt` directly to Kudu:

```bash
ZIP=/tmp/allowlist.zip
mkdir -p /tmp/config && cp backend/config/allowlist.txt /tmp/config/
( cd /tmp && zip -r "$ZIP" config )

az webapp deploy \
  --resource-group "$RG" --name "$APP" \
  --src-path "$ZIP" \
  --type zip \
  --async false \
  --clean false

az webapp restart --resource-group "$RG" --name "$APP"
```

---

## Troubleshooting

**`401 UNAUTHENTICATED` on every call** — frontend isn't attaching the token.
Check devtools network for the `Authorization: Bearer` header. If missing,
the MSAL instance probably isn't registered with `authFetch`. Re-check
`main.jsx` calls `setMsalInstance(msalInstance, loginRequest)`.

**`401 Invalid or expired token`** — JWT audience or issuer mismatch. Run:

```bash
az webapp log download --resource-group "$RG" --name "$APP" --log-file /tmp/logs.zip
unzip -p /tmp/logs.zip | grep entraAuth
```

The log line will include the verifier error (`audience mismatch`,
`issuer mismatch`, `kid not found`, etc.). Compare against the values in
the app settings.

**Users see the AccessDenied screen when they shouldn't** — their email in
the XLSX doesn't match their `preferred_username` in Entra. Call
`/api/whoami` while logged in, inspect the returned `email`, compare with
`allowlist.txt`, fix whichever side is wrong and redeploy.

**App fails to start after flip** — almost always means
`config/allowlist.txt` didn't make it into the deploy. Check
`deploy-temp/config/allowlist.txt` exists before `zip` runs. The `az log`
output will say `Allowlist file missing at ...`.
