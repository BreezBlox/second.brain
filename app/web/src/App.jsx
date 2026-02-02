import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { auth, db, provider } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

const sampleProjects = [
  {
    id: "CAPTURE",
    name: "CAPTURE_PIPELINE",
    progress: 64,
    status: "INBOX CLEAR + ORGANIZE",
    crew: 12,
    urgent: 2,
    client: "SECOND_BRAIN",
    focus: "Triage + Tag",
  },
  {
    id: "SYNTH",
    name: "SYNTHESIS_LAB",
    progress: 41,
    status: "RESEARCH BUILD",
    crew: 7,
    urgent: 4,
    client: "KNOWLEDGE OPS",
    focus: "Deep Work Blocks",
  },
  {
    id: "PUBLISH",
    name: "PUBLISH_STACK",
    progress: 22,
    status: "DRAFTING",
    crew: 3,
    urgent: 1,
    client: "AUDIENCE",
    focus: "Output Pipeline",
  },
];

const habits = [
  { label: "INBOX_ZERO", done: true },
  { label: "DEEP_WORK_BLOCK", done: false },
  { label: "MOVE / TRAIN", done: true },
  { label: "STANDUP_REVIEW", done: true },
  { label: "FINISH_1_DRAFT", done: false },
  { label: "SHUTDOWN_RITUAL", done: false },
];

const signalFeed = [
  "[09:12] SYSTEM: Capture pipeline cleared 6 items.",
  "[10:05] ALERT: Research queue hitting threshold.",
  "[10:34] NOTES: Synthesis session logged (45 min).",
  "[11:03] PUBLISH: Draft 2 scheduled for review.",
  "[11:26] AUTOMATION: Digest summary delivered.",
];

