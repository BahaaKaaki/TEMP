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

### Graph assigned-user audit table

Use this when checking "the users". The total user inventory is the Enterprise
App assignment list, not the sign-in log. This command pages through
`appRoleAssignedTo`, resolves assigned user details, overlays recent sign-in
activity for context, compares each assigned user's UPN with the live Kudu
allowlist, then copies a compact Markdown table to the clipboard sorted by
last sign-in date descending.

```bash
SP_ID='d22acabf-976f-4929-a15a-95b9202b98d6'
APP_ID='e16ab8c3-85e6-4437-960f-18b668ec58ff'
SINCE_UTC="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
)"
SCM='https://app-edwin-slides.scm.azurewebsites.net'

SP_ID="$SP_ID" APP_ID="$APP_ID" SINCE_UTC="$SINCE_UTC" SCM="$SCM" python3 - <<'PY'
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import urllib.parse

SP_ID = os.environ["SP_ID"]
APP_ID = os.environ["APP_ID"]
SINCE_UTC = os.environ["SINCE_UTC"]
SCM = os.environ["SCM"].rstrip("/")


def run(cmd: list[str], input_text: str | None = None) -> str:
    return subprocess.run(cmd, input=input_text, text=True, stdout=subprocess.PIPE, check=True).stdout.strip()


def az_rest(method: str, uri: str, body: dict | None = None) -> dict:
    cmd = ["az", "rest", "--method", method, "--uri", uri, "-o", "json"]
    if body is not None:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(body, handle)
            body_path = handle.name
        cmd.extend(["--body", f"@{body_path}", "--headers", "Content-Type=application/json"])
    return json.loads(run(cmd))


def graph_get_all(uri: str) -> tuple[list[dict], int]:
    rows: list[dict] = []
    pages = 0
    while uri:
        pages += 1
        page = az_rest("GET", uri)
        rows.extend(page.get("value", []))
        uri = page.get("@odata.nextLink")
    return rows, pages


def graph_url(path: str, params: dict[str, str]) -> str:
    return "https://graph.microsoft.com/v1.0" + path + "?" + urllib.parse.urlencode(params)


assignments, assignment_pages = graph_get_all(graph_url(f"/servicePrincipals/{SP_ID}/appRoleAssignedTo", {
    "$top": "999",
    "$select": "principalDisplayName,principalType,principalId,createdDateTime",
}))
user_assignments = [item for item in assignments if item.get("principalType") == "User"]
ids = [item["principalId"] for item in user_assignments if item.get("principalId")]

users_by_id: dict[str, dict] = {}
for start in range(0, len(ids), 100):
    body = {"ids": ids[start:start + 100], "types": ["user"]}
    data = az_rest(
        "POST",
        "https://graph.microsoft.com/v1.0/directoryObjects/getByIds"
        "?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType",
        body,
    )
    for user in data.get("value", []):
        users_by_id[user.get("id")] = user

signins, signin_pages = graph_get_all(graph_url("/auditLogs/signIns", {
    "$top": "1000",
    "$filter": f"appId eq '{APP_ID}' and createdDateTime ge {SINCE_UTC}",
    "$orderby": "createdDateTime desc",
}))
signins_by_user_id: dict[str, str] = {}
for item in signins:
    user_id = item.get("userId")
    created = item.get("createdDateTime") or ""
    if user_id and created > signins_by_user_id.get(user_id, ""):
        signins_by_user_id[user_id] = created

scm_token = run([
    "az", "account", "get-access-token",
    "--resource", "https://management.azure.com",
    "--query", "accessToken",
    "-o", "tsv",
])
allow_text = run([
    "curl", "-sS", "--fail",
    "-H", f"Authorization: Bearer {scm_token}",
    f"{SCM}/api/vfs/site/wwwroot/config/allowlist.txt",
])
allowlist = {
    line.strip().lower()
    for line in allow_text.splitlines()
    if line.strip() and not line.strip().startswith("#")
}

rows = []
for assignment in user_assignments:
    user_id = assignment.get("principalId")
    user = users_by_id.get(user_id, {})
    email = (user.get("userPrincipalName") or user.get("mail") or "").lower()
    rows.append({
        "last": signins_by_user_id.get(user_id, "-"),
        "email": email or "-",
        "name": user.get("displayName") or assignment.get("principalDisplayName") or "-",
        "allowlist": "No" if email not in allowlist else "Yes",
    })

rows_with_dates = [row for row in rows if row["last"] != "-"]
rows_without_dates = [row for row in rows if row["last"] == "-"]
rows = sorted(rows_with_dates, key=lambda row: row["last"], reverse=True) + rows_without_dates

summary_lines = [
    "Edwin assigned-user audit",
    f"Generated UTC: {run(['date', '-u', '+%Y-%m-%dT%H:%M:%SZ'])}",
    f"Assigned users: {len(user_assignments)}",
    f"Assignment Graph pages: {assignment_pages}",
    f"Recent sign-in events since {SINCE_UTC}: {len(signins)}",
    f"Recent sign-in Graph pages: {signin_pages}",
    f"Live allowlist entries: {len(allowlist)}",
    f"Not in allowlist: {sum(1 for row in rows if row['allowlist'] == 'No')}",
    "",
]
header = "| Last sign-in UTC | Email | Name | Allowlist |"
separator = "|---|---|---|---:|"
row_lines = [
    f"| {row['last']} | {row['email']} | {row['name']} | {row['allowlist']} |"
    for row in rows
]
report = "\n".join(summary_lines + [header, separator] + row_lines) + "\n"
run(["pbcopy"], input_text=report)

print("Full compact Markdown table copied to clipboard.")
print("\n".join(summary_lines).rstrip())
print()
print("Latest 25 rows:")
print(header)
print(separator)
for line in row_lines[:25]:
    print(line)
PY
```

