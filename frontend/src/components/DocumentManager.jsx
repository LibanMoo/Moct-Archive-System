import { useEffect, useState } from "react";
import { Search, Upload, Archive, Download, RefreshCw, FileText, Pencil, Trash2, X } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const makeBlank = () => ({ subject: "", description: "", sender: "", recipient: "", department: "", documentDate: new Date().toISOString().slice(0, 10), status: "Pending" });

export default function DocumentManager({ direction, archived = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [documents, setDocuments] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(makeBlank);
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const params = { archived: String(archived) };
      if (direction) params.direction = direction;
      if (q.trim()) params.q = q.trim();
      if (status) params.status = status;
      const { data } = await api.get("/documents", { params });
      setDocuments(data.documents || []);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load documents.");
    }
  }

  useEffect(() => { load(); }, [direction, archived, q, status]);

  function updateForm(e) { setForm(previous => ({ ...previous, [e.target.name]: e.target.value })); }

  function startCreate() {
    setEditing(null);
    setForm(makeBlank());
    setFile(null);
    setError("");
    setShowForm(true);
  }

  function startEdit(doc) {
    setEditing(doc);
    setForm({
      subject: doc.subject || "",
      description: doc.description || "",
      sender: doc.sender || "",
      recipient: doc.recipient || "",
      department: doc.department || "",
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: doc.status || "Pending"
    });
    setFile(null);
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (!editing) body.append("direction", direction || "IN");
      if (file) body.append("file", file);

      if (editing) {
        await api.patch(`/documents/${editing._id}`, body);
        setMessage("Document updated successfully.");
      } else {
        await api.post("/documents", body);
        setMessage("Document registered successfully.");
      }
      setForm(makeBlank()); setFile(null); setEditing(null); setShowForm(false);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || `Could not ${editing ? "update" : "save"} document.`);
    } finally { setBusy(false); }
  }

  async function archiveDoc(doc, archivedValue) {
    setError(""); setMessage("");
    try {
      await api.patch(`/documents/${doc._id}/archive`, { archived: archivedValue });
      setMessage(archivedValue ? "Document moved to archive." : "Document restored from archive.");
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not update archive status."); }
  }

  async function deleteDoc(doc) {
    const confirmed = window.confirm(`Ma hubtaa inaad si joogto ah u tirtirayso ${doc.referenceNumber} — ${doc.subject}? Faylka ku lifaaqan sidoo kale waa la tirtirayaa.`);
    if (!confirmed) return;
    setError(""); setMessage("");
    try {
      await api.delete(`/documents/${doc._id}`);
      if (editing?._id === doc._id) { setEditing(null); setShowForm(false); }
      setMessage(`Document ${doc.referenceNumber} deleted successfully.`);
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not delete document."); }
  }

  async function download(doc) {
    try {
      const response = await api.get(`/documents/${doc._id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a"); a.href = url; a.download = doc.originalFileName || "document"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.response?.data?.message || "Download failed."); }
  }

  const title = archived ? "Digital Archive" : direction === "IN" ? "Incoming Documents" : "Outgoing Documents";
  const subtitle = archived ? "Search and retrieve archived records." : direction === "IN" ? "Register and track correspondence received by the organisation." : "Register and track correspondence sent by the organisation.";
  const formDirection = editing?.direction || direction;

  return <div>
    <div className="page-heading"><div><div className="eyebrow">DOCUMENTS / {archived ? "ARCHIVE" : direction}</div><h1>{title}</h1><p>{subtitle}</p></div>
      {!archived && <button className="primary-button" onClick={showForm ? () => { setShowForm(false); setEditing(null); } : startCreate}><Upload size={17}/> Register document</button>}
    </div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {showForm && <form className="panel form-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>{editing ? `Edit ${editing.referenceNumber}` : `Register ${formDirection} document`}</h2><p>{editing ? "Update record details or attach a replacement file." : "Enter the record details and optionally attach a file."}</p></div><button type="button" className="icon-button" title="Close form" onClick={() => { setShowForm(false); setEditing(null); }}><X size={17}/></button></div>
      <div className="form-grid">
        <label>Subject *<input name="subject" value={form.subject} onChange={updateForm} required maxLength="250" /></label>
        <label>{formDirection === "IN" ? "Sender" : "Recipient"}<input name={formDirection === "IN" ? "sender" : "recipient"} value={formDirection === "IN" ? form.sender : form.recipient} onChange={updateForm} /></label>
        <label>Department<input name="department" value={form.department} onChange={updateForm} /></label>
        <label>Document date<input type="date" name="documentDate" value={form.documentDate} onChange={updateForm} /></label>
        <label>Status<select name="status" value={form.status} onChange={updateForm}><option>Pending</option><option>Processing</option><option>Completed</option></select></label>
        <label>Attach file<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /><small>Allowed: PDF, Word, Excel, JPG, PNG. Max 15 MB. Leave blank to keep the existing file.</small></label>
        <label className="full-field">Description<textarea name="description" value={form.description} onChange={updateForm} rows="3" /></label>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Update document" : "Save document"}</button></div>
    </form>}
    <div className="toolbar panel">
      <div className="search-box"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject, reference, sender..." /></div>
      <select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option>Pending</option><option>Processing</option><option>Completed</option></select>
      <button className="icon-button" title="Refresh" onClick={load}><RefreshCw size={17}/></button>
    </div>
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Document register</h2><p>{documents.length} record(s) shown</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Subject</th><th>{direction === "OUT" ? "Recipient" : "Sender"}</th><th>Department</th><th>Status</th><th>Date</th><th>File / Actions</th></tr></thead>
      <tbody>{documents.map(doc => <tr key={doc._id}><td><span className="reference">{doc.referenceNumber}</span><small className="direction-tag">{doc.direction}</small></td><td><strong>{doc.subject}</strong><small>{doc.description?.slice(0, 70)}</small></td><td>{doc.direction === "OUT" ? doc.recipient || "—" : doc.sender || "—"}</td><td>{doc.department || "—"}</td><td><span className={`status status-${doc.status.toLowerCase()}`}>{doc.status}</span></td><td>{new Date(doc.documentDate).toLocaleDateString()}</td><td><div className="action-row">
        {doc.storedFileName && <button className="icon-button" title="Download file" onClick={() => download(doc)}><Download size={16}/></button>}
        <button className="icon-button" title="Edit document" onClick={() => startEdit(doc)}><Pencil size={16}/></button>
        <button className="icon-button" title={archived ? "Restore" : "Archive"} onClick={() => archiveDoc(doc, !archived)}><Archive size={16}/></button>
        {isAdmin && <button className="icon-button" title="Delete document" onClick={() => deleteDoc(doc)}><Trash2 size={16}/></button>}
      </div></td></tr>)}
      {documents.length === 0 && <tr><td colSpan="7"><div className="empty-state"><FileText size={28}/><strong>No documents found</strong><span>Try a different search or register a new document.</span></div></td></tr>}</tbody></table></div>
    </div>
  </div>;
}
