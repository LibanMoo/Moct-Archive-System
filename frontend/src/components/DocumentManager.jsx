import { useEffect, useState } from "react";
import { Search, Upload, Archive, Download, RefreshCw, FileText, Pencil, Trash2, X, Plus } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const makeBlank = () => ({ subject: "", description: "", senderId: "", recipientId: "", department: "", documentDate: new Date().toISOString().slice(0, 10), status: "Pending" });

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
  const [correspondents, setCorrespondents] = useState([]);
  const [correspondentId, setCorrespondentId] = useState("");
  const [quickName, setQuickName] = useState(null); // null = quick-add closed

  async function loadCorrespondents() {
    try {
      const { data } = await api.get("/correspondents");
      setCorrespondents(data.correspondents || []);
    } catch { /* list is optional; the form still works without it */ }
  }

  useEffect(() => { loadCorrespondents(); }, []);

  async function load() {
    try {
      setError("");
      const params = { archived: String(archived) };
      if (direction) params.direction = direction;
      if (q.trim()) params.q = q.trim();
      if (status) params.status = status;
      if (correspondentId) params.correspondentId = correspondentId;
      const { data } = await api.get("/documents", { params });
      setDocuments(data.documents || []);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load documents.");
    }
  }

  useEffect(() => { load(); }, [direction, archived, q, status, correspondentId]);
  useEffect(() => { setCorrespondentId(""); }, [direction, archived]);

  async function quickAddCorrespondent(field) {
    const name = (quickName || "").trim();
    if (!name) return;
    setError("");
    try {
      const { data } = await api.post("/correspondents", { name });
      await loadCorrespondents();
      setForm(previous => ({ ...previous, [field]: data.correspondent.id }));
      setQuickName(null);
    } catch (e) { setError(e.response?.data?.message || "Could not add sender/recipient."); }
  }

  function updateForm(e) { setForm(previous => ({ ...previous, [e.target.name]: e.target.value })); }

  function startCreate() {
    setEditing(null);
    setForm(makeBlank());
    setFile(null);
    setError("");
    setQuickName(null);
    setShowForm(true);
  }

  function startEdit(doc) {
    setEditing(doc);
    setForm({
      subject: doc.subject || "",
      description: doc.description || "",
      senderId: doc.senderId || "",
      recipientId: doc.recipientId || "",
      department: doc.department || "",
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: doc.status || "Pending"
    });
    setFile(null);
    setError("");
    setQuickName(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      // Incoming documents have a sender, outgoing ones a recipient.
      const skip = formDirection === "IN" ? "recipientId" : "senderId";
      // When editing, only send the sender/recipient if it was changed, so older
      // records that only have a typed name keep it.
      const unchanged = editing && (form[partyField] || "") === (editing[partyField] || "");
      Object.entries(form).forEach(([key, value]) => {
        if (key === skip || (key === partyField && unchanged)) return;
        body.append(key, value);
      });
      if (!editing) body.append("direction", direction || "IN");
      if (file) body.append("file", file);

      if (editing) {
        await api.patch(`/documents/${editing.id}`, body);
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
      await api.patch(`/documents/${doc.id}/archive`, { archived: archivedValue });
      setMessage(archivedValue ? "Document moved to archive." : "Document restored from archive.");
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not update archive status."); }
  }

  async function deleteDoc(doc) {
    const confirmed = window.confirm(`Ma hubtaa inaad si joogto ah u tirtirayso ${doc.referenceNumber} — ${doc.subject}? Faylka ku lifaaqan sidoo kale waa la tirtirayaa.`);
    if (!confirmed) return;
    setError(""); setMessage("");
    try {
      await api.delete(`/documents/${doc.id}`);
      if (editing?.id === doc.id) { setEditing(null); setShowForm(false); }
      setMessage(`Document ${doc.referenceNumber} deleted successfully.`);
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not delete document."); }
  }

  async function download(doc) {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a"); a.href = url; a.download = doc.originalFileName || "document"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.response?.data?.message || "Download failed."); }
  }

  const title = archived ? "Digital Archive" : direction === "IN" ? "Incoming Documents" : "Outgoing Documents";
  const subtitle = archived ? "Search and retrieve archived records." : direction === "IN" ? "Register and track correspondence received by the organisation." : "Register and track correspondence sent by the organisation.";
  const formDirection = editing?.direction || direction;
  const partyField = formDirection === "IN" ? "senderId" : "recipientId";
  const partyLabel = formDirection === "IN" ? "Sender" : "Recipient";
  // Active entries, plus the currently selected one even if it was deactivated later.
  const formParties = correspondents.filter(c => c.active || c.id === form[partyField]);
  const filterLabel = direction === "IN" ? "All senders" : direction === "OUT" ? "All recipients" : "All senders & recipients";

  return <div>
    <div className="page-heading"><div><div className="eyebrow">DOCUMENTS / {archived ? "ARCHIVE" : direction}</div><h1>{title}</h1><p>{subtitle}</p></div>
      {!archived && <button className="primary-button" onClick={showForm ? () => { setShowForm(false); setEditing(null); } : startCreate}><Upload size={17}/> Register document</button>}
    </div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {showForm && <form className="panel form-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>{editing ? `Edit ${editing.referenceNumber}` : `Register ${formDirection} document`}</h2><p>{editing ? "Update record details or attach a replacement file." : "Enter the record details and optionally attach a file."}</p></div><button type="button" className="icon-button" title="Close form" onClick={() => { setShowForm(false); setEditing(null); }}><X size={17}/></button></div>
      <div className="form-grid">
        <label>Subject *<input name="subject" value={form.subject} onChange={updateForm} required maxLength="250" /></label>
        <label>{partyLabel}
          <select name={partyField} value={form[partyField]} onChange={updateForm}>
            <option value="">— Select {partyLabel.toLowerCase()} —</option>
            {formParties.map(c => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactive)"}</option>)}
          </select>
          {quickName === null
            ? <small><button type="button" className="link-button" onClick={() => setQuickName("")}><Plus size={12}/> Not in the list? Add new {partyLabel.toLowerCase()}</button></small>
            : <span className="quick-add">
                <input autoFocus value={quickName} onChange={e => setQuickName(e.target.value)} placeholder={`New ${partyLabel.toLowerCase()} name`} maxLength="200"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); quickAddCorrespondent(partyField); } if (e.key === "Escape") setQuickName(null); }} />
                <button type="button" className="secondary-button small-button" onClick={() => quickAddCorrespondent(partyField)}>Add</button>
                <button type="button" className="icon-button" title="Cancel" onClick={() => setQuickName(null)}><X size={14}/></button>
              </span>}
        </label>
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
      <select value={correspondentId} onChange={e => setCorrespondentId(e.target.value)} title="Filter by sender / recipient">
        <option value="">{filterLabel}</option>
        {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="icon-button" title="Refresh" onClick={load}><RefreshCw size={17}/></button>
    </div>
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Document register</h2><p>{documents.length} record(s) shown</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Subject</th><th>{direction === "OUT" ? "Recipient" : "Sender"}</th><th>Department</th><th>Status</th><th>Date</th><th>File / Actions</th></tr></thead>
      <tbody>{documents.map(doc => <tr key={doc.id}><td><span className="reference">{doc.referenceNumber}</span><small className="direction-tag">{doc.direction}</small></td><td><strong>{doc.subject}</strong><small>{doc.description?.slice(0, 70)}</small></td><td>{doc.direction === "OUT" ? doc.recipient || "—" : doc.sender || "—"}</td><td>{doc.department || "—"}</td><td><span className={`status status-${doc.status.toLowerCase()}`}>{doc.status}</span></td><td>{new Date(doc.documentDate).toLocaleDateString()}</td><td><div className="action-row">
        {doc.storedFileName && <button className="icon-button" title="Download file" onClick={() => download(doc)}><Download size={16}/></button>}
        <button className="icon-button" title="Edit document" onClick={() => startEdit(doc)}><Pencil size={16}/></button>
        <button className="icon-button" title={archived ? "Restore" : "Archive"} onClick={() => archiveDoc(doc, !archived)}><Archive size={16}/></button>
        {isAdmin && <button className="icon-button" title="Delete document" onClick={() => deleteDoc(doc)}><Trash2 size={16}/></button>}
      </div></td></tr>)}
      {documents.length === 0 && <tr><td colSpan="7"><div className="empty-state"><FileText size={28}/><strong>No documents found</strong><span>Try a different search or register a new document.</span></div></td></tr>}</tbody></table></div>
    </div>
  </div>;
}
