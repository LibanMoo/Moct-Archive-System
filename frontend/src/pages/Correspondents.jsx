import { useEffect, useState } from "react";
import { Contact, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", phone: "", email: "", address: "" };

export default function Correspondents() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { const { data } = await api.get("/correspondents"); setItems(data.correspondents || []); }
    catch (e) { setError(e.response?.data?.message || "Unable to load senders and recipients."); }
  }
  useEffect(() => { load(); }, []);

  function close() { setShow(false); setEditing(null); setForm(emptyForm); }

  function startCreate() { setEditing(null); setForm(emptyForm); setError(""); setShow(true); }

  function startEdit(c) {
    setEditing(c);
    setForm({ name: c.name || "", phone: c.phone || "", email: c.email || "", address: c.address || "" });
    setError(""); setShow(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (editing) { await api.patch(`/correspondents/${editing.id}`, form); setMessage(`${form.name} updated.`); }
      else { await api.post("/correspondents", form); setMessage(`${form.name} added.`); }
      close(); await load();
    } catch (e) { setError(e.response?.data?.message || "Could not save."); }
    finally { setBusy(false); }
  }

  async function toggle(c) {
    setError(""); setMessage("");
    try {
      await api.patch(`/correspondents/${c.id}`, { active: !c.active });
      setMessage(`${c.name} is now ${c.active ? "inactive (hidden from the registration list)" : "active"}.`);
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not update."); }
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    setError(""); setMessage("");
    try { await api.delete(`/correspondents/${c.id}`); setMessage(`${c.name} deleted.`); await load(); }
    catch (e) { setError(e.response?.data?.message || "Could not delete."); }
  }

  const term = q.trim().toLowerCase();
  const shown = term ? items.filter(c => [c.name, c.phone, c.email, c.address].some(v => v?.toLowerCase().includes(term))) : items;

  return <div>
    <div className="page-heading"><div><div className="eyebrow">REGISTRY / CONTACTS</div><h1>Senders & Recipients</h1><p>Organisations and people that send documents to, or receive documents from, the ministry.</p></div>
      <button className="primary-button" onClick={show ? close : startCreate}><Plus size={17}/> Add sender / recipient</button>
    </div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {show && <form className="panel form-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>{editing ? `Edit ${editing.name}` : "New sender / recipient"}</h2><p>The name appears in the list when registering incoming and outgoing documents.</p></div><button type="button" className="icon-button" title="Close form" onClick={close}><X size={17}/></button></div>
      <div className="form-grid">
        <label>Name *<input required maxLength="200" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ministry of Finance" /></label>
        <label>Phone<input maxLength="50" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input type="email" maxLength="200" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Address<input maxLength="300" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Update" : "Save"}</button></div>
    </form>}
    <div className="toolbar panel"><div className="search-box"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, email..." /></div></div>
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Registered senders & recipients</h2><p>{shown.length} record(s)</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Documents</th><th>Status</th>{isAdmin && <th>Actions</th>}</tr></thead>
        <tbody>{shown.map(c => <tr key={c.id}>
          <td><strong>{c.name}</strong>{c.address && <small>{c.address}</small>}</td>
          <td>{c.phone || "—"}</td>
          <td>{c.email || "—"}</td>
          <td>{c.sentCount} in · {c.receivedCount} out</td>
          <td><span className={`status ${c.active ? "status-completed" : "status-pending"}`}>{c.active ? "Active" : "Inactive"}</span></td>
          {isAdmin && <td><div className="user-actions">
            <button className="icon-button" title="Edit" onClick={() => startEdit(c)}><Pencil size={15}/></button>
            <button className="secondary-button small-button" onClick={() => toggle(c)}>{c.active ? "Deactivate" : "Activate"}</button>
            <button className="danger-button small-button" onClick={() => remove(c)} disabled={c.sentCount + c.receivedCount > 0} title={c.sentCount + c.receivedCount > 0 ? "Used by documents — deactivate instead" : "Delete"}><Trash2 size={14}/>Delete</button>
          </div></td>}
        </tr>)}
        {shown.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5}><div className="empty-state"><Contact size={24}/><strong>No senders or recipients yet.</strong><span>Add one here or directly from the document registration form.</span></div></td></tr>}</tbody></table></div>
    </div>
  </div>;
}
