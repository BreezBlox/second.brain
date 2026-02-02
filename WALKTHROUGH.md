# SecondBrain v2 – Drive OAuth Walkthrough

This is the step‑by‑step guide for anything you must do on your end.
If I can’t do a step for you, it will be listed here.

---

## What “Deploy the Server” Means (Plain English)

The web app is just the UI. It can’t safely talk to Google Drive by itself.
The **server** is a small backend that:
- handles OAuth with Google
- reads/writes your Drive files

**Deploying the server** means putting that backend on a public host
(Render/Fly/Cloud Run/etc.) so your hosted web app can reach it.
If the server isn’t deployed, the app only works while your computer is on
and the server is running locally.

---

## One‑time Google Cloud Setup (Required)

1) Open **Google Cloud Console**
2) Select your existing project
3) Go to **APIs & Services → Library**
4) Enable **Google Drive API**

5) Go to **APIs & Services → OAuth consent screen**
   - Choose **External** (unless you have a Workspace org)
   - Fill App Name + Support Email
   - Add your email as a **Test User** (required for external apps)

6) Go to **APIs & Services → Credentials**
7) Click **Create Credentials → OAuth client ID**
8) Choose **Web application**
9) Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (local dev)
   - `https://YOUR-FRONTEND-DOMAIN` (your hosted frontend URL)

10) Add **Authorized redirect URIs**:
   - `http://localhost:3001/auth/callback` (local server)
   - `https://YOUR-SERVER-DOMAIN/auth/callback` (deployed server)

11) Save and copy **Client ID** + **Client Secret**

---

## Get Your BBL Folder ID (Optional but Recommended)

If Google Drive has more than one `BBL.pkg`, we need the exact folder ID.

1) Open the BBL folder in Google Drive
2) Copy the URL
3) The folder ID is the long string after `/folders/`

Example:
`https://drive.google.com/drive/folders/THIS_IS_THE_ID`

---

## Local Dev Setup (Server + Web)

### 1) Create server env file

Copy `app/server/.env.example` → `app/server/.env`
Fill it like this:

```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/callback
FRONTEND_ORIGIN=http://localhost:5173
BBL_FOLDER_NAME=BBL.pkg
BBL_FOLDER_ID=OPTIONAL_FOLDER_ID
API_KEY=OPTIONAL_SECRET_KEY
```

### 2) Create web env file

Edit `app/web/.env.local` and add:

```
VITE_API_BASE=http://localhost:3001
VITE_API_KEY=OPTIONAL_SECRET_KEY
```

### 3) Run the server

From `app/server`:
```
npm start
```

### 4) Run the web app

From `app/web`:
```
npm run dev
```

### 5) Connect Google Drive

1) Open the web app in your browser
2) Click **Connect Google Drive**
3) Approve access
4) The dashboard should populate from BBL.pkg

---

## Production Setup (Hosted)

You must deploy the server somewhere public so the hosted UI can reach it.
Choices: Render, Fly.io, Cloud Run, Railway.

Required env vars on the host:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (must match your deployed domain)
- `FRONTEND_ORIGIN` (your Firebase Hosting URL)
- `BBL_FOLDER_NAME` or `BBL_FOLDER_ID`
- `API_KEY` (optional)

Then update your web app env:
- `VITE_API_BASE=https://YOUR-SERVER-DOMAIN`

---

## Quick Deploy Path (Render Example)

If you want the fastest setup without learning a new CLI:

1) Create a Render account  
2) New → **Web Service**  
3) Connect the GitHub repo for `secondbrain.v2`  
4) Set **Root Directory** to `app/server`  
5) Build Command: `npm install`  
6) Start Command: `node index.js`  
7) Add env vars from the **Production Setup** section  
8) Deploy

Once deployed, copy the public URL and set:
`VITE_API_BASE=https://YOUR-RENDER-URL`

---

---

## Visual Overview (Data Flow)

[Web App] → calls → [Server] → reads/writes → [Google Drive]

The server is the bridge. The UI never talks directly to Drive.

---

## About “Task Toggles” (What It Means)

You’ll see tasks with checkboxes in the UI.
Clicking a task will update the checkbox directly in the markdown file on Drive.

Examples:
- `PROJECT_ROADMAP.md` (active project tasks)
- `tools/second_brain/task.md` (implementation checklist)

We can choose which file(s) should be toggle‑enabled.

---

If you want anything added to this walkthrough, say the word.
