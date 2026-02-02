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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingUser(false);
    });
    return () => unsub();
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

  function parentOptions(currentId) {
    return parentProjects.filter((project) => project.id !== currentId);
  }

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
              updateProjectField(
                project.id,
                "next_action",
                event.target.value
              )
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

  if (loadingUser) {
    return (
      <div className="page">
        <div className="panel">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <header className="hero">
          <div>
            <p className="eyebrow">Second Brain</p>
            <h1>Calm control for your projects</h1>
            <p className="subhead">
              Sign in with Google to access your private workspace.
            </p>
          </div>
          <div className="pill">Cloud · Firebase</div>
        </header>
        <div className="panel auth-panel">
          <button className="auth-button" type="button" onClick={handleSignIn}>
            Sign in with Google
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Second Brain</p>
          <h1>Calm control for your projects</h1>
          <p className="subhead">
            Track last left off, next actions, and quick thoughts without the
            file-tree chaos.
          </p>
        </div>
        <div className="pill">Cloud · Firebase</div>
      </header>

      <div className="auth-bar">
        <span className="muted">Signed in as {user.email}</span>
        <button className="ghost" type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <div className="panel">
          <h2>Projects</h2>
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

        <div className="panel">
          <h2>Inbox</h2>
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
      </section>
    </div>
  );
}

export default App;