function App() {
  const [projects, setProjects] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [projectParentId, setProjectParentId] = useState("");
  const [inboxText, setInboxText] = useState("");
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const bootTimeout = setTimeout(() => setBooting(false), 1800);
    const bootFailsafe = setTimeout(() => setBooting(false), 5000);
    return () => {
      clearTimeout(bootTimeout);
      clearTimeout(bootFailsafe);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setInbox([]);
      return undefined;
    }

    const projectQuery = query(
      collection(db, "projects"),
      where("owner_uid", "==", user.uid)
    );
    const inboxQuery = query(
      collection(db, "inbox"),
      where("owner_uid", "==", user.uid)
    );

    const unsubProjects = onSnapshot(
      projectQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setError("");
        setProjects(data);
      },
      (err) => setError(err.message)
    );

    const unsubInbox = onSnapshot(
      inboxQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setError("");
        setInbox(data);
      },
      (err) => setError(err.message)
    );

    return () => {
      unsubProjects();
      unsubInbox();
    };
  }, [user]);

  useEffect(() => {
    if (!activeId && projects.length > 0) {
      setActiveId(projects[0].id);
    }
  }, [activeId, projects]);

  async function handleSignIn() {
    setError("");
    await signInWithPopup(auth, provider);
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  async function createProject(event) {
    event.preventDefault();
    if (!projectName.trim() || !user) return;
    setError("");
    await addDoc(collection(db, "projects"), {
      owner_uid: user.uid,
      name: projectName.trim(),
      path: projectPath.trim(),
      status: projectStatus,
      summary: "",
      last_left_off: "",
      next_action: "",
      tags: [],
      parent_id: projectParentId || null,
      created_at: serverTimestamp(),
      last_updated_at: serverTimestamp(),
    });
    setProjectName("");
    setProjectPath("");
    setProjectStatus("active");
    setProjectParentId("");
  }

  function updateProjectField(id, field, value) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id ? { ...project, [field]: value } : project
      )
    );
  }

  async function saveProject(id) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setError("");
    await updateDoc(doc(db, "projects", id), {
      name: project.name,
      path: project.path,
      status: project.status,
      summary: project.summary || "",
      last_left_off: project.last_left_off || "",
      next_action: project.next_action || "",
      tags: Array.isArray(project.tags) ? project.tags : [],
      parent_id: project.parent_id || null,
      last_updated_at: serverTimestamp(),
    });
  }

  async function deleteProject(id) {
    const target = projects.find((item) => item.id === id);
    if (!target) return;
    const ok = window.confirm(
      `Delete "${target.name}"? Child projects will be unlinked.`
    );
    if (!ok) return;
    setError("");

    const batch = writeBatch(db);
    const children = projects.filter((item) => item.parent_id === id);
    for (const child of children) {
      batch.update(doc(db, "projects", child.id), {
        parent_id: null,
        last_updated_at: serverTimestamp(),
      });
    }
    batch.delete(doc(db, "projects", id));
    await batch.commit();
  }

  async function createInboxItem(event) {
    event.preventDefault();
    if (!inboxText.trim() || !user) return;
    setError("");
    await addDoc(collection(db, "inbox"), {
      owner_uid: user.uid,
      text: inboxText.trim(),
      created_at: serverTimestamp(),
      linked_project_id: null,
      converted_to: null,
    });
    setInboxText("");
  }

  const parentProjects = useMemo(
    () => projects.filter((project) => !project.parent_id),
    [projects]
  );
  const childProjects = useMemo(
    () => projects.filter((project) => project.parent_id),
    [projects]
  );
  const childrenByParent = useMemo(() => {
    return childProjects.reduce((map, project) => {
      const list = map.get(project.parent_id) || [];
      list.push(project);
      map.set(project.parent_id, list);
      return map;
    }, new Map());
  }, [childProjects]);

  const displayProjects = useMemo(() => {
    if (projects.length === 0) return sampleProjects;
    return projects.map((project) => {
      const tagCount = Array.isArray(project.tags) ? project.tags.length : 0;
      return {
        id: project.id,
        name: project.name
          ? project.name.toUpperCase().replace(/\s+/g, "_")
          : "PROJECT",
        progress: Math.min(100, tagCount * 10),
        status: (project.status || "active").toUpperCase(),
        crew: 1,
        urgent: project.next_action ? 1 : 0,
        client: "SECOND_BRAIN",
        focus: project.next_action
          ? project.next_action.slice(0, 24).toUpperCase()
          : "FOCUS + BUILD",
      };
    });
  }, [projects]);

  const activeProject = useMemo(() => {
    if (displayProjects.length === 0) return null;
    const resolvedId = activeId || displayProjects[0].id;
    return displayProjects.find((proj) => proj.id === resolvedId) || null;
  }, [activeId, displayProjects]);

  function formatTimestamp(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
    return "";
  }

  function renderProjectCard(project) {
    return (
      <div className="card" key={project.id}>
        <div className="card-header">
          <div>
            <h3>{project.name}</h3>
            <p className="muted">{project.path || "No path yet"}</p>
          </div>
          <span className={`status ${project.status}`}>{project.status}</span>
        </div>
        <label>
          Parent project
          <select
            value={project.parent_id || ""}
            onChange={(event) =>
              updateProjectField(project.id, "parent_id", event.target.value)
            }
          >
            <option value="">(no parent)</option>
            {parentOptions(project.id).map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Last left off
          <textarea
            value={project.last_left_off || ""}
            onChange={(event) =>
              updateProjectField(
                project.id,
                "last_left_off",
                event.target.value
              )
            }
          />
        </label>
        <label>
          Next action
          <textarea
            value={project.next_action || ""}
            onChange={(event) =>
              updateProjectField(project.id, "next_action", event.target.value)
            }
          />
        </label>
        <div className="card-actions">
          <button
            className="ghost"
            type="button"
            onClick={() => saveProject(project.id)}
          >
            Save notes
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => deleteProject(project.id)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  function parentOptions(currentId) {
    return parentProjects.filter((project) => project.id !== currentId);
  }

  const todayStamp = new Date().toISOString().slice(0, 10);

  if (loadingUser) {
    return (
      <div className="app-shell">
        <div className="grid-pattern"></div>
        <div className="signal-sweep"></div>
        <div className="noise"></div>
        <div className="loading-panel">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <div className="grid-pattern"></div>
        <div className="signal-sweep"></div>
        <div className="noise"></div>
        <div className="auth-shell">
          <header className="top-bar">
            <div className="brand-stack">
              <span className="brand-mark">SecondBrain</span>
              <span className="brand-sub">Ops Deck</span>
            </div>
            <span className="badge mono">SYNC LANE: STANDBY</span>
          </header>
          <div className="auth-hero panel panel-hero">
            <p className="eyebrow">Second Brain</p>
            <h1>Ops deck for calm control</h1>
            <p className="subhead">
              Sign in with Google to access your private workspace.
            </p>
            <button className="auth-button" type="button" onClick={handleSignIn}>
              Sign in with Google
            </button>
            {error ? <p className="error">{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="grid-pattern"></div>
      <div className="signal-sweep"></div>
      <div className="noise"></div>

      {booting ? (
        <div className="boot-screen">
          <div className="boot-terminal">
            <p className="mono boot-title">OPS_DECK v2.3 // INITIALIZING</p>
            <div className="mono boot-text">
              <p>ROUTING: SIGNAL_GRID... OK</p>
              <p>INDEXING: CAPTURE_LAYERS... OK</p>
              <p>CALIBRATING: SYNTHESIS_LOOP... OK</p>
              <p>ARMING: PUBLISH_STACK... OK</p>
            </div>
            <div className="boot-bar">
              <span className="boot-bar-fill"></span>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`app-frame ${booting ? "is-booting" : "ready"}`}>
        <header className="top-bar">
          <div className="top-left">
            <div className="brand-stack">
              <span className="brand-mark">SecondBrain</span>
              <span className="brand-sub">Ops Deck</span>
            </div>
            <span className="badge mono hidden-sm">SYNC LANE: LIVE</span>
          </div>
          <div className="top-right">
            <span className="chip mono">
              <span className="dot"></span> focus: deep
            </span>
            <span className="chip chip-amber mono">mode: build</span>
            <span className="mono operator">Operator: {user.email}</span>
            <button className="ghost small" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <div className="app-body">
          <aside className="side-panel">
            <div className="section-label mono">Active Modules</div>
            <nav className="nav scroll-thin">
              {displayProjects.map((project) => (
                <button
                  key={project.id}
                  className={`nav-btn ${
                    activeProject && project.id === activeProject.id
                      ? "active"
                      : ""
                  }`}
                  type="button"
                  onClick={() => setActiveId(project.id)}
                >
                  <div className="nav-stack">
                    <span className="nav-title">{project.name}</span>
                    <span className="nav-sub">{project.status}</span>
                  </div>
                </button>
              ))}
            </nav>
            <div className="side-footer">
              <div className="mono-small">Signal Log</div>
              <div className="mono side-log">
                <span className="text-emerald">[11:02] CAPTURE_FLOW CONNECTED</span>
                <span>[11:09] REVIEW QUEUE SYNCED</span>
                <span>[11:21] PUBLISH PIPE READY</span>
              </div>
            </div>
          </aside>

          <main className="main-content scroll-thin">
            {error ? <p className="error">{error}</p> : null}

            <div className="hero-grid">
              <div className="panel panel-hero hero-card reveal" style={{ "--d": "0.05s" }}>
                <div className="hero-header">
                  <div>
                    <h2 id="prj-title" className="hero-title">
                      {activeProject ? activeProject.name : "SYSTEM"}
                    </h2>
                    <p id="prj-subtitle" className="hero-sub mono">
                      {activeProject
                        ? `CLIENT: ${activeProject.client} // FOCUS: ${activeProject.focus}`
                        : "FOCUS AREA"}
                    </p>
                  </div>
                  <div className="hero-stats">
                    <div className="stat">
                      <div className="tag mono">Crew</div>
                      <div id="prj-crew" className="stat-value teal">
                        {activeProject ? activeProject.crew : 0}
                      </div>
                    </div>
                    <div className="stat">
                      <div className="tag mono">Urgent</div>
                      <div id="prj-urgent" className="stat-value amber">
                        {activeProject ? activeProject.urgent : 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bar-block">
                  <div className="bar-label mono">
                    <span>Momentum</span>
                    <span id="prj-percent">
                      {activeProject ? `${activeProject.progress}%` : "0%"}
                    </span>
                  </div>
                  <div className="bar-wrap">
                    <div
                      id="prj-bar"
                      className="bar-fill"
                      style={{
                        width: activeProject ? `${activeProject.progress}%` : "0%",
                      }}
                    ></div>
                  </div>
                </div>

                <div className="hero-subgrid">
                  <div className="panel panel-soft card-hover">
                    <div className="subpanel-title">
                      Capture
                    </div>
                    <div className="subpanel-list mono">
                      <p>
                        <span>INBOX:</span> <span className="text-emerald">{inbox.length}</span>
                      </p>
                      <p>
                        <span>QUEUE:</span> <span>{projects.length} PROJECTS</span>
                      </p>
                      <p>
                        <span>LAST:</span> <span>{todayStamp}</span>
                      </p>
                    </div>
                  </div>
                  <div className="panel panel-soft card-hover">
                    <div className="subpanel-title">
                      Synthesis
                    </div>
                    <div className="subpanel-list mono">
                      <p>
                        <span>MODE:</span> <span className="text-amber">DEEP WORK</span>
                      </p>
                      <p>
                        <span>HORIZON:</span> <span>7 DAYS</span>
                      </p>
                      <p>
                        <span>NOTES:</span> <span>{inbox.length} TAGGED</span>
                      </p>
                    </div>
                  </div>
                  <div className="panel panel-soft card-hover">
                    <div className="subpanel-title">
                      Publish
                    </div>
                    <div className="subpanel-list mono">
                      <p>
                        <span>PIPE:</span> <span className="text-emerald">GREEN</span>
                      </p>
                      <p>
                        <span>ASSETS:</span> <span>{projects.length} READY</span>
                      </p>
                      <p>
                        <span>NEXT:</span> <span>THU</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel panel-soft daily-panel reveal" style={{ "--d": "0.12s" }}>
                <h3 className="daily-title">
                  Daily Loop
                </h3>
                <div className="habit-list">
                  {habits.map((habit) => (
                    <div className="habit-row" key={habit.label}>
                      <div
                        className={`habit-box ${habit.done ? "done" : ""}`}
                      >
                        {habit.done ? <span>OK</span> : null}
                      </div>
                      <span
                        className={`mono habit-label ${habit.done ? "" : "off"}`}
                      >
                        {habit.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="daily-quote mono">
                  "Small wins, compounding velocity."
                </div>
              </div>
            </div>

            <div className="content-grid">
              <div className="panel panel-soft reveal" style={{ "--d": "0.2s" }}>
                <div className="panel-title">Projects</div>
                <form className="form" onSubmit={createProject}>
                  <input
                    type="text"
                    placeholder="Project name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Drive-relative path (optional)"
                    value={projectPath}
                    onChange={(event) => setProjectPath(event.target.value)}
                  />
                  <select
                    value={projectStatus}
                    onChange={(event) => setProjectStatus(event.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                  <select
                    value={projectParentId}
                    onChange={(event) => setProjectParentId(event.target.value)}
                  >
                    <option value="">(no parent)</option>
                    {parentProjects.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Add project</button>
                </form>

                <div className="card-list">
                  {parentProjects.map((parent) => (
                    <div className="group" key={parent.id}>
                      <div className="group-title">
                        Parent: <strong>{parent.name}</strong>
                      </div>
                      {renderProjectCard(parent)}
                      {(childrenByParent.get(parent.id) || []).length > 0 && (
                        <div className="child-list">
                          {(childrenByParent.get(parent.id) || []).map((child) =>
                            renderProjectCard(child)
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {projects.filter(
                    (project) =>
                      project.parent_id &&
                      !projects.some((p) => p.id === project.parent_id)
                  ).length > 0 && (
                    <div className="group">
                      <div className="group-title">Unlinked projects</div>
                      <div className="child-list">
                        {projects
                          .filter(
                            (project) =>
                              project.parent_id &&
                              !projects.some((p) => p.id === project.parent_id)
                          )
                          .map((project) => renderProjectCard(project))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel panel-soft reveal" style={{ "--d": "0.26s" }}>
                <div className="panel-title">Inbox</div>
                <form className="form" onSubmit={createInboxItem}>
                  <textarea
                    placeholder="Capture a thought..."
                    value={inboxText}
                    onChange={(event) => setInboxText(event.target.value)}
                  />
                  <button type="submit">Add to inbox</button>
                </form>
                <div className="card-list">
                  {inbox.map((item) => (
                    <div className="card inbox" key={item.id}>
                      <p>{item.text}</p>
                      <span className="muted">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel panel-soft reveal" style={{ "--d": "0.32s" }}>
                <div className="panel-title">Signal Feed</div>
                <div className="signal-feed mono scroll-thin">
                  {signalFeed.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>

        <footer className="footer">
          <div className="footer-left">
            <span>HQ_COORD: 32.4487 N, 99.7331 W</span>
            <span className="hidden-sm">PROFILE: SECOND_BRAIN_V2</span>
          </div>
          <div className="footer-right">
            <span>POWER: MAX</span>
            <span>{todayStamp} // LIVE MODE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
