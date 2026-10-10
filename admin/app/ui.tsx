"use client";
import { useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, AudioLines, Check, Clock3, Database, Hand, LayoutDashboard, Menu, ShieldCheck, Smartphone, Sparkles } from "lucide-react";

type Stats = { service: string; status: string; database: string };

export function Dashboard() {
  const [status, setStatus] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState("--:--");
  const [today, setToday] = useState("YOUR WORKSPACE");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const update = () => {
      const date = new Date();
      setNow(new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date));
      setToday(new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" }).format(date).toUpperCase());
    };
    update();
    const timer = setInterval(update, 60_000);
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${api}/health`).then(response => {
      if (!response.ok) throw new Error("API not reachable");
      return response.json();
    }).then(setStatus).catch(() => setError("API not reachable"));
    return () => clearInterval(timer);
  }, []);

  const apiUp = status?.status === "ok";
  return <main className="admin-shell">
    <aside className={menu ? "sidebar menu-open" : "sidebar"}>
      <a className="brand" href="#overview"><span className="brand-logo"><Sparkles size={17}/></span> brainbight<span className="admin-label">WORKSPACE</span></a>
      <div className="side-label">WORKSPACE</div>
      <a className="side-link active" href="#overview"><LayoutDashboard size={16}/> Overview</a>
      <a className="side-link" href="#systems"><Activity size={16}/> Systems</a>
      <a className="side-link" href="#privacy"><ShieldCheck size={16}/> Privacy</a>
      <div className="sidebar-bottom"><div className="admin-promo"><span className="promo-star">✳</span><b>Small steps,<br/>more freedom.</b><p>Thanks for helping<br/>hands-free happen.</p></div><span className="side-version">BRAINBIGHT · DEVELOPMENT</span></div>
    </aside>
    <section className="dashboard">
      <header className="topbar"><button className="menu-toggle" onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div><div className="topbar-right"><span className="live-label"><i/> ALL SYSTEMS {apiUp ? "GO" : "CHECKING"}</span></div></header>
      <div className="page-content" id="overview">
        <div className="welcome-row"><div><div className="date-label">{today} <span>✳</span></div><h1>Good things are <span>in motion.</span></h1><p className="welcome-sub">Your Brainbight development workspace, right this way.</p></div><span className="clock-chip"><Clock3 size={14}/>{now} IST</span></div>
        <div className="stat-grid">
          <article className="stat-card"><div className="stat-heading">API STATUS <span className="stat-icon green"><Activity size={17}/></span></div><div className="stat-value">{error ? "Offline" : status?.status ? apiUp ? "All good" : "Needs setup" : "Checking"}</div><div className="stat-foot"><i className={apiUp ? "status-dot" : "status-dot offline"}/>{status?.service || error || "Checking API health…"}</div></article>
          <article className="stat-card"><div className="stat-heading">POSTGRESQL <span className="stat-icon violet"><Database size={17}/></span></div><div className="stat-value">{status?.database === "connected" ? "Connected" : status?.database === "not configured" ? "Not set up" : status?.database === "unavailable" ? "Unavailable" : "Checking"}</div><div className="stat-foot"><i className={status?.database === "connected" ? "status-dot" : "status-dot offline"}/>Your data, in your database</div></article>
          <article className="stat-card"><div className="stat-heading">MODE <span className="stat-icon orange"><Sparkles size={18}/></span></div><div className="stat-value">Local demo</div><div className="stat-foot"><i className="status-dot offline"/>No account or sign-in required</div></article>
        </div>
        <div className="section-heading" id="systems"><div><h2>Behind the scenes</h2><p>The building blocks that make Brainbight tick.</p></div><a href="http://localhost:4000/health" target="_blank" rel="noreferrer">Peek at API health <ArrowRight size={13}/></a></div>
        <div className="system-grid">
          <article className="system-card"><span className="system-icon api"><Activity size={18}/></span><span className="system-main"><b>Brainbight API</b><small>Express · Node.js</small></span><span className={apiUp ? "system-status" : "system-status off"}><i/>{apiUp ? "Live" : "Offline"}</span><span className="system-caption">Local demo endpoints and service health.</span></article>
          <article className="system-card"><span className="system-icon db"><Database size={18}/></span><span className="system-main"><b>PostgreSQL</b><small>Your app data, securely stored</small></span><span className={status?.database === "connected" ? "system-status" : "system-status off"}><i/>{status?.database === "connected" ? "Live" : "Pending"}</span><span className="system-caption">Local development database.</span></article>
          <article className="system-card"><span className="system-icon app"><Smartphone size={18}/></span><span className="system-main"><b>Android companion</b><small>React Native · Expo</small></span><span className="system-status pending"><i/>In development</span><span className="system-caption">Hands-free controls, when you choose.</span></article>
          <article className="system-card"><span className="system-icon voice"><AudioLines size={18}/></span><span className="system-main"><b>Gesture service</b><small>Python · MediaPipe</small></span><span className="system-status pending"><i/>Opt-in</span><span className="system-caption">Optional local hand tracking.</span></article>
        </div>
        <div className="bottom-grid">
          <section className="privacy-card" id="privacy"><div className="privacy-icon"><ShieldCheck size={20}/></div><div><b>Privacy is part of the design.</b><p>Permissions are always the user's choice.<br/>Camera and microphone don't turn on by themselves.</p><span><Check size={12}/> No hidden listening <Check size={12}/> User-controlled access</span></div><ArrowDownRight className="privacy-arrow" size={21}/></section>
          <section className="activity-card"><div className="activity-icon"><Hand size={18}/></div><div><b>Made for real life.</b><p>This local workspace is ready to personalize.</p></div></section>
        </div>
        <footer>Made with a little ✳ of heart <span>Brainbight workspace · development</span></footer>
      </div>
    </section>
  </main>;
}
