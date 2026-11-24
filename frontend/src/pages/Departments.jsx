import { useEffect, useState } from "react";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Departments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { const { data } = await api.get("/departments"); setItems(data.departments || []); }
    catch (e) { setError(e.response?.data?.message || "Unable to load departments."); }
  }
  useEffect(() => { load(); }, []);

  function close() { setShow(false); setEditing(null); setName(""); }
  function startCreate() { setEditing(null); setName(""); setError(""); setShow(true); }
  function startEdit(d) { setEditing(d); setName(d.name); setError(""); setShow(true); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (editing) { await api.patch(`/departments/${editing.id}`, { name }); setMessage(`Renamed to ${name.trim()}.`); }
      else { await api.post("/departments", { name }); setMessage(`${name.trim()} added.`); }
      close(); await load();
    } catch (e) { setError(e.response?.data?.message || "Could not save."); }
    finally { setBusy(false); }
  }

  async function remove(d) {
    if (!window.confirm(`Delete the ${d.name} department? This cannot be undone.`)) return;
    setError(""); setMessage("");
    try { await api.delete(`/departments/${d.id}`); setMessage(`${d.name} deleted.`); await load(); }
    catch (e) { setError(e.response?.data?.message || "Could not delete."); }
  }

  const used = d => d.userCount + d.documentCount + d.internalSentCount + d.internalReceivedCount > 0;

  return <div>
    <div className="page-heading"><div><div className="eyebrow">REGISTRY / ORGANISATION</div><h1>Departments</h1><p>Ministry departments used for staff, documents and internal correspondence.</p></div>
      <button className="primary-button" onClick={show ? close : startCreate}><Plus size={17}/> Add department</button>
    </div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {show && <form className="panel form-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>{editing ? `Rename ${editing.name}` : "New department"}</h2><p>Renaming also updates the department name shown on existing documents.</p></div><button type="button" className="icon-button" title="Close form" onClick={close}><X size={17}/></button></div>
      <div className="form-grid"><label>Department name *<input required maxLength="150" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance & Administration" /></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Rename" : "Save"}</button></div>
    </form>}
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Registered departments</h2><p>{items.length} department(s)</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Department</th><th>Staff</th><th>Incoming / outgoing docs</th><th>Internal sent</th><th>Internal received</th>{isAdmin && <th>Actions</th>}</tr></thead>
        <tbody>{items.map(d => <tr key={d.id}>
          <td><strong>{d.name}</strong></td><td>{d.userCount}</td><td>{d.documentCount}</td><td>{d.internalSentCount}</td><td>{d.internalReceivedCount}</td>
          {isAdmin && <td><div className="user-actions">
            <button className="icon-button" title="Rename" onClick={() => startEdit(d)}><Pencil size={15}/></button>
            <button className="danger-button small-button" onClick={() => remove(d)} disabled={used(d)} title={used(d) ? "Used by staff or documents" : "Delete"}><Trash2 size={14}/>Delete</button>
          </div></td>}
        </tr>)}
        {items.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5}><div className="empty-state"><Building2 size={24}/><strong>No departments yet.</strong></div></td></tr>}</tbody></table></div>
    </div>
  </div>;
}
