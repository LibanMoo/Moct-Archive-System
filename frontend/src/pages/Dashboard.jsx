import { useEffect, useState } from "react";
import { Archive, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Clock3, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";

const pillClass = { IN: "in", OUT: "out", INT: "int" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/documents/stats").then(r => setData(r.data)).catch(e => setError(e.response?.data?.message || "Unable to load dashboard.")); }, []);
  const stats = data?.stats || { total: 0, incoming: 0, outgoing: 0, internal: 0, pending: 0, archived: 0 };
  const cards = [
    { label: "Active documents", value: stats.total, icon: FileText, color: "blue" },
    { label: "Incoming documents", value: stats.incoming, icon: ArrowDownToLine, color: "cyan" },
    { label: "Outgoing documents", value: stats.outgoing, icon: ArrowUpFromLine, color: "green" },
    { label: "Internal documents", value: stats.internal ?? 0, icon: ArrowLeftRight, color: "purple" },
    { label: "Awaiting action", value: stats.pending, icon: Clock3, color: "orange" },
    { label: "Archived records", value: stats.archived, icon: Archive, color: "purple" }
  ];
  const quick = [
    { to: "/incoming", cls: "incoming", icon: ArrowDownToLine, title: "Register incoming mail", text: "Record a letter or document received." },
    { to: "/outgoing", cls: "outgoing", icon: ArrowUpFromLine, title: "Register outgoing mail", text: "Record correspondence being sent." },
    { to: "/internal", cls: "internal", icon: ArrowLeftRight, title: "Register internal document", text: "Record a document between departments." },
    { to: "/archive", cls: "archive", icon: Archive, title: "Browse digital archive", text: "Find and retrieve archived records." }
  ];
  return <div><div className="page-heading"><div><div className="eyebrow">OVERVIEW / WORKSPACE</div><h1>Dashboard</h1><p>Monitor document activity and access your records.</p></div></div>
    {error && <div className="alert error">{error}</div>}
    <div className="stats-grid six">{cards.map(({ label, value, icon: Icon, color }) => <div className="stat-card" key={label}><div className={`stat-icon ${color}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-footer">Live database count</div></div>)}</div>
    <div className="quick-grid four">{quick.map(({ to, cls, icon: Icon, title, text }) => <Link key={to} to={to} className="quick-card"><div className={`quick-icon ${cls}`}><Icon size={21}/></div><div><strong>{title}</strong><p>{text}</p></div><span>→</span></Link>)}</div>
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Recent documents</h2><p>Latest registered records</p></div></div><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Direction</th><th>Subject</th><th>Status</th><th>Registered</th></tr></thead><tbody>{(data?.recent || []).map(d => <tr key={d.id}><td><span className="reference">{d.referenceNumber}</span></td><td><span className={`direction-pill ${pillClass[d.direction] || "in"}`}>{d.direction}</span></td><td>{d.subject}</td><td><span className={`status status-${d.status.toLowerCase()}`}>{d.status}</span></td><td>{new Date(d.createdAt).toLocaleDateString()}</td></tr>)}{data && data.recent.length === 0 && <tr><td colSpan="5">No documents have been registered yet.</td></tr>}</tbody></table></div></div>
  </div>;
}
