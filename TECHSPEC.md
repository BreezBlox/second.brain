Second Brain Dashboard - v1 Technical Spec (Draft)
Date: February 2, 2026

1. Scope
- Build a local-first Windows web app that reads/writes project metadata to a single data folder.
- v1 must-haves: interface, projects, inbox capture, file writing.
- Phase 1.1: tasks/milestones and habits.

2. Recommended Tech Stack (Windows-first, simple)
- Runtime: Node.js LTS (local-only).
- Server: Express for a small REST API.
- UI: Vite + React with simple cards layout.
- Storage: JSON files in `Second.Brain/data/`.

3. Folder Layout (proposed)
- Second.Brain/
  - app/
    - server/
    - web/
  - data/
    - projects.json
    - inbox.json
  - scripts/
    - start.bat

4. Data Model (v1)
- projects.json
  - [{ id, name, path, status, summary, last_left_off, next_action, tags, last_updated_at }]
- inbox.json
  - [{ id, text, created_at, linked_project_id, converted_to }]

5. API Surface (v1)
- GET /api/projects
- POST /api/projects
- PUT /api/projects/:id
- GET /api/inbox
- POST /api/inbox
- PUT /api/inbox/:id

6. UI Views (v1)
- Dashboard (projects grid, filters, quick edit for last left off / next action)
- Inbox panel (quick add, assign to project)

7. File Writing Rules
- All writes go to `Second.Brain/data/` in JSON files.
- Safe writes: read-modify-write with simple file locking (or write-temp + rename).
- Timestamp updates on project edits.

8. Local Launch
- `scripts/start.bat` launches server and opens browser to localhost.
- No external network dependency.

9. Phase 1.1
- Tasks view + tasks.json
- Habits view + habits.json

10. Open Decisions
- Path format: drive-relative (chosen).
