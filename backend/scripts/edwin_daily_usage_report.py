#!/usr/bin/env python3
"""Build and email Edwin daily sign-in usage (today + yesterday, UTC).

On-demand report via Azure CLI + Microsoft Graph sign-in logs; send via Outlook draft.

Environment variables:
  REPORT_RECIPIENTS    Comma-separated recipient emails (optional; has defaults)
  REPORT_MAIL_SENDER   UPN for Graph sendMail (optional; admin mailbox cannot use REST)
  EDWIN_APP_ID         Entra app id for Edwin (optional)
  EDWIN_SP_ID          Enterprise app service principal id (optional)
  Auth: `az login` (e.g. bahaa.kaaki@admin.pwc.com) — see docs/runbooks/edwin-daily-usage-email.md

Usage:
  python3 backend/scripts/edwin_daily_usage_report.py --outlook-draft
  python3 backend/scripts/edwin_daily_usage_report.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import urllib.parse
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Any

GRAPH_ROOT = "https://graph.microsoft.com/v1.0"
DEFAULT_APP_ID = "e16ab8c3-85e6-4437-960f-18b668ec58ff"
DEFAULT_SP_ID = "d22acabf-976f-4929-a15a-95b9202b98d6"
DEFAULT_RECIPIENTS = (
    "bahaa.kaaki@pwc.com",
    "georges.hakme@pwc.com",
    "mohamed.moslemani@pwc.com",
    "mohammad.hariri@pwc.com",
    "youssef.moussallem@pwc.com",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def day_window(day: datetime) -> tuple[str, str, str]:
    start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return (
        start.strftime("%Y-%m-%d"),
        start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def az_rest(
    method: str,
    uri: str,
    *,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cmd = ["az", "rest", "--method", method, "--uri", uri, "-o", "json"]
    if body is not None:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(body, handle)
            body_path = handle.name
        cmd.extend(["--body", f"@{body_path}", "--headers", "Content-Type=application/json"])
    try:
        raw = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT).strip()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"az rest failed ({method}): {exc.output}") from exc
    return json.loads(raw) if raw else {}


def graph_paginate(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    uri: str | None = GRAPH_ROOT + path + "?" + urllib.parse.urlencode(params)
    while uri:
        page = az_rest("GET", uri)
        rows.extend(page.get("value", []))
        uri = page.get("@odata.nextLink")
    return rows


def aggregate_signins(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    users: dict[str, dict[str, Any]] = {}
    for item in rows:
        email = (item.get("userPrincipalName") or "").strip().lower()
        if not email:
            continue
        code = (item.get("status") or {}).get("errorCode")
        created = item.get("createdDateTime") or ""
        rec = users.setdefault(
            email,
            {
                "email": email,
                "name": item.get("userDisplayName") or "",
                "last": "",
                "ok": 0,
                "fail": 0,
            },
        )
        if created > rec["last"]:
            rec["last"] = created
            rec["name"] = item.get("userDisplayName") or rec["name"]
        if code == 0:
            rec["ok"] += 1
        else:
            rec["fail"] += 1
    return sorted(users.values(), key=lambda r: r["last"], reverse=True)


def fetch_day_signins(app_id: str, start_iso: str, end_iso: str) -> list[dict[str, Any]]:
    filt = f"appId eq '{app_id}' and createdDateTime ge {start_iso} and createdDateTime lt {end_iso}"
    return graph_paginate(
        "/auditLogs/signIns",
        {
            "$top": "1000",
            "$filter": filt,
            "$orderby": "createdDateTime desc",
            "$select": "userPrincipalName,userDisplayName,createdDateTime,status",
        },
    )


def fetch_assigned_user_count(sp_id: str) -> int:
    rows = graph_paginate(
        f"/servicePrincipals/{sp_id}/appRoleAssignedTo",
        {"$top": "999", "$select": "principalType"},
    )
    return sum(1 for row in rows if row.get("principalType") == "User")


def fetch_monthly_active(app_id: str, month_start_iso: str) -> int:
    filt = f"appId eq '{app_id}'"
    rows = graph_paginate(
        "/auditLogs/signIns",
        {
            "$top": "1000",
            "$filter": filt,
            "$orderby": "createdDateTime desc",
            "$select": "userId,createdDateTime,status",
        },
    )
    users: set[str] = set()
    for item in rows:
        if (item.get("status") or {}).get("errorCode") != 0:
            continue
        if (item.get("createdDateTime") or "") < month_start_iso:
            continue
        uid = item.get("userId")
        if uid:
            users.add(uid)
    return len(users)


def render_user_table(users: list[dict[str, Any]], label: str) -> str:
    if not users:
        return f"<h3>{escape(label)}</h3><p><em>No sign-in events in this window.</em></p>"
    rows_html = []
    for rec in users:
        rows_html.append(
            "<tr>"
            f"<td>{escape(rec['last'])}</td>"
            f"<td>{escape(rec['email'])}</td>"
            f"<td>{escape(rec['name'])}</td>"
            f"<td style=\"text-align:right\">{rec['ok']}</td>"
            f"<td style=\"text-align:right\">{rec['fail']}</td>"
            "</tr>"
        )
    return (
        f"<h3>{escape(label)} — {len(users)} unique users</h3>"
        "<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" "
        "style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px\">"
        "<thead><tr>"
        "<th>Last sign-in (UTC)</th><th>Email</th><th>Name</th>"
        "<th>OK</th><th>Fail</th>"
        "</tr></thead><tbody>"
        + "".join(rows_html)
        + "</tbody></table>"
    )


def build_html_report(
    *,
    generated_at: datetime,
    month_label: str,
    today_label: str,
    yesterday_label: str,
    today_users: list[dict[str, Any]],
    yesterday_users: list[dict[str, Any]],
    today_events: int,
    yesterday_events: int,
    assigned_users: int,
    monthly_active: int,
) -> str:
    gen = generated_at.strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.4">
  <h2>Edwin daily usage report</h2>
  <p>Generated: <strong>{escape(gen)}</strong></p>
  <ul>
    <li><strong>Assigned users (Enterprise App):</strong> {assigned_users}</li>
    <li><strong>{escape(month_label)} month-to-date active users (successful sign-in, UTC):</strong> {monthly_active}</li>
    <li><strong>Yesterday ({escape(yesterday_label)}):</strong> {len(yesterday_users)} unique / {yesterday_events} events</li>
    <li><strong>Today ({escape(today_label)}):</strong> {len(today_users)} unique / {today_events} events</li>
  </ul>
  <p>One row per email (UPN). OK/Fail counts are sign-in attempts that day.</p>
  {render_user_table(yesterday_users, f"Yesterday — {yesterday_label}")}
  <br/>
  {render_user_table(today_users, f"Today — {today_label}")}
  <p style="color:#666;font-size:11px">Source: Microsoft Graph auditLogs/signIns for Edwin app registration.</p>
</body>
</html>"""


