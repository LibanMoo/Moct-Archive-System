import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Archive, ArrowDownToLine, ArrowUpFromLine, LayoutDashboard, Users, ScrollText, LogOut, Building2, ChartNoAxesCombined, Contact, ArrowLeftRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ministryLogo from "../assets/ministry-logo.png";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function signOut() { logout(); navigate("/login"); }
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/incoming", label: "Incoming Documents", icon: ArrowDownToLine },
    { to: "/outgoing", label: "Outgoing Documents", icon: ArrowUpFromLine },
    { to: "/internal", label: "Internal Documents", icon: ArrowLeftRight },
    { to: "/archive", label: "Digital Archive", icon: Archive },
    { to: "/correspondents", label: "Senders & Recipients", icon: Contact },
    { to: "/departments", label: "Departments", icon: Building2 },
    { to: "/reports/incoming", label: "Incoming Reports", icon: ChartNoAxesCombined },
    { to: "/reports/outgoing", label: "Outgoing Reports", icon: ChartNoAxesCombined },
    { to: "/reports/internal", label: "Internal Reports", icon: ChartNoAxesCombined }
  ];
  if (user?.role === "admin") nav.push(
    { to: "/users", label: "User Management", icon: Users },
    { to: "/audit-logs", label: "Audit Logs", icon: ScrollText }
  );

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img className="sidebar-seal" src={ministryLogo} alt="Somalia Ministry emblem"/><div><strong>ARCHIVE & DMS</strong><small>Ministry of Communications</small></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{user?.name?.slice(0,1)?.toUpperCase()}</div><div className="user-mini-text"><strong>{user?.name}</strong><small>{user?.role}</small></div></div><button className="logout-button" onClick={signOut}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="topbar-kicker">ARCHIVE MANAGEMENT</span><strong>Records Workspace</strong></div><div className="topbar-user"><span className="status-dot"></span>{user?.department || "Administration"}</div></header>
      <section className="page-content"><Outlet /></section>
    </main>
  </div>;
}
