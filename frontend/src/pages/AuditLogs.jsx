import { useEffect, useState } from "react";
import api from "../services/api";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/audit-logs").then(r => setLogs(r.data.logs)).catch(e => setError(e.response?.data?.message || "Unable to load audit logs.")); }, []);
  return <div><div className="page-heading"><div><div className="eyebrow">SECURITY / OVERSIGHT</div><h1>Audit Logs</h1><p>Review document activity recorded by the system.</p></div></div>{error && <div className="alert error">{error}</div>}<div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Date/time</th><th>User</th><th>Action</th><th>Document</th><th>Details</th></tr></thead><tbody>{logs.map(log => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actor?.name || "System"}</td><td>{log.action}</td><td>{log.document?.referenceNumber || "—"}</td><td>{log.details}</td></tr>)}{logs.length === 0 && <tr><td colSpan="5">No audit events found.</td></tr>}</tbody></table></div></div></div>;
}