### Recent sign-in audit table

Use this only when you want active/recent users rather than total assigned
users. It queries Microsoft Graph with `@odata.nextLink` pagination, compares
recent sign-ins with Enterprise App assignments and the live Kudu allowlist,
and prints a CLI table with rows that need review pinned first.

```bash
APP_ID='e16ab8c3-85e6-4437-960f-18b668ec58ff'
SP_ID='d22acabf-976f-4929-a15a-95b9202b98d6'
SINCE_UTC="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
)"
SCM='https://app-edwin-slides.scm.azurewebsites.net'

APP_ID="$APP_ID" SP_ID="$SP_ID" SINCE_UTC="$SINCE_UTC" SCM="$SCM" python3 - <<'PY'
from __future__ import annotations

import json
import os
import subprocess
import urllib.parse

APP_ID = os.environ["APP_ID"]
SP_ID = os.environ["SP_ID"]
SINCE_UTC = os.environ["SINCE_UTC"]
SCM = os.environ["SCM"].rstrip("/")


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def graph_get_all(uri: str) -> list[dict]:
    rows: list[dict] = []
    while uri:
        page = json.loads(run(["az", "rest", "--method", "GET", "--uri", uri, "-o", "json"]))
        rows.extend(page.get("value", []))
        uri = page.get("@odata.nextLink")
    return rows


def graph_url(path: str, params: dict[str, str]) -> str:
    return "https://graph.microsoft.com/v1.0" + path + "?" + urllib.parse.urlencode(params)


signins = graph_get_all(graph_url("/auditLogs/signIns", {
    "$top": "1000",
    "$filter": f"appId eq '{APP_ID}' and createdDateTime ge {SINCE_UTC}",
    "$orderby": "createdDateTime desc",
}))
assignments = graph_get_all(graph_url(f"/servicePrincipals/{SP_ID}/appRoleAssignedTo", {
    "$top": "999",
    "$select": "principalDisplayName,principalType,principalId,createdDateTime",
}))
assignment_names = {row.get("principalDisplayName", "") for row in assignments}

scm_token = run([
    "az", "account", "get-access-token",
    "--resource", "https://management.azure.com",
    "--query", "accessToken",
    "-o", "tsv",
])
allow_text = run([
    "curl", "-sS", "--fail",
    "-H", f"Authorization: Bearer {scm_token}",
    f"{SCM}/api/vfs/site/wwwroot/config/allowlist.txt",
])
allowlist = {
    line.strip().lower()
    for line in allow_text.splitlines()
    if line.strip() and not line.strip().startswith("#")
}

users: dict[str, dict] = {}
for item in signins:
    email = (item.get("userPrincipalName") or "").lower()
    if not email:
        continue
    status = item.get("status") or {}
    code = status.get("errorCode")
    rec = users.setdefault(email, {
        "email": email,
        "name": item.get("userDisplayName") or "",
        "last_seen": item.get("createdDateTime") or "",
        "ok": 0,
        "fail": 0,
    })
    if (item.get("createdDateTime") or "") > rec["last_seen"]:
        rec["last_seen"] = item.get("createdDateTime") or ""
        rec["name"] = item.get("userDisplayName") or rec["name"]
    rec["ok" if code == 0 else "fail"] += 1

rows = []
for rec in users.values():
    assigned = rec["name"] in assignment_names
    allowed = rec["email"] in allowlist
    rows.append({
        "flag": "CHECK" if not (rec["ok"] and assigned and allowed) else "",
        "allow": "yes" if allowed else "no",
        "assign": "yes" if assigned else "no",
        "ok": str(rec["ok"]),
        "fail": str(rec["fail"]),
        "last": rec["last_seen"],
        "email": rec["email"],
        "name": rec["name"],
    })

rows.sort(key=lambda row: row["last"], reverse=True)
rows.sort(key=lambda row: row["flag"] != "CHECK")

columns = [
    ("Flag", "flag", 5),
    ("Allow", "allow", 5),
    ("Assign", "assign", 6),
    ("OK", "ok", 3),
    ("Fail", "fail", 4),
    ("Last seen UTC", "last", 20),
    ("Email", "email", 34),
    ("Name", "name", 34),
]


def cell(value: object, width: int) -> str:
    text = str(value)
    return text if len(text) <= width else text[: max(0, width - 1)] + "~"


def border() -> str:
    return "+" + "+".join("-" * (width + 2) for _, _, width in columns) + "+"


def table_row(values: list[str]) -> str:
    return "| " + " | ".join(
        cell(value, width).ljust(width)
        for value, (_, _, width) in zip(values, columns)
    ) + " |"


print("Edwin user access audit")
print(f"Since UTC        : {SINCE_UTC}")
print(f"Graph events     : {len(signins)}")
print(f"Unique users     : {len(users)}")
print(f"App assignments  : {len(assignments)}")
print(f"Live allowlist   : {len(allowlist)}")
print(f"Rows to check    : {sum(1 for row in rows if row['flag'])}")
print()
print(border())
print(table_row([title for title, _, _ in columns]))
print(border())
for item in rows:
    print(table_row([item[key] for _, key, _ in columns]))
print(border())
PY
```

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
