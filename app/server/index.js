import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const dataDir = path.join(rootDir, "data");
const backupsDir = path.join(dataDir, ".backups");
const projectsFile = path.join(dataDir, "projects.json");
const inboxFile = path.join(dataDir, "inbox.json");

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

async function ensureDataFile(filePath) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

async function readJson(filePath) {
  await ensureDataFile(filePath);
  const raw = await fs.readFile(filePath, "utf8");
  if (!raw.trim()) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJson(filePath, data) {
  await ensureDataFile(filePath);
  await fs.mkdir(backupsDir, { recursive: true });
  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");
    const base = path.basename(filePath);
    const backupPath = path.join(
      backupsDir,
      `${base}.${timestamp}.bak`
    );
    await fs.copyFile(filePath, backupPath);
    const backups = (await fs.readdir(backupsDir))
      .filter((name) => name.startsWith(`${base}.`) && name.endsWith(".bak"))
      .sort()
      .reverse();
    const toDelete = backups.slice(3);
    await Promise.all(
      toDelete.map((name) => fs.unlink(path.join(backupsDir, name)))
    );
  } catch {
    // Backup failures should not block saving.
  }
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

app.get("/", (req, res) => {
  res.type("html").send(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Second Brain Server</title>
  </head>
  <body>
    <h1>Second Brain Server is running</h1>
    <p>API health: <a href="/api/health">/api/health</a></p>
  </body>
</html>`
  );
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/projects", async (req, res) => {
  const projects = await readJson(projectsFile);
  res.json(projects);
});

app.post("/api/projects", async (req, res) => {
  const projects = await readJson(projectsFile);
  const now = new Date().toISOString();
  const payload = req.body || {};
  const project = {
    id: crypto.randomUUID(),
    name: payload.name || "Untitled",
    path: payload.path || "",
    status: payload.status || "active",
    summary: payload.summary || "",
    last_left_off: payload.last_left_off || "",
    next_action: payload.next_action || "",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    parent_id: payload.parent_id || null,
    last_updated_at: now,
  };
  projects.push(project);
  await writeJson(projectsFile, projects);
  res.status(201).json(project);
});

app.put("/api/projects/:id", async (req, res) => {
  const projects = await readJson(projectsFile);
  const index = projects.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }
  const allowed = [
    "name",
    "path",
    "status",
    "summary",
    "last_left_off",
    "next_action",
    "tags",
    "parent_id",
  ];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) {
      updates[key] = req.body[key];
    }
  }
  if (updates.tags && !Array.isArray(updates.tags)) {
    updates.tags = [];
  }
  if (updates.parent_id === "") {
    updates.parent_id = null;
  }
  const updated = {
    ...projects[index],
    ...updates,
    last_updated_at: new Date().toISOString(),
  };
  projects[index] = updated;
  await writeJson(projectsFile, projects);
  res.json(updated);
});

app.delete("/api/projects/:id", async (req, res) => {
  const projects = await readJson(projectsFile);
  const index = projects.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }
  const removed = projects[index];
  projects.splice(index, 1);
  const now = new Date().toISOString();
  for (const project of projects) {
    if (project.parent_id === removed.id) {
      project.parent_id = null;
      project.last_updated_at = now;
    }
  }
  await writeJson(projectsFile, projects);
  res.json({ ok: true });
});

app.get("/api/inbox", async (req, res) => {
  const inbox = await readJson(inboxFile);
  res.json(inbox);
});

app.post("/api/inbox", async (req, res) => {
  const inbox = await readJson(inboxFile);
  const payload = req.body || {};
  const item = {
    id: crypto.randomUUID(),
    text: payload.text || "",
    created_at: new Date().toISOString(),
    linked_project_id: payload.linked_project_id || null,
    converted_to: payload.converted_to || null,
  };
  inbox.push(item);
  await writeJson(inboxFile, inbox);
  res.status(201).json(item);
});

app.put("/api/inbox/:id", async (req, res) => {
  const inbox = await readJson(inboxFile);
  const index = inbox.findIndex((i) => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Inbox item not found" });
  }
  const allowed = ["text", "linked_project_id", "converted_to"];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) {
      updates[key] = req.body[key];
    }
  }
  const updated = {
    ...inbox[index],
    ...updates,
  };
  inbox[index] = updated;
  await writeJson(inboxFile, inbox);
  res.json(updated);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
