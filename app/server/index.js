import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { google } from "googleapis";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const apiKey = process.env.API_KEY || "";
const bblFolderName = process.env.BBL_FOLDER_NAME || "BBL.pkg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const dataDir = path.join(rootDir, "data");
const tokensFile = path.join(dataDir, "drive_tokens.json");
const configFile = path.join(dataDir, "drive_config.json");

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", frontendOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  if (apiKey && req.path.startsWith("/api")) {
    const provided = req.get("x-api-key") || "";
    if (provided !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
});

function oauthConfigured() {
  return (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function loadTokens() {
  return readJson(tokensFile, null);
}

async function saveTokens(tokens) {
  await writeJson(tokensFile, tokens);
}

async function getDriveClient() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    saveTokens(merged).catch(() => undefined);
  });
  try {
    await oauth2Client.getAccessToken();
  } catch {
    return null;
  }
  return google.drive({ version: "v3", auth: oauth2Client });
}

function escapeQuery(value) {
  return value.replace(/'/g, "\\'");
}

async function listAllFiles(drive, query, fields) {
  const results = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: query,
      fields: fields || "nextPageToken, files(id, name, mimeType, modifiedTime)",
      pageToken,
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    results.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return results;
}

async function findChildByName(drive, folderId, name, mimeType = null) {
  const conditions = [
    `name = '${escapeQuery(name)}'`,
    `"${folderId}" in parents`,
    "trashed = false",
  ];
  if (mimeType) {
    conditions.push(`mimeType = '${mimeType}'`);
  }
  const files = await listAllFiles(drive, conditions.join(" and "));
  return files[0] || null;
}

async function resolveBblFolder(drive) {
  if (process.env.BBL_FOLDER_ID) {
    try {
      const res = await drive.files.get({
        fileId: process.env.BBL_FOLDER_ID,
        fields: "id, name",
        supportsAllDrives: true,
      });
      return { id: res.data.id, name: res.data.name };
    } catch {
      throw new Error("BBL_FOLDER_ID is set but cannot be accessed.");
    }
  }

  const config = (await readJson(configFile, {})) || {};
  if (config.bblFolderId) {
    try {
      const res = await drive.files.get({
        fileId: config.bblFolderId,
        fields: "id, name",
        supportsAllDrives: true,
      });
      return { id: res.data.id, name: res.data.name };
    } catch {
      config.bblFolderId = null;
      await writeJson(configFile, config);
    }
  }

  const query = [
    `name = '${escapeQuery(bblFolderName)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ].join(" and ");
  const matches = await listAllFiles(drive, query, "files(id, name, modifiedTime)");
  if (matches.length === 1) {
    const match = matches[0];
    await writeJson(configFile, { bblFolderId: match.id });
    return { id: match.id, name: match.name };
  }
  if (matches.length === 0) {
    throw new Error(`Could not find Drive folder named ${bblFolderName}.`);
  }
  throw new Error(
    `Multiple folders named ${bblFolderName} found. Provide BBL_FOLDER_ID.`
  );
}

async function readFileText(drive, fileId) {
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(response.data).toString("utf8");
}

async function writeFileText(drive, fileId, content) {
  await drive.files.update({
    fileId,
    media: {
      mimeType: "text/markdown",
      body: content,
    },
    supportsAllDrives: true,
  });
}

async function ensureInboxFile(drive, folderId) {
  const existing = await findChildByName(drive, folderId, "INBOX.md");
  if (existing) return existing;
  const response = await drive.files.create({
    requestBody: {
      name: "INBOX.md",
      mimeType: "text/markdown",
      parents: [folderId],
    },
    media: {
      mimeType: "text/markdown",
      body: "# Inbox\n\n",
    },
    fields: "id, name",
    supportsAllDrives: true,
  });
  return response.data;
}

function parseCheckbox(line, lineNumber) {
  const match = line.match(/^\s*-\s*\[(x| |\/)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    text: match[2].trim(),
    done: match[1].toLowerCase() === "x",
    lineNumber,
  };
}

function parseRoadmap(text) {
  const lines = text.split(/\r?\n/);
  let lastUpdated = "";
  let status = "";
  let section = "";
  const currentSprint = [];
  const activeProjects = [];
  let currentProject = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("**Last Updated**")) {
      const match = trimmed.match(/\*\*Last Updated\*\*:\s*(.+)/i);
      if (match) lastUpdated = match[1].trim();
    }
    if (trimmed.startsWith("**Status**")) {
      const match = trimmed.match(/\*\*Status\*\*:\s*(.+)/i);
      if (match) status = match[1].trim();
    }
    if (trimmed.startsWith("## ")) {
      section = trimmed.replace(/^##\s+/, "");
      if (section !== "Quin Projects (Active)") {
        currentProject = null;
      }
      continue;
    }
    if (section === "Current Sprint Focus") {
      if (trimmed && !trimmed.startsWith("#")) {
        const cleaned = trimmed
          .replace(/^[-*]\s*/, "")
          .replace(/\*\*/g, "")
          .trim();
        if (cleaned) {
          currentSprint.push(cleaned);
        }
      }
      continue;
    }
    if (section === "Quin Projects (Active)") {
      if (trimmed.startsWith("### ")) {
        if (currentProject) {
          activeProjects.push(currentProject);
        }
        currentProject = {
          name: trimmed.replace(/^###\s+/, "").trim(),
          tasks: [],
        };
        continue;
      }
      if (currentProject) {
        const task = parseCheckbox(trimmed, index);
        if (task) {
          currentProject.tasks.push(task);
        }
      }
    }
  }
  if (currentProject) {
    activeProjects.push(currentProject);
  }
  return { lastUpdated, status, currentSprint, activeProjects };
}

function parseInbox(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (const line of lines) {
    const match = line.match(/^\s*-\s*(?:\[(\d{4}-\d{2}-\d{2})\]\s*)?(.+)$/);
    if (match && match[2]) {
      items.push({
        id: crypto.randomUUID(),
        text: match[2].trim(),
        date: match[1] || "",
      });
    }
  }
  return items;
}

function parseTaskFile(text) {
  const lines = text.split(/\r?\n/);
  const tasks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const task = parseCheckbox(trimmed, index);
    if (task) {
      tasks.push(task);
    }
  }
  return tasks;
}

async function findByPath(drive, rootId, segments) {
  let parentId = rootId;
  let current = null;
  for (let i = 0; i < segments.length; i += 1) {
    const isLast = i === segments.length - 1;
    const targetName = segments[i];
    const mimeType = isLast ? null : "application/vnd.google-apps.folder";
    current = await findChildByName(drive, parentId, targetName, mimeType);
    if (!current) return null;
    parentId = current.id;
  }
  return current;
}

function buildProjects(activeProjects) {
  return activeProjects.map((project) => {
    const total = project.tasks.length;
    const done = project.tasks.filter((task) => task.done).length;
    const progress = total ? Math.round((done / total) * 100) : 0;
    const nextTask = project.tasks.find((task) => !task.done);
    return {
      id: project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: project.name.replace(/\s+/g, "_").toUpperCase(),
      status: total === done ? "COMPLETE" : "IN_PROGRESS",
      progress,
      crew: total,
      urgent: total - done,
      client: "BBL.PKG",
      focus: nextTask ? nextTask.text.slice(0, 36).toUpperCase() : "MAINTAIN",
      tasks: project.tasks,
    };
  });
}

function toggleCheckboxLine(line) {
  const match = line.match(/^(\s*-\s*\[)(x| |\/)(\]\s*)(.*)$/i);
  if (!match) return null;
  const next = match[2].toLowerCase() === "x" ? " " : "x";
  return `${match[1]}${next}${match[3]}${match[4]}`;
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

app.get("/auth/google", (req, res) => {
  if (!oauthConfigured()) {
    return res.status(500).send("OAuth env vars missing.");
  }
  const oauth2Client = buildOAuthClient();
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax" });
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
    include_granted_scopes: true,
    prompt: "consent",
    state,
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  if (!oauthConfigured()) {
    return res.status(500).send("OAuth env vars missing.");
  }
  const { code, state } = req.query;
  if (!code || typeof code !== "string") {
    return res.status(400).send("Missing code.");
  }
  const cookieState = req.cookies.oauth_state;
  if (!cookieState || cookieState !== state) {
    return res.status(400).send("Invalid state.");
  }
  try {
    const oauth2Client = buildOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(tokens);
    res.clearCookie("oauth_state");
    res.redirect(frontendOrigin);
  } catch (error) {
    res.status(500).send("OAuth exchange failed.");
  }
});

app.post("/auth/logout", async (req, res) => {
  await fs.rm(tokensFile, { force: true });
  res.json({ ok: true });
});

app.get("/api/drive/status", async (req, res) => {
  if (!oauthConfigured()) {
    return res.json({ authorized: false, error: "OAuth env vars missing." });
  }
  const drive = await getDriveClient();
  if (!drive) {
    return res.json({ authorized: false });
  }
  try {
    const folder = await resolveBblFolder(drive);
    res.json({ authorized: true, folder });
  } catch (error) {
    res.json({ authorized: true, folder: null, error: error.message });
  }
});

app.get("/api/drive/folders", async (req, res) => {
  const drive = await getDriveClient();
  if (!drive) {
    return res.status(401).json({ error: "Not authorized" });
  }
  const name = req.query.name || bblFolderName;
  const query = [
    `name = '${escapeQuery(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ].join(" and ");
  const matches = await listAllFiles(drive, query, "files(id, name, modifiedTime)");
  res.json({ folders: matches });
});

app.post("/api/drive/config", async (req, res) => {
  const { bblFolderId } = req.body || {};
  if (!bblFolderId) {
    return res.status(400).json({ error: "Missing bblFolderId" });
  }
  await writeJson(configFile, { bblFolderId });
  res.json({ ok: true });
});

app.get("/api/bbl/summary", async (req, res) => {
  const drive = await getDriveClient();
  if (!drive) {
    return res.status(401).json({ error: "Not authorized" });
  }
  try {
    const folder = await resolveBblFolder(drive);
    const roadmapFile = await findChildByName(drive, folder.id, "PROJECT_ROADMAP.md");
    let roadmap = { lastUpdated: "", status: "", currentSprint: [], activeProjects: [] };
    if (roadmapFile) {
      const roadmapText = await readFileText(drive, roadmapFile.id);
      roadmap = parseRoadmap(roadmapText);
    }
    const projects = buildProjects(roadmap.activeProjects);
    const tasks = [];
    if (roadmapFile) {
      for (const project of roadmap.activeProjects) {
        for (const task of project.tasks) {
          tasks.push({
            id: `${roadmapFile.id}:${task.lineNumber}`,
            text: task.text,
            done: task.done,
            fileId: roadmapFile.id,
            lineNumber: task.lineNumber,
            source: project.name,
          });
        }
      }
    }

    const secondBrainTaskFile = await findByPath(drive, folder.id, [
      "tools",
      "second_brain",
      "task.md",
    ]);
    if (secondBrainTaskFile) {
      const taskText = await readFileText(drive, secondBrainTaskFile.id);
      const secondTasks = parseTaskFile(taskText);
      for (const task of secondTasks) {
        tasks.push({
          id: `${secondBrainTaskFile.id}:${task.lineNumber}`,
          text: task.text,
          done: task.done,
          fileId: secondBrainTaskFile.id,
          lineNumber: task.lineNumber,
          source: "Second Brain",
        });
      }
    }

    let ingredients = [];
    const ingredientsFolder = await findChildByName(
      drive,
      folder.id,
      "ingredients",
      "application/vnd.google-apps.folder"
    );
    if (ingredientsFolder) {
      const files = await listAllFiles(
        drive,
        `"${ingredientsFolder.id}" in parents and trashed = false`
      );
      ingredients = files
        .filter((file) => file.name && file.name.toLowerCase().endsWith(".md"))
        .map((file) => ({
          id: file.id,
          name: file.name,
          title: file.name
            .replace(/^\d+_?/, "")
            .replace(/\.md$/i, "")
            .replace(/_/g, " ")
            .trim(),
        }));
    }

    const inboxFile = await ensureInboxFile(drive, folder.id);
    const inboxText = await readFileText(drive, inboxFile.id);
    const inbox = parseInbox(inboxText);

    const signalFeed = [];
    if (roadmap.status) {
      signalFeed.push(`STATUS: ${roadmap.status}`);
    }
    if (roadmap.lastUpdated) {
      signalFeed.push(`ROADMAP UPDATED: ${roadmap.lastUpdated}`);
    }
    signalFeed.push(`INGREDIENTS: ${ingredients.length}`);
    signalFeed.push(`ACTIVE MODULES: ${projects.length}`);

    let nextUp = null;
    if (roadmapFile) {
      const firstOpen = tasks.find((task) => !task.done);
      if (firstOpen) {
        nextUp = {
          title: firstOpen.text,
          source: firstOpen.source || "Roadmap",
          fileId: firstOpen.fileId,
          lineNumber: firstOpen.lineNumber,
          done: firstOpen.done,
        };
      }
    }
    if (!nextUp && secondBrainTaskFile) {
      const secondText = await readFileText(drive, secondBrainTaskFile.id);
      const secondTasks = parseTaskFile(secondText);
      const openSecond = secondTasks.find((task) => !task.done);
      if (openSecond) {
        nextUp = {
          title: openSecond.text,
          source: "Second Brain",
          fileId: secondBrainTaskFile.id,
          lineNumber: openSecond.lineNumber,
          done: openSecond.done,
        };
      }
    }
    if (!nextUp && roadmap.currentSprint.length) {
      nextUp = {
        title: roadmap.currentSprint[0],
        source: "Current Sprint",
      };
    }
    if (!nextUp && inbox.length) {
      const latest = inbox[inbox.length - 1];
      nextUp = {
        title: latest.text,
        source: "Inbox",
      };
    }

    res.json({
      folder,
      roadmap,
      projects,
      currentSprint: roadmap.currentSprint,
      tasks,
      nextUp,
      ingredients,
      inbox,
      signalFeed,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/bbl/inbox", async (req, res) => {
  const drive = await getDriveClient();
  if (!drive) {
    return res.status(401).json({ error: "Not authorized" });
  }
  try {
    const folder = await resolveBblFolder(drive);
    const inboxFile = await ensureInboxFile(drive, folder.id);
    const inboxText = await readFileText(drive, inboxFile.id);
    res.json({ inbox: parseInbox(inboxText) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/bbl/inbox", async (req, res) => {
  const drive = await getDriveClient();
  if (!drive) {
    return res.status(401).json({ error: "Not authorized" });
  }
  const text = (req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }
  try {
    const folder = await resolveBblFolder(drive);
    const inboxFile = await ensureInboxFile(drive, folder.id);
    const inboxText = await readFileText(drive, inboxFile.id);
    const stamp = new Date().toISOString().slice(0, 10);
    const nextLine = `- [${stamp}] ${text}`;
    const nextContent = inboxText.trim()
      ? `${inboxText.trim()}\n${nextLine}\n`
      : `# Inbox\n\n${nextLine}\n`;
    await writeFileText(drive, inboxFile.id, nextContent);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/bbl/tasks/toggle", async (req, res) => {
  const drive = await getDriveClient();
  if (!drive) {
    return res.status(401).json({ error: "Not authorized" });
  }
  const { fileId, lineNumber } = req.body || {};
  if (!fileId || lineNumber === undefined) {
    return res.status(400).json({ error: "Missing fileId or lineNumber" });
  }
  const index = Number(lineNumber);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: "Invalid lineNumber" });
  }
  try {
    const text = await readFileText(drive, fileId);
    const lines = text.split(/\r?\n/);
    if (index >= lines.length) {
      return res.status(400).json({ error: "lineNumber out of range" });
    }
    const updatedLine = toggleCheckboxLine(lines[index]);
    if (!updatedLine) {
      return res.status(400).json({ error: "Line is not a checkbox task" });
    }
    lines[index] = updatedLine;
    await writeFileText(drive, fileId, lines.join("\n"));
    res.json({ ok: true, done: updatedLine.includes("[x]") });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
