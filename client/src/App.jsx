import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Activity, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown,
  CircleHelp, ClipboardList, Clock3, Command, LayoutDashboard, LogOut, Menu, Plus, Search,
  ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
const api = axios.create({ baseURL: API_URL, withCredentials: true });

const columns = [
  { id: "todo", title: "To do", tone: "violet" },
  { id: "in_progress", title: "In progress", tone: "amber" },
  { id: "done", title: "Completed", tone: "green" },
];

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStatus: { todo: 0, in_progress: 0, done: 0 }, completion: 0 });
  const [notifications, setNotifications] = useState([]);
  const [team, setTeam] = useState([]);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [taskResult, statResult, notificationResult] = await Promise.all([
      api.get("/api/tasks"),
      api.get("/api/dashboard/stats"),
      api.get("/api/notifications"),
    ]);
    setTasks(taskResult.data.tasks);
    setStats(statResult.data);
    setNotifications(notificationResult.data.notifications);
  }, []);

  useEffect(() => {
    api.get("/api/auth/me")
      .then(async ({ data }) => {
        setUser(data.user);
        const [taskResult, statResult, notificationResult] = await Promise.all([
          api.get("/api/tasks"), api.get("/api/dashboard/stats"), api.get("/api/notifications"),
        ]);
        setTasks(taskResult.data.tasks);
        setStats(statResult.data);
        setNotifications(notificationResult.data.notifications);
        if (data.user.role === "admin") {
          const { data: teamData } = await api.get("/api/tasks/team");
          setTeam(teamData.users);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.on("notification:new", (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 30));
      setNotice(notification.message);
    });
    socket.on("connect_error", (error) => console.error("Live updates unavailable:", error.message));
    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => `${task.title} ${task.description}`.toLowerCase().includes(term));
  }, [search, tasks]);

  async function authenticate(event, mode) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const { data } = await api.post(`/api/auth/${mode}`, values);
      setUser(data.user);
      const [taskResult, statResult, notificationResult] = await Promise.all([
        api.get("/api/tasks"), api.get("/api/dashboard/stats"), api.get("/api/notifications"),
      ]);
      setTasks(taskResult.data.tasks);
      setStats(statResult.data);
      setNotifications(notificationResult.data.notifications);
      if (data.user.role === "admin") {
        const { data: teamData } = await api.get("/api/tasks/team");
        setTeam(teamData.users);
      }
    } catch (error) {
      setNotice(error.response?.data?.message || "Unable to connect. Check the API and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    setTasks([]);
    setNotifications([]);
    setTeam([]);
  }

  async function saveTask(event) {
    event.preventDefault();
    setBusy(true);
    const input = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.post("/api/tasks", {
        ...input,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00`).toISOString() : null,
      });
      await refresh();
      setDialog(false);
      setNotice("Task created successfully.");
    } catch (error) {
      setNotice(error.response?.data?.message || "Unable to save task.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(task, patch) {
    try {
      const { data } = await api.patch(`/api/tasks/${task._id}`, patch);
      setTasks((current) => current.map((item) => item._id === task._id ? data.task : item));
      const { data: statData } = await api.get("/api/dashboard/stats");
      setStats(statData);
    } catch (error) {
      setNotice(error.response?.data?.message || "Unable to update task.");
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try {
      await api.delete(`/api/tasks/${task._id}`);
      setTasks((current) => current.filter((item) => item._id !== task._id));
      const { data } = await api.get("/api/dashboard/stats");
      setStats(data);
    } catch (error) {
      setNotice(error.response?.data?.message || "Unable to delete task.");
    }
  }

  async function readNotification(notification) {
    if (notification.readAt) return;
    const { data } = await api.patch(`/api/notifications/${notification._id}/read`);
    setNotifications((current) => current.map((item) => item._id === data.notification._id ? data.notification : item));
  }

  if (!authChecked) return <div className="loading-screen"><div className="loader" />Loading your workspace</div>;
  if (!user) return <AuthScreen onSubmit={authenticate} notice={notice} busy={busy} />;

  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span>
          <span>notify<span className="brand-light">hub</span></span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">N</span>
          <span className="workspace-name"><strong>Northstar Studio</strong><small>Free workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav">
          <NavButton icon={LayoutDashboard} label="Overview" active={activeNav === "Overview"} onClick={() => setActiveNav("Overview")} />
          <NavButton icon={ClipboardList} label="My tasks" active={activeNav === "My tasks"} onClick={() => setActiveNav("My tasks")} />
          {user.role === "admin" && <NavButton icon={Users} label="Team" active={activeNav === "Team"} onClick={() => setActiveNav("Team")} />}
          <NavButton icon={Activity} label="Analytics" active={activeNav === "Analytics"} onClick={() => setActiveNav("Analytics")} />
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={16} /></div>
            <strong>Make work flow</strong>
            <p>Keep your team aligned and moving forward.</p>
            <button type="button" onClick={() => setNotice("You're already on the right track.")}>Explore workspace <ArrowUpRight size={14} /></button>
          </div>
          <button className="nav-item support-item" type="button" onClick={() => setNotice("Need help? Contact your workspace administrator.")}>
            <CircleHelp size={17} /> Help & support
          </button>
          <div className="profile-row">
            <Avatar name={user.name} />
            <div className="profile-copy"><strong>{user.name}</strong><small>{user.role}</small></div>
            <button className="icon-button profile-action" type="button" title="Sign out" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." /><kbd><Command size={11} /> K</kbd></label>
            <button className="icon-button notification-button" type="button" title="Notifications" onClick={() => setActiveNav("Notifications")}>
              <Bell size={18} />{unread > 0 && <span className="notification-dot">{unread}</span>}
            </button>
            <div className="topbar-divider" />
            <Avatar name={user.name} />
          </div>
        </header>

        <div className="content">
          {activeNav === "Team" && user.role === "admin" ? (
            <TeamView team={team} />
          ) : activeNav === "Notifications" ? (
            <NotificationView notifications={notifications} onRead={readNotification} />
          ) : activeNav === "Analytics" ? (
            <AnalyticsView stats={stats} tasks={tasks} />
          ) : (
            <Dashboard
              user={user}
              tasks={activeNav === "My tasks" && user.role === "admin"
                ? filteredTasks.filter((task) => task.owner?._id === user.id)
                : filteredTasks}
              stats={stats}
              onCreate={() => setDialog(true)}
              onUpdate={updateTask}
              onDelete={deleteTask}
              showMine={activeNav === "My tasks"}
            />
          )}
        </div>
      </main>

      {dialog && <TaskDialog onClose={() => setDialog(false)} onSubmit={saveTask} busy={busy} team={user.role === "admin" ? team : []} />}
      {notice && <div className="toast"><span className="toast-check"><Check size={14} /></span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function AuthScreen({ onSubmit, notice, busy }) {
  const [mode, setMode] = useState("login");
  return (
    <div className="auth-page">
      <div className="auth-showcase">
        <a className="brand auth-brand" href="#" onClick={(event) => event.preventDefault()}><span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span><span>notify<span className="brand-light">hub</span></span></a>
        <div className="showcase-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR TEAM, IN SYNC</span>
          <h1>Make good work<br /><em>flow together.</em></h1>
          <p>One calm place to see what matters, move work forward, and celebrate progress.</p>
          <div className="showcase-stat"><div className="mini-avatars"><Avatar name="Ava" small /><Avatar name="Leo" small /><Avatar name="Sam" small /></div><span>Teams do their best work here</span></div>
        </div>
        <div className="showcase-decoration deco-one" /><div className="showcase-decoration deco-two" />
        <span className="auth-footnote">A little more focus. A lot more momentum.</span>
      </div>
      <div className="auth-form-side">
        <form className="auth-form" onSubmit={(event) => onSubmit(event, mode)}>
          <div className="mobile-auth-brand"><span className="brand-mark"><Activity size={19} /></span><strong>notifyhub</strong></div>
          <span className="form-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
          <h2>{mode === "login" ? "Sign in to your workspace" : "Create your account"}</h2>
          <p className="form-subtitle">{mode === "login" ? "Your team is right where you left it." : "Join your team and start moving work forward."}</p>
          <div className="auth-tabs"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Sign in</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Create account</button></div>
          {mode === "register" && <label className="field-label">Your name<input className="text-input" name="name" autoComplete="name" placeholder="How should we call you?" required maxLength={80} /></label>}
          <label className="field-label">Work email<input className="text-input" type="email" name="email" autoComplete="email" placeholder="you@company.com" required /></label>
          <label className="field-label">Password<input className="text-input" type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" minLength={8} required /></label>
          {notice && <p className="form-error" role="alert">{notice}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "One moment..." : mode === "login" ? "Sign in" : "Create account"}<ArrowUpRight size={16} /></button>
          <p className="auth-legal">By continuing, you agree to work together with a little more clarity.</p>
        </form>
        <div className="auth-help"><ShieldCheck size={15} /> Your workspace is private and secure</div>
      </div>
    </div>
  );
}

function Dashboard({ user, tasks, stats, onCreate, onUpdate, onDelete, showMine }) {
  return (
    <>
      <section className="welcome-row">
        <div><span className="date-line"><CalendarDays size={14} /> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><h1>{greeting()}, {user.name.split(" ")[0]} <span className="wave">✦</span></h1><p>Here’s what’s happening with your team today.</p></div>
        <button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> New task</button>
      </section>
      <section className="metrics-grid">
        <MetricCard icon={ClipboardList} label="Total tasks" value={stats.total} foot="Across your workspace" color="blue" />
        <MetricCard icon={Clock3} label="In progress" value={stats.byStatus.in_progress} foot="Work underway" color="amber" />
        <MetricCard icon={CheckCheck} label="Completed" value={stats.byStatus.done} foot={`${stats.completion}% completion rate`} color="green" />
        <MetricCard icon={Activity} label="To do" value={stats.byStatus.todo} foot="Ready when you are" color="purple" />
      </section>
      <section className="dashboard-grid">
        <div className="panel activity-panel">
          <div className="panel-header"><div><h2>Activity overview</h2><p>A little progress adds up.</p></div><button className="select-period" type="button">This week <ChevronDown size={14} /></button></div>
          <div className="chart-legend"><span><i className="legend-dot dot-blue" /> Opened</span><span><i className="legend-dot dot-green" /> Completed</span></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.activity || []} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6486ed" stopOpacity={0.19} /><stop offset="95%" stopColor="#6486ed" stopOpacity={0} /></linearGradient><linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38b89a" stopOpacity={0.15} /><stop offset="95%" stopColor="#38b89a" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f4" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9199a8", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#9199a8", fontSize: 11 }} /><Tooltip contentStyle={{ border: "1px solid #e8ebf0", borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="opened" stroke="#6887eb" strokeWidth={2.5} fill="url(#openedFill)" /><Area type="monotone" dataKey="completed" stroke="#40b89b" strokeWidth={2.5} fill="url(#completedFill)" /></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="panel progress-panel">
          <div className="panel-header"><div><h2>Progress</h2><p>Keep the momentum going.</p></div><span className="progress-icon"><Activity size={16} /></span></div>
          <div className="progress-ring" style={{ "--progress": `${stats.completion}%` }}><div><strong>{stats.completion}<small>%</small></strong><span>completed</span></div></div>
          <div className="progress-breakdown">{columns.map((column) => <div key={column.id}><span><i className={`legend-dot dot-${column.tone}`} />{column.title}</span><strong>{stats.byStatus[column.id]}</strong></div>)}</div>
          <div className="progress-footer"><Sparkles size={15} /> Every finished task is a win.</div>
        </div>
      </section>
      <section className="tasks-section">
        <div className="section-heading"><div><h2>{showMine ? "My tasks" : "Task board"}</h2><p>Pick up where you left off.</p></div><button className="text-button" type="button" onClick={onCreate}>View all tasks <ArrowUpRight size={14} /></button></div>
        <div className="kanban-grid">{columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          return <div className="kanban-column" key={column.id}>
            <div className="column-heading"><span className={`status-mark ${column.tone}`} /><strong>{column.title}</strong><span className="task-count">{columnTasks.length}</span></div>
            <div className="task-list">{columnTasks.slice(0, 4).map((task) => <TaskCard key={task._id} task={task} onUpdate={onUpdate} onDelete={onDelete} />)}
              {columnTasks.length === 0 && <div className="empty-column">Nothing here yet</div>}
              {columnTasks.length > 4 && <span className="more-tasks">+{columnTasks.length - 4} more</span>}
            </div>
            <button className="add-task-inline" type="button" onClick={onCreate}><Plus size={15} /> Add task</button>
          </div>;
        })}</div>
      </section>
    </>
  );
}

function TaskCard({ task, onUpdate, onDelete }) {
  const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
  return (
    <article className="task-card">
      <div className="task-card-top"><span className={`priority-pill priority-${task.priority}`}>{task.priority}</span><button className="task-menu" type="button" title="Delete task" onClick={() => onDelete(task)}><X size={15} /></button></div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-card-bottom"><span className="task-owner"><Avatar name={task.owner?.name || "Member"} small />{task.owner?.name?.split(" ")[0] || "Member"}</span><button className="move-task" type="button" onClick={() => onUpdate(task, { status: nextStatus })} title="Move to next status"><ArrowUpRight size={15} /></button></div>
    </article>
  );
}

function MetricCard({ icon: Icon, label, value, foot, color }) {
  return <article className="metric-card"><div className={`metric-icon ${color}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot"><span className="metric-trend"><ArrowUpRight size={12} /></span>{foot}</span></article>;
}

function AnalyticsView({ stats, tasks }) {
  const overdue = tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done");
  const high = tasks.filter((task) => task.priority === "high" && task.status !== "done");
  return <><section className="welcome-row"><div><span className="date-line"><Activity size={14} /> WORKSPACE HEALTH</span><h1>Analytics <span className="wave">↗</span></h1><p>A clear snapshot of your team’s work.</p></div></section><section className="metrics-grid"><MetricCard icon={ClipboardList} label="Total tasks" value={stats.total} foot="Current workload" color="blue" /><MetricCard icon={CheckCheck} label="Completed" value={stats.byStatus.done} foot={`${stats.completion}% completion`} color="green" /><MetricCard icon={Clock3} label="Overdue" value={overdue.length} foot="Needs attention" color="amber" /><MetricCard icon={ArrowUpRight} label="High priority" value={high.length} foot="Open high priority items" color="purple" /></section><section className="panel analytics-tip"><div className="tip-icon"><Sparkles size={18} /></div><div><h2>Small steps, real momentum</h2><p>Your workspace has <strong>{stats.byStatus.in_progress}</strong> tasks moving right now. Celebrate progress and keep the next action clear.</p></div></section></>;
}

function TeamView({ team }) {
  return <><section className="welcome-row"><div><span className="date-line"><Users size={14} /> YOUR PEOPLE</span><h1>Team <span className="wave">✦</span></h1><p>People making good work happen.</p></div><span className="team-total">{team.length} {team.length === 1 ? "person" : "people"}</span></section><section className="panel team-panel"><div className="team-header"><div><h2>Workspace members</h2><p>Team roles are managed securely.</p></div><span className="admin-badge"><ShieldCheck size={14} /> Admin view</span></div>{team.map((member) => <div className="team-row" key={member._id}><Avatar name={member.name} /><span className="team-member-copy"><strong>{member.name}</strong><small>{member.email}</small></span><span className={`role-chip ${member.role}`}>{member.role}</span></div>)}</section></>;
}

function NotificationView({ notifications, onRead }) {
  return <><section className="welcome-row"><div><span className="date-line"><Bell size={14} /> UPDATES</span><h1>Notifications <span className="wave">✦</span></h1><p>Good things are happening in your workspace.</p></div></section><section className="panel notifications-panel"><div className="panel-header"><div><h2>Recent activity</h2><p>Task assignments and workspace updates.</p></div></div>{notifications.length ? notifications.map((item) => <button type="button" className={`notification-row ${item.readAt ? "" : "unread"}`} key={item._id} onClick={() => onRead(item)}><span className="notification-icon"><Bell size={16} /></span><span className="notification-copy"><strong>{item.message}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span>{!item.readAt && <span className="unread-dot" />}</button>) : <div className="notifications-empty"><span className="empty-bell"><Bell size={21} /></span><strong>All caught up</strong><p>New updates will show up here.</p></div>}</section></>;
}

function TaskDialog({ onClose, onSubmit, busy, team }) {
  const [emailTiming, setEmailTiming] = useState("immediate");
  const needsDueDate = emailTiming === "one_day_before" || emailTiming === "at_due_date";

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="task-modal" onSubmit={onSubmit}>
    <div className="modal-heading"><div><span className="form-kicker">MAKE IT HAPPEN</span><h2>Create a task</h2><p>Give the next great idea a place to start.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <label className="field-label">Task name<input className="text-input" name="title" placeholder="e.g. Plan the product launch" maxLength={140} required autoFocus /></label>
    <label className="field-label">Description <span className="optional">Optional</span><textarea className="text-input textarea" name="description" placeholder="Add a few helpful details..." maxLength={2000} rows={3} /></label>
    <div className="form-grid"><label className="field-label">Priority<select className="text-input" name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="field-label">Due date<input className="text-input" name="dueDate" type="date" required={needsDueDate} /></label></div>
    {team.length > 0 && <label className="field-label">Assign to<select className="text-input" name="owner"><option value="">Myself</option>{team.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label>}
    <label className="field-label">Email notification<select className="text-input" name="emailTiming" value={emailTiming} onChange={(event) => setEmailTiming(event.target.value)}><option value="immediate">When the task is created</option><option value="one_day_before">One day before the due date</option><option value="at_due_date">At the due date</option><option value="none">No email</option></select></label>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><Plus size={16} />{busy ? "Creating..." : "Create task"}</button></div>
  </form></div>;
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return <button className={`nav-item ${active ? "active" : ""}`} type="button" onClick={onClick}><Icon size={17} strokeWidth={active ? 2 : 1.8} /><span>{label}</span>{label === "Team" && <span className="nav-count">↗</span>}</button>;
}

function Avatar({ name, small = false }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const tones = ["avatar-blue", "avatar-pink", "avatar-lime", "avatar-violet"];
  const tone = tones[name.length % tones.length];
  return <span className={`avatar ${tone} ${small ? "avatar-small" : ""}`} aria-label={name}>{initials}</span>;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default App;
