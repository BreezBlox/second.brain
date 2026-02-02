PRD: Second Brain Dashboard (Local Web App)
Date: February 2, 2026
Owner: You
Priority: High

1. Summary
A locally hosted web app that sits above your file/project structure and gives a friendly, low-cognitive-load dashboard for managing active projects, capturing ideas, and tracking where you last left off. It reduces context switching overhead across devices synced via Google Drive.

2. Problem Statement
- You work across a laptop and desktop and use Google Drive for sync.
- Project sprawl and outdated folders create overwhelm.
- Standard IDE file trees and long markdown lists are visually noisy.
- ADHD-driven context loss makes it easy to forget next steps when switching projects.

3. Goals
- Provide a visual, non-IDE dashboard to see all projects at a glance.
- Make it fast to answer: "What is active?" and "What is my next step?"
- Reduce time and cognitive load when switching between projects/devices.
- Support capture of ideas and convert them into tasks, habits, or notes.

4. Non-goals (v1)
- Replacing the IDE.
- Full knowledge management system like Notion.
- Multi-user or cloud-hosted collaboration.

5. Primary User
- You: technically capable, rapid prototyper, uses agentic IDEs, prefers visual clarity over dense file trees.

6. Core User Stories
- As a user, I want to see my active projects without opening my IDE.
- As a user, I want each project to show where I last left off and the immediate next action.
- As a user, I want to archive or flag obsolete projects without deleting them.
- As a user, I want to capture stray thoughts and turn them into tasks or notes.

7. MVP Requirements
7.1 Interface (v1 must-have)
- Launch locally (script/batch -> local web server -> browser).
- Dashboard with horizontal or card-based layout. No vertical file tree.
- Responsive for desktop and laptop screens.

7.2 Projects (v1 must-have)
- Project list with status: Active, Paused, Obsolete.
- Each project shows:
  - Summary
  - Last left off
  - Next action
  - Last updated timestamp
- Tagging and filtering.

7.3 Tasks and Milestones (Phase 1.1)
- Per-project milestones and task lists.
- Simple completion tracking.

7.4 Idea Capture (v1 must-have)
- Global inbox for quick thought capture.
- Ability to assign inbox items to a project or convert to task/habit/note.

7.5 Storage and Sync
- Local data stored in a simple, portable format (JSON or Markdown).
- Data survives across devices via Google Drive sync.
- Default data folder: Second.Brain/data/ within Google Drive (configurable).

7.6 File Access (v1 must-have)
- Must be able to write files (notes, metadata) into project folders or a dedicated data folder.

8. UX Principles
- Low visual clutter.
- Fast scanning and context retrieval.
- Minimal vertical navigation.
- Emphasis on "what matters now."

9. Platform Constraints
- Windows first.
- Phone access is a nice-to-have and can be explored later.

10. Phase 2 (Future, post-v1)
- NotebookLM / Notion import for historical context.
- Automated detection of inactive projects based on file activity.
- "Cookbook" / BBL package integration for persistent prompts and guidance.
- Timeline view of activity and notes.
- Mobile-friendly view if feasible.

11. Success Metrics
- Reduced time to resume work on any project.
- Clear identification of obsolete projects within one session.
- Increased follow-through on ideas captured in the inbox.

12. Open Questions (Current Answers + Remaining)
- OS targets: Windows for now. Phone access later if feasible.
- Project structure: No preferred structure yet; keep detection flexible.
- Storage location: Open to embedding metadata inside each project, but needs guidance on options.
- "Last left off": Undecided; needs guidance on manual vs automated options.
- File access: Must support writing files (not read-only scans).
- Remaining: Preferred level of automation for project discovery (manual list vs folder scan)?
- Answered: Global data will live in a single data folder (central index).

Appendix A: Storage Location Options (Embedded vs Single Data Folder)
A1. Embedded per project
- What it is: Each project gets a small metadata file (e.g., .secondbrain.json or .secondbrain.md) inside the project folder.
- Pros: Portable with the project, easy to sync, easy to understand, no central database.
- Cons: Requires writing into each project folder, more files to scan.
- Best for: Flexibility when projects move or live in different places.

A2. Single data folder (central index) — MVP choice
- What it is: One data folder (e.g., Second.Brain/data/) stores metadata for all projects, keyed by project path.
- Pros: All data in one place, easier backup, faster global operations.
- Cons: Breaks if project paths change; requires a stable project root; harder to share single projects.
- Best for: Large dashboards where most projects live under one root folder.

A3. Hybrid (central index + per-project cache)
- What it is: Central index plus a lightweight per-project file for quick context.
- Pros: Resilient to moves, supports fast global search.
- Cons: More complexity, must keep in sync.
- Best for: Later phase if automation needs grow.

Appendix B: Initial Data Schema (Single Data Folder)
Folder: Second.Brain/data/

B1. projects.json (v1 must-have)
- One record per project.
- Fields (v1):
  - id (string, unique)
  - name (string)
  - path (string, absolute or drive-relative)
  - status (enum: active | paused | obsolete)
  - summary (string)
  - last_left_off (string)
  - next_action (string)
  - tags (string[])
  - last_updated_at (ISO 8601 string)

B2. inbox.json (v1 must-have)
- Unsorted capture bucket.
- Fields (v1):
  - id (string, unique)
  - text (string)
  - created_at (ISO 8601 string)
  - linked_project_id (string, optional)
  - converted_to (enum: task | habit | note | idea | null)

B3. tasks.json (Phase 1.1)
- Tasks linked to projects and milestones.
- Fields (v1):
  - id (string, unique)
  - project_id (string)
  - title (string)
  - status (enum: todo | doing | done)
  - milestone (string, optional)
  - due_date (ISO 8601 string, optional)
  - created_at (ISO 8601 string)
  - updated_at (ISO 8601 string)

B4. habits.json (Phase 1.1 or later)
- If included, minimal tracking.
- Fields (v1):
  - id (string, unique)
  - name (string)
  - cadence (string, e.g., daily/weekly)
  - status (enum: active | paused)
  - last_completed_at (ISO 8601 string, optional)

Appendix C: v1 Launch Checklist
- Local server starts from a script/batch file.
- Dashboard loads in browser with card/horizontal layout.
- Projects list displays status, summary, last left off, next action, and last updated.
- Global inbox capture works and writes to inbox.json.
- Data persists in Second.Brain/data/ and syncs via Google Drive.
