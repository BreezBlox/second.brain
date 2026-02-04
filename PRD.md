# SecondBrain Ops Deck - PRD (v2)
Date: 2026-02-04
Owner: Rob
Status: Active

## Summary
SecondBrain Ops Deck is a single-user dashboard that reads and writes live files in a Google Drive
folder (BBL.pkg). It provides a visual command center for active projects, next steps, and capture.

## Problem
- Context lives in markdown files and folders, but is scattered.
- The IDE is too dense for daily planning and fast context switching.
- A "next action" should be visible without hunting through files.

## Goals
- Show active projects and their tasks from BBL.pkg.
- Provide an intuitive "Next Up" recommendation.
- Allow quick capture into INBOX.md.
- Allow checkbox toggling directly in Drive files.
- Keep setup simple for a single user.

## Non-goals
- Multi-user collaboration.
- Replacing the IDE.
- Full knowledge management like Notion.

## Target User
Single operator (you). Prefers visual clarity, speed, and low friction.

## Core Features (v2)
1) Drive OAuth (read/write) to BBL.pkg
2) Active Modules list (from PROJECT_ROADMAP.md)
3) Next Up guidance (first open task)
4) Inbox capture (INBOX.md)
5) Task toggles (updates checkbox in Drive files)

## Source of Truth
Google Drive folder: BBL.pkg
Key files:
- PROJECT_ROADMAP.md
- tools/second_brain/task.md
- INBOX.md (auto-created if missing)

## Architecture
Frontend:
- Vite + React (Firebase Hosting)
Backend:
- Node + Express on Render
- Google Drive API OAuth

## Security
- OAuth scopes: Drive read/write
- API key required for /api routes
- CORS locked to frontend origin

## Success Metrics
- "Next Up" visible within 3 seconds of load
- Task toggle updates Drive file within 5 seconds
- Inbox capture saved with no errors

## Open Questions
- Should we expand to parse more files beyond roadmap and task.md?
- Do we want a timeline or focus log?
