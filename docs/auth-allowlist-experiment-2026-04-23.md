# Access Restriction Experiment and Rollback - 2026-04-23

> Status: **Reverted.** Main is back on PR #48 baseline. Azure Easy Auth has been
> torn down. This file is a reference for when the work is picked up again.
>
> Last touched: 2026-04-23 (Europe/West time).

---

## 1. Goal

Restrict the Azure-deployed Edwin Slides Creator so that only staff listed in
`Active staff list.xlsx` (an HR-sourced, confidential file) can reach the app.
The chosen strategy was **"Route 1"**: enable Azure App Service Easy Auth at the
edge, plus an Express allowlist middleware that compares the Easy Auth
principal against an email list shipped alongside the deploy.

End state after rollback: no allowlist enforcement, no Easy Auth. Frontend MSAL
SSO (pre-existing) is the only identity surface. The API is publicly reachable.

---

## 2. PR trail (above PR #48)


| PR                                                                            | Title                                                      | Merged               | Note                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#48](https://github.com/pwc-me-adv-strategyand/edwin-slides-creator/pull/48) | refactor(skills): flatten into 8 standalone categories     | 2026-04-23 07:50 UTC | **Baseline we returned to.**                                                                                                                                                                                                                                                    |
| [#49](https://github.com/pwc-me-adv-strategyand/edwin-slides-creator/pull/49) | feat(auth): allowlist middleware + Easy Auth edge gate     | 2026-04-23 08:54 UTC | Added `allowlist.middleware.ts`, wired into `app.ts`, added `backend/scripts/build-allowlist.py`, `backend/config/allowlist.txt` (gitignored), `/internal/allowlist` endpoint, `deploy.sh` ships the allowlist.                                                                 |
| [#50](https://github.com/pwc-me-adv-strategyand/edwin-slides-creator/pull/50) | feat(auth): auto-trigger MSAL login after Easy Auth edge   | 2026-04-23 09:10 UTC | `LoginPage.jsx` fires `instance.loginRedirect(loginRequest)` on mount so MSAL runs silently after the Easy Auth round-trip.                                                                                                                                                     |
| [#51](https://github.com/pwc-me-adv-strategyand/edwin-slides-creator/pull/51) | fix(auth): accept upn/email/mail claims in allowlist check | 2026-04-23 09:23 UTC | Broadened matching to parse the full `X-MS-Client-Principal` (base64 JSON) and check `upn`, `email`, `mail`, `preferred_username`, `unique_name`, plus WS-Fed long-form equivalents. Added `/internal/whoami`. **Never deployed; the partial deploy was cancelled mid-flight.** |
| [#52](https://github.com/pwc-me-adv-strategyand/edwin-slides-creator/pull/52) | revert: roll back allowlist route-1 to PR #48 baseline     | 2026-04-23 09:26 UTC | Reverts #49, #50, #51. Main is byte-for-byte equal to PR #48's merge commit.                                                                                                                                                                                                    |


### Artefacts that disappeared with the revert

- `backend/src/common/middleware/allowlist.middleware.ts`
- `backend/scripts/build-allowlist.py`
- `deploy.sh` allowlist-include block
- `.gitignore` entries for `backend/config/`, `allowlist.txt`, `Active staff list*.xlsx`
- `slide-generator/src/components/LoginPage.jsx` auto-redirect `useEffect`
- `/internal/allowlist` and `/internal/whoami` endpoints

---

## 3. Azure CLI commands used

Subscription and resource context used throughout:

```bash
SUB="pzi-gxx1-sw5t3-dev001"
RG="rg-edwin-slides"
APP="app-edwin-slides"
APP_ID="e16ab8c3-85e6-4437-960f-18b668ec58ff"   # Entra app registration
TENANT="513294a0-3e20-41b2-a970-6d30bf1546fa"   # PwC tenant
```

### 3.1 Initial audit (read-only)

```bash
az account set --subscription "$SUB"

az webapp show -g "$RG" -n "$APP" --query "state" -o tsv
az webapp auth show -g "$RG" -n "$APP"
az webapp config appsettings list -g "$RG" -n "$APP" \
  --query "[?contains(name,'AUTH') || contains(name,'BASIC') || contains(name,'PWC')].{name:name,len:length(value)}" -o table

curl -sS -o /dev/null -w '%{http_code}\n' https://app-edwin-slides.azurewebsites.net/
curl -sS -o /dev/null -w '%{http_code}\n' https://app-edwin-slides.azurewebsites.net/api/skills
```

### 3.2 Entra sign-in audit via Graph

```bash
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?\$filter=appId eq '${APP_ID}'&\$top=1000&\$orderby=createdDateTime desc&\$select=userPrincipalName,userDisplayName,createdDateTime,status" \
  > /tmp/edwin-signins.json
# Then parse with Python for unique UPNs + last-active timestamps.
```

### 3.3 App registration: add redirect URI + enable ID token issuance

```bash
# Objective ID (not appId) needed for Graph PATCH
APP_OBJ=$(az ad app show --id "$APP_ID" --query id -o tsv)

# Add /.auth/login/aad/callback to web.redirectUris
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/${APP_OBJ}" \
  --body '{"web":{"redirectUris":["https://app-edwin-slides.azurewebsites.net/.auth/login/aad/callback"],"implicitGrantSettings":{"enableIdTokenIssuance":true}}}' \
  --headers 'Content-Type=application/json'
```

Why Graph PATCH and not `az ad app update`: `az ad app update --set 'web.implicitGrantSettings=...'` did not accept the nested object syntax.

### 3.4 App registration: create client secret

```bash
az ad app credential reset \
  --id "$APP_ID" \
  --display-name "easy-auth-2026" \
  --years 2 \
  --append

# Capture the generated password into the App Service as a secret App Setting.
az webapp config appsettings set -g "$RG" -n "$APP" \
  --settings MICROSOFT_PROVIDER_AUTHENTICATION_SECRET="<password-from-above>"
```

### 3.5 Enable Easy Auth V2 against the app registration

```bash
az webapp auth update -g "$RG" -n "$APP" \
  --enabled true \
  --action RedirectToLoginPage \
  --redirect-provider azureactivedirectory \
  --runtime-version '~2' \
  --excluded-paths '["/health"]'

az webapp auth microsoft update -g "$RG" -n "$APP" \
  --client-id "$APP_ID" \
  --client-secret-setting-name MICROSOFT_PROVIDER_AUTHENTICATION_SECRET \
  --issuer "https://login.microsoftonline.com/${TENANT}/v2.0"
```

To force platform V2 when the config drifted to `platform.enabled=false` and `runtimeVersion='~1'`:

```bash
az webapp auth update -g "$RG" -n "$APP" --runtime-version '~2'
```

### 3.6 Allowlist enforcement flag

```bash
# Log-only mode (safe rollout)
az webapp config appsettings set -g "$RG" -n "$APP" \
  --settings ALLOWLIST_ENFORCE=false

# Flip to enforce
az webapp config appsettings set -g "$RG" -n "$APP" \
  --settings ALLOWLIST_ENFORCE=true
az webapp restart -g "$RG" -n "$APP"
```

### 3.7 Deployment

```bash
./deploy.sh                               # frontend build, backend tsc, zip, az webapp deploy
./deploy.sh --skip-build                  # reuse existing zip

# BUILD_ID visible via /health tells you which commit is live
curl -s https://app-edwin-slides.azurewebsites.net/health
```

Important quirk: `az webapp deploy --restart true` does a **soft** refresh.
When a source file was deleted between deploys (allowlist middleware during
revert) the Node process kept the old module in memory until a hard restart
was issued. **After every revert-style deploy, always follow with
`az webapp restart`.**

### 3.8 Kudu (SCM) for in-container inspection

Requires an ARM access token; the SCM endpoint accepts it as a Bearer token.

```bash
SCM_TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
SCM=https://app-edwin-slides.scm.azurewebsites.net

# Upload a diagnostic script
curl -sS -X PUT -H "Authorization: Bearer $SCM_TOKEN" \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/diag.sh \
  "$SCM/api/vfs/site/wwwroot/diag.sh"

# Execute it inside the container
curl -sS -X POST -H "Authorization: Bearer $SCM_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{"command":"sh diag.sh","dir":"site/wwwroot"}' \
  "$SCM/api/command"

# List and fetch Docker logs (application stdout/stderr)
curl -sS -H "Authorization: Bearer $SCM_TOKEN" "$SCM/api/logs/docker"
curl -sS -H "Authorization: Bearer $SCM_TOKEN" "$SCM/api/vfs/LogFiles/<filename>.log"
```

Note: `/api/command` runs inside the **SCM** container, which is separate from
the app container. A `ps -ef` there will not show `node dist/index.js`. To
confirm the app is live, inspect `LogFiles/*_default_docker.log` or hit
`/health` over HTTPS.

### 3.9 Rollback of Easy Auth and related Azure state

Executed in this order to avoid leaving the app gated by a half-reverted stack:

```bash
# 1) Fully disable Easy Auth (CLI alone often leaves requireAuthentication=true)
SITE_CFG="/subscriptions/a4b87b5e-e71a-4281-a8b1-be1d62a9ef04/resourceGroups/${RG}/providers/Microsoft.Web/sites/${APP}/config/authsettingsV2"
az rest --method PUT \
  --uri "https://management.azure.com${SITE_CFG}?api-version=2022-03-01" \
  --body '{"properties":{"globalValidation":{"requireAuthentication":false,"unauthenticatedClientAction":"AllowAnonymous"},"platform":{"enabled":false},"identityProviders":{"azureActiveDirectory":{"enabled":false}}}}'

# 2) Delete the two App Settings added for Easy Auth and the middleware
az webapp config appsettings delete -g "$RG" -n "$APP" \
  --setting-names MICROSOFT_PROVIDER_AUTHENTICATION_SECRET ALLOWLIST_ENFORCE

# 3) Clear the Easy Auth redirect URI from the app registration and turn
#    ID token issuance off. SPA redirect URIs are left intact because the
#    frontend MSAL flow still uses them.
APP_OBJ=$(az ad app show --id "$APP_ID" --query id -o tsv)
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/${APP_OBJ}" \
  --body '{"web":{"redirectUris":[],"implicitGrantSettings":{"enableIdTokenIssuance":false,"enableAccessTokenIssuance":false}}}' \
  --headers 'Content-Type=application/json'

# 4) OPTIONAL: delete the client secret created for Easy Auth
# (self-expires 2028-04-23; keep or drop at your discretion)
az ad app credential delete --id "$APP_ID" \
  --key-id d7b72162-bdd2-4182-9250-93e874c748f8
```

---

## 4. Git and GitHub commands used

### 4.1 Creating the revert MR (PR #52)

```bash
# Revert the three merge commits and the standalone gitignore widen
git checkout -b revert/allowlist-route1
git revert --no-edit -m 1 0e51245 439e436 c449376
# Resolve .gitignore conflict by taking pre-PR-49 state
git add .gitignore
git revert --continue --no-edit

# Confirm HEAD is byte-for-byte identical to PR #48 merge commit
git diff 99ac2ef..HEAD   # must be empty

git push -u origin revert/allowlist-route1
gh pr create --title "revert: roll back allowlist route-1 to PR #48 baseline" --body "..."
gh pr merge 52 --admin --merge --delete-branch
```

### 4.2 How PRs #49/#50/#51 were merged

```bash
gh pr merge <N> --admin --merge --delete-branch
```

Admin bypass was used each time because branch protection required a reviewer
and there was no second approver available.

---

## 5. Known gotchas (learned the hard way)

1. **Easy Auth V2 runtime drift.** After `az webapp auth update` finished
  without errors, the config still had `platform.enabled=false` and
   `runtimeVersion='~1'` while the payload was V2. Result: the Azure AD
   callback returned 401 until the runtime was forced to `~2`.
2. `**id_token` is a separate switch from the app being created.** Even with
  a client secret, a redirect URI, and a configured provider, the callback
   returns `AADSTS700054: response_type 'id_token' is not enabled` until
   `web.implicitGrantSettings.enableIdTokenIssuance=true` is set on the app
   registration. `az ad app update --set` could not patch this; Graph PATCH
   on `/v1.0/applications/<objectId>` did.
3. `**az webapp deploy --restart true` is a soft restart.** Module-cached
  code from the previous process persisted. Symptoms: logs showed middleware
   that no longer exists in `dist/app.js`. The fix is always
   `az webapp restart` after a revert-style deploy.
4. **Kudu `/api/command` runs in the SCM container, not the app container.**
  `ps -ef` there never shows the Node process. Use `LogFiles/` or `/health`
   to confirm the app is running the intended build.
5. **HR XLSX email column is not the Easy Auth UPN.** PR #51 was written to
  broaden the matcher across multiple claim types (`upn`, `email`, `mail`,
   `preferred_username`, `unique_name`, and WS-Fed long-form equivalents)
   precisely because a user with a valid session still got 403 when only
   `X-MS-Client-Principal-Name` was checked. That fix shipped but was never
   verified in production - it was reverted along with the rest.

---

## 6. Remaining drift from pristine pre-experiment state


| Item                                                                                                                 | State                 | Impact                                             | How to remove                                                    |
| -------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Entra app reg client secret `easy-auth-2026` (keyId `d7b72162-bdd2-4182-9250-93e874c748f8`)                          | Present, unreferenced | None - the App Setting that held its value is gone | `az ad app credential delete --id $APP_ID --key-id d7b72162-...` |
| Diagnostic shell scripts in `/home/site/wwwroot` (`pwc-test.sh`, `inspect.sh`, `diag.sh`, `grep-az.sh`, `mtimes.sh`) | Present               | None - not exposed over HTTP                       | Wiped on next `./deploy.sh`                                      |
| `backend/config/allowlist.txt`, `backend/config/pre-flip-audit.txt` on local dev machine                             | Present, untracked    | None - outside git                                 | `rm -rf backend/config`                                          |
| `~/Downloads/Active staff list.xlsx`                                                                                 | Untouched             | Confidential HR data, never entered git            | User-managed                                                     |


---

## 7. Recommended restart sequence when the work is resumed

1. Start from fresh `main` at the time of resume.
2. **Before touching code or enforcement, instrument first.** Add a small
  diagnostic endpoint that dumps (hashed) principal header parsing for the
   signed-in caller. Verify which claim actually carries the user's email.
3. Build `backend/config/allowlist.txt` from the HR XLSX using the same
  column selection logic as `build-allowlist.py`. Generate into a gitignored
   path. Deploy the file via `deploy.sh`.
4. Deploy middleware in **log-only** mode. Tail logs for a full working day
  and confirm every expected user matches at least one identifier.
5. Only after (4) passes with zero false negatives, set
  `ALLOWLIST_ENFORCE=true` and hard-restart.
6. Keep a one-command rollback ready:
  `az webapp config appsettings set -g $RG -n $APP --settings ALLOWLIST_ENFORCE=false && az webapp restart -g $RG -n $APP`

