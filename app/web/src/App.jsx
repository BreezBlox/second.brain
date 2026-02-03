import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const habits = [
  { label: "INBOX_ZERO", done: true },
  { label: "DEEP_WORK_BLOCK", done: false },
  { label: "MOVE / TRAIN", done: true },
  { label: "STANDUP_REVIEW", done: true },
  { label: "FINISH_1_DRAFT", done: false },
  { label: "SHUTDOWN_RITUAL", done: false },
];

async function fetchJson(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
}

function App() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [bbl, setBbl] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [inboxText, setInboxText] = useState("");
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setLoading(true);
    setError("");
    try {
      const status = await fetchJson("/api/drive/status");
      if (!status.authorized) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      if (status.error) {
        setError(status.error);
      }
      setAuthorized(true);
      await loadSummary();
    } catch (err) {
      setError(err.message || "Unable to reach server.");
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const summary = await fetchJson("/api/bbl/summary");
      setBbl(summary);
      setActiveId((prev) => prev || summary.projects?.[0]?.id || "");
    } catch (err) {
      setError(err.message || "Failed to load BBL summary.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddInbox(event) {
    event.preventDefault();
    const text = inboxText.trim();
    if (!text) return;
    setError("");
    try {
      await fetchJson("/api/bbl/inbox", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setInboxText("");
      await loadSummary();
    } catch (err) {
      setError(err.message || "Failed to add inbox item.");
    }
  }

  async function handleToggleTask(task) {
    if (!task?.fileId) return;
    setError("");
    setTogglingId(task.id);
    try {
      await fetchJson("/api/bbl/tasks/toggle", {
        method: "POST",
        body: JSON.stringify({
          fileId: task.fileId,
          lineNumber: task.lineNumber,
        }),
      });
      await loadSummary();
    } catch (err) {
      setError(err.message || "Failed to toggle task.");
    } finally {
      setTogglingId("");
    }
  }

  const projects = bbl?.projects || [];
  const activeProject = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((project) => project.id === activeId) || projects[0];
  }, [projects, activeId]);

  const currentSprint = bbl?.currentSprint || [];
  const signalFeed = bbl?.signalFeed || [];
  const inbox = bbl?.inbox || [];
  const tasks = bbl?.tasks || [];
  const nextUp = bbl?.nextUp || null;

  if (loading) {
    return (
      <div className="app-shell">
        <div className="grid-pattern"></div>
        <div className="signal-sweep"></div>
        <div className="noise"></div>
        <div className="loading-panel">Loading workspace...</div>
      </div>
    );
  }

  if (!authorized) {
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
            <h1>Connect your Drive workspace</h1>
            <p className="subhead">
              Authorize access to your BBL.pkg so the ops deck can read and write
              live files.
            </p>
            <button
              className="auth-button"
              type="button"
              onClick={() => {
                window.location.href = `${API_BASE}/auth/google`;
              }}
            >
              Connect Google Drive
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

      <div className="app-frame ready">
        <header className="top-bar">
          <div className="top-left">
            <div className="brand-stack">
              <span className="brand-mark">SecondBrain</span>
              <span className="brand-sub">Ops Deck</span>
            </div>
            <span className="badge mono hidden-sm">
              SYNC LANE: {bbl?.folder?.name || "LIVE"}
            </span>
          </div>
          <div className="top-right">
            <span className="chip mono">
              <span className="dot"></span> focus: deep
            </span>
            <span className="chip chip-amber mono">mode: build</span>
            <span className="mono operator">Operator: Drive</span>
          </div>
        </header>

        <div className="app-body">
          <aside className="side-panel">
            <div className="section-label mono">Active Modules</div>
            <nav className="nav scroll-thin">
              {projects.map((project) => (
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
                <span className="text-emerald">[SYNC] DRIVE CONNECTED</span>
                <span>[BBL] {bbl?.roadmap?.lastUpdated || "READY"}</span>
                <span>[STATUS] {bbl?.roadmap?.status || "ACTIVE"}</span>
              </div>
            </div>
          </aside>

          <main className="main-content scroll-thin">
            {error ? <p className="error">{error}</p> : null}

            <div className="hero-grid">
              <div
                className="panel panel-hero hero-card reveal"
                style={{ "--d": "0.05s" }}
              >
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
                    <div className="subpanel-title">Capture</div>
                    <div className="subpanel-list mono">
                      <p>
                        <span>INBOX:</span> <span className="text-emerald">{inbox.length}</span>
                      </p>
                      <p>
                        <span>QUEUE:</span> <span>{projects.length} MODULES</span>
                      </p>
                      <p>
                        <span>LAST:</span> <span>{bbl?.roadmap?.lastUpdated || "--"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="panel panel-soft card-hover">
                    <div className="subpanel-title">Synthesis</div>
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
                    <div className="subpanel-title">Publish</div>
                    <div className="subpanel-list mono">
                      <p>
                        <span>PIPE:</span> <span className="text-emerald">GREEN</span>
                      </p>
                      <p>
                        <span>ASSETS:</span> <span>{bbl?.ingredients?.length || 0} READY</span>
                      </p>
                      <p>
                        <span>NEXT:</span> <span>THU</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="side-stack">
                <div
                  className="panel panel-soft next-panel reveal"
                  style={{ "--d": "0.1s" }}
                >
                  <h3 className="daily-title">Next Up</h3>
                  {nextUp ? (
                    <div className="next-card">
                      <div className="next-title">{nextUp.title}</div>
                      <div className="next-meta mono">
                        Source: {nextUp.source || "BBL"}
                      </div>
                      {nextUp.fileId ? (
                        <button
                          className="ghost small"
                          type="button"
                          onClick={() =>
                            handleToggleTask({
                              id: "next-up",
                              fileId: nextUp.fileId,
                              lineNumber: nextUp.lineNumber,
                            })
                          }
                        >
                          Mark done
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="next-empty">No next step found.</div>
                  )}
                </div>

                <div
                  className="panel panel-soft daily-panel reveal"
                  style={{ "--d": "0.14s" }}
                >
                  <h3 className="daily-title">Daily Loop</h3>
                  <div className="habit-list">
                    {habits.map((habit) => (
                      <div className="habit-row" key={habit.label}>
                        <div className={`habit-box ${habit.done ? "done" : ""}`}>
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
            </div>

            <div className="content-grid">
              <div className="panel panel-soft reveal" style={{ "--d": "0.2s" }}>
                <div className="panel-title">Priority Queue</div>
                <div className="task-list mono">
                  {tasks.length ? (
                    tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`task-item ${task.done ? "done" : ""}`}
                        onClick={() => handleToggleTask(task)}
                        disabled={togglingId === task.id}
                      >
                        <div className="task-left">
                          <span className="task-check">
                            {task.done ? "OK" : ""}
                          </span>
                          <span className="task-text">{task.text}</span>
                        </div>
                        <span className="task-source">
                          {task.source || "BBL"}
                        </span>
                      </button>
                    ))
                  ) : currentSprint.length ? (
                    currentSprint.map((task) => <p key={task}>{task}</p>)
                  ) : (
                    <p>No sprint priorities found.</p>
                  )}
                </div>
              </div>

              <div className="panel panel-soft reveal" style={{ "--d": "0.26s" }}>
                <div className="panel-title">Inbox</div>
                <form className="form" onSubmit={handleAddInbox}>
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
                      {item.date ? <span className="muted">{item.date}</span> : null}
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
            <span>{bbl?.roadmap?.lastUpdated || "LIVE"} // DRIVE MODE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
