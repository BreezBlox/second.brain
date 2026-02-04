# SecondBrain Ops Deck - User Guide

This guide is for a single user setup (you).

## 1) What it does
- Shows active projects and tasks from your BBL.pkg.
- Gives a "Next Up" recommendation.
- Lets you capture notes into INBOX.md.
- Lets you toggle checkbox tasks in Drive files.

## 2) Files it reads/writes
Source folder: BBL.pkg (Google Drive)

Reads:
- PROJECT_ROADMAP.md
- tools/second_brain/task.md

Writes:
- INBOX.md (created automatically)
- Checkbox toggles in the files above

## 3) How to use it
1) Open the app: https://secondbrainv2-8e789.web.app
2) Click "Connect Google Drive" and approve access.
3) Use the left list to switch modules.
4) The Next Up card shows the first open task.
5) Click a task to mark it done (it updates the markdown file).
6) Add ideas in Inbox to save to INBOX.md.

## 4) Homescreen icon (iPhone)
After the icon update deploys:
1) Open the app in Safari.
2) Tap the Share icon.
3) Tap "Add to Home Screen".

## 5) Troubleshooting
If Next Up says "No next step":
- Make sure PROJECT_ROADMAP.md has unchecked tasks.
- Hard refresh (Ctrl+Shift+R) to clear cached JS.

If OAuth fails:
- Confirm redirect URI:
  https://second-brain-w2o4.onrender.com/auth/callback
- Confirm FRONTEND_ORIGIN:
  https://secondbrainv2-8e789.web.app

If server says Unauthorized:
- The API key is required on server API routes.
  (Handled automatically by the app.)
