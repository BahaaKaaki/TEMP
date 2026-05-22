# Edwin daily usage email (on-demand)

Sends an HTML email with **distinct users** who signed in to Edwin for **yesterday** and **today** (UTC), plus assigned-user and month-to-date counts.

**Not scheduled** — run manually when you want the report.

## Recipients (default)

- bahaa.kaaki@pwc.com
- georges.hakme@pwc.com
- mohamed.moslemani@pwc.com
- mohammad.hariri@pwc.com
- youssef.moussallem@pwc.com

Override with environment variable `REPORT_RECIPIENTS` (comma-separated).

## Quick start

Sign in with an account that can read Entra sign-in logs (e.g. `bahaa.kaaki@admin.pwc.com`):

```bash
az login --use-device-code --tenant 513294a0-3e20-41b2-a970-6d30bf1546fa --allow-no-subscriptions
```

Open https://login.microsoftonline.com/device and enter the code shown in the terminal.

Then from the repo root:

```bash
# Preview HTML only
python3 backend/scripts/edwin_daily_usage_report.py --dry-run

# Open Outlook draft — review and click Send
python3 backend/scripts/edwin_daily_usage_report.py --outlook-draft
```

Or use the wrapper:

```bash
./run-daily-usage-report.sh --outlook-draft
```

Graph `sendMail` from `@admin.pwc.com` is not supported (mailbox not on Exchange Online). **`--outlook-draft`** uses Microsoft Outlook on your Mac and is the supported path.

## Script

`backend/scripts/edwin_daily_usage_report.py`

| Flag | Purpose |
|------|---------|
| `--dry-run` | Print HTML; do not open Outlook |
| `--outlook-draft` | Open draft in Microsoft Outlook (you click Send) |
| `--as-me` | Graph `/me/sendMail` (only if signed-in mailbox supports REST) |

Requires `az login` with Graph access to `auditLogs/signIns` for Edwin app `e16ab8c3-85e6-4437-960f-18b668ec58ff`.

## Related

- Sign-in audit queries: `docs/runbooks/allowlist-path-b-runbook.md`
- Edwin app id: `e16ab8c3-85e6-4437-960f-18b668ec58ff`
- Enterprise app SP id: `d22acabf-976f-4929-a15a-95b9202b98d6`
