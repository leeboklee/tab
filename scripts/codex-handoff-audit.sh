#!/bin/bash
# Codex → Cursor handoff audit (see codex-cursor-handoff-playbook.md §5~§7)
set -euo pipefail

PROJECT="${1:-$(pwd)}"
SESSION_ID="${2:-}"

echo "=== codex handoff audit ==="
echo "project: $PROJECT"

python3 <<PY
import glob, json, os, re, sys
from pathlib import Path

project = os.path.abspath("$PROJECT")
session_filter = "$SESSION_ID".strip()

sessions = sorted(
    glob.glob(os.path.expanduser("~/.codex/sessions/**/rollout-*.jsonl"), recursive=True),
    key=os.path.getmtime,
    reverse=True,
)

matches = []
for path in sessions:
    try:
        with open(path) as f:
            meta = json.loads(f.readline())
        if meta.get("type") != "session_meta":
            continue
        payload = meta.get("payload") or {}
        cwd = payload.get("cwd", "")
        sid = payload.get("id", "")
        if project not in cwd:
            continue
        if session_filter and not sid.startswith(session_filter):
            continue
        matches.append((path, sid, cwd, os.path.getsize(path)))
    except Exception:
        pass

if not matches:
    print("NO SESSION for", project)
    sys.exit(1)

path, sid, cwd, size = matches[0]
print(f"session: {sid}")
print(f"jsonl:   {path}")
print(f"cwd:     {cwd}")
print(f"size:    {size/1024:.0f}KB")

patches = []
goals = []
last_complete = None
with open(path) as f:
    for line in f:
        o = json.loads(line)
        t = o.get("type")
        if t == "response_item":
            p = o.get("payload") or {}
            if p.get("type") == "custom_tool_call" and p.get("name") == "apply_patch":
                inp = p.get("input") or ""
                for m in re.finditer(r"\*\*\* (Add|Update) File: ([^\n]+)", inp):
                    patches.append((m.group(1), m.group(2).strip()))
            elif p.get("type") == "message" and p.get("role") == "user":
                for c in p.get("content") or []:
                    txt = c.get("text") or ""
                    if "<objective>" in txt:
                        m = re.search(r"<objective>\s*(.*?)\s*</objective>", txt, re.S)
                        if m:
                            goals.append(m.group(1).strip()[:200])
        elif t == "event_msg":
            p = o.get("payload") or {}
            if p.get("type") == "task_complete" and p.get("last_agent_message"):
                last_complete = p["last_agent_message"]

print(f"\npatch count: {len(patches)}")
for op, fp in patches:
    rel = fp.replace(project + "/", "").replace(project, ".")
    exists = Path(fp).exists()
    print(f"  {'OK' if exists else 'MISSING'} {op} {rel}")

if goals:
    print("\ngoals/objectives:")
    for g in goals[:3]:
        print(" -", g)

if last_complete:
    print("\nlast task_complete excerpt:")
    print(last_complete[:1500])
PY

echo
echo "=== git status ==="
git -C "$PROJECT" status --short
echo
git -C "$PROJECT" diff --stat HEAD 2>/dev/null || true