def send_mail(
    *,
    sender: str,
    recipients: list[str],
    subject: str,
    html_body: str,
    use_me: bool = False,
) -> None:
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html_body},
            "toRecipients": [
                {"emailAddress": {"address": addr}} for addr in recipients
            ],
        },
        "saveToSentItems": True,
    }
    if use_me:
        az_rest("POST", f"{GRAPH_ROOT}/me/sendMail", body=payload)
    else:
        az_rest(
            "POST",
            f"{GRAPH_ROOT}/users/{urllib.parse.quote(sender)}/sendMail",
            body=payload,
        )


def send_outlook_draft(
    *,
    recipients: list[str],
    subject: str,
    html_body: str,
) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as handle:
        handle.write(html_body)
        html_path = handle.name
    recipient_lines = "\n".join(
        f'        make new recipient at end of to recipients with properties {{email address:{{address:"{addr}"}}}}'
        for addr in recipients
    )
    script = textwrap.dedent(
        f"""
        set htmlPath to POSIX file "{html_path}"
        set htmlBody to read htmlPath as «class utf8»
        tell application "Microsoft Outlook"
            set newMsg to make new outgoing message with properties {{subject:"{subject.replace('"', '\\"')}"}}
            tell newMsg
        {recipient_lines}
                set content to htmlBody
            end tell
            open newMsg
            activate
        end tell
        """
    )
    subprocess.run(["osascript", "-e", script], check=True)
    print(
        "Opened Outlook draft to %d recipients. Review and click Send in Outlook."
        % len(recipients)
    )


def parse_recipients(raw: str | None) -> list[str]:
    if not raw:
        raw = ",".join(DEFAULT_RECIPIENTS)
    return [part.strip().lower() for part in raw.split(",") if part.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Email Edwin daily sign-in usage report")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print HTML to stdout; do not send email",
    )
    parser.add_argument(
        "--as-me",
        action="store_true",
        help="Send via /me/sendMail (signed-in user); requires az login",
    )
    parser.add_argument(
        "--outlook-draft",
        action="store_true",
        help="Open a draft in Microsoft Outlook (local Mac); you click Send",
    )
    args = parser.parse_args()

    app_id = os.environ.get("EDWIN_APP_ID", DEFAULT_APP_ID).strip()
    sp_id = os.environ.get("EDWIN_SP_ID", DEFAULT_SP_ID).strip()
    sender = os.environ.get("REPORT_MAIL_SENDER", "").strip()
    recipients = parse_recipients(os.environ.get("REPORT_RECIPIENTS"))

    now = utc_now()
    today_label, today_start, today_end = day_window(now)
    yesterday = now - timedelta(days=1)
    yesterday_label, yesterday_start, yesterday_end = day_window(yesterday)
    _, month_start, _ = day_window(now.replace(day=1))

    today_rows = fetch_day_signins(app_id, today_start, today_end)
    yesterday_rows = fetch_day_signins(app_id, yesterday_start, yesterday_end)
    today_users = aggregate_signins(today_rows)
    yesterday_users = aggregate_signins(yesterday_rows)

    assigned_users = fetch_assigned_user_count(sp_id)
    monthly_active = fetch_monthly_active(app_id, month_start)

    month_label = now.strftime("%B %Y")

    html = build_html_report(
        generated_at=now,
        month_label=month_label,
        today_label=today_label,
        yesterday_label=yesterday_label,
        today_users=today_users,
        yesterday_users=yesterday_users,
        today_events=len(today_rows),
        yesterday_events=len(yesterday_rows),
        assigned_users=assigned_users,
        monthly_active=monthly_active,
    )

    subject = (
        f"Edwin usage — {today_label} "
        f"(today {len(today_users)}, yesterday {len(yesterday_users)})"
    )

    if args.dry_run:
        print(html)
        print(
            f"\n[dry-run] Would send to: {', '.join(recipients)} from: {sender or '(unset)'}",
            file=sys.stderr,
        )
        return 0

    if args.outlook_draft:
        send_outlook_draft(
            recipients=recipients,
            subject=subject,
            html_body=html,
        )
        return 0

    if not args.as_me and not sender:
        raise SystemExit(
            "Set REPORT_MAIL_SENDER or pass --as-me (uses signed-in az account mailbox)."
        )

    send_mail(
        sender=sender,
        recipients=recipients,
        subject=subject,
        html_body=html,
        use_me=args.as_me,
    )
    print(
        "Sent %s to %d recipients (%s)."
        % (subject, len(recipients), ", ".join(recipients))
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
