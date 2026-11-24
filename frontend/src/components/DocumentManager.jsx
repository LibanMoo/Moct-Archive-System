import { useEffect, useState } from "react";
import { Search, Upload, Archive, Download, RefreshCw, FileText, Pencil, Trash2, X, Plus } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const makeBlank = () => ({ subject: "", description: "", senderId: "", recipientId: "", departmentId: "", fromDepartmentId: "", toDepartmentId: "", documentDate: today(), status: "Pending" });

// Which id fields each kind of document uses.
const FIELDS_BY_DIRECTION = {
  IN: ["senderId", "departmentId"],
  OUT: ["recipientId", "departmentId"],
  INT: ["fromDepartmentId", "toDepartmentId"],
};
const ID_FIELDS = ["senderId", "recipientId", "departmentId", "fromDepartmentId", "toDepartmentId"];

const PAGE_TEXT = {
  IN: ["Incoming Documents", "Register and track correspondence received by the organisation."],
  OUT: ["Outgoing Documents", "Register and track correspondence sent by the organisation."],
  INT: ["Internal Documents", "Register and track documents exchanged between ministry departments."],
};

// A dropdown with an inline "add new" shortcut.
function PickerField({ label, name, value, options, onChange, onAdd, required }) {
  const [adding, setAdding] = useState(null); // null = closed
  async function add() {
    const text = (adding || "").trim();
    if (!text) return;
    if (await onAdd(text, name)) setAdding(null);
  }
  return <label>{label}{required && " *"}
    <select name={name} value={value} onChange={onChange} required={required}>
      <option value="">— Select {label.toLowerCase()} —</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}{o.active === false ? " (inactive)" : ""}</option>)}
    </select>
    {adding === null
      ? <small><button type="button" className="link-button" onClick={() => setAdding("")}><Plus size={12}/> Not in the list? Add new</button></small>
      : <span className="quick-add">
          <input autoFocus value={adding} onChange={e => setAdding(e.target.value)} placeholder="New name" maxLength="200"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(null); }} />
          <button type="button" className="secondary-button small-button" onClick={add}>Add</button>
          <button type="button" className="icon-button" title="Cancel" onClick={() => setAdding(null)}><X size={14}/></button>
        </span>}
  </label>;
}

function partyText(doc) {
  if (doc.direction === "INT") return `${doc.fromDepartment?.name || "—"} → ${doc.toDepartment?.name || "—"}`;
  return (doc.direction === "OUT" ? doc.recipient : doc.sender) || "—";
}

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
  const [departments, setDepartments] = useState([]);
  const [correspondentId, setCorrespondentId] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState(""); // archive only

  // On the archive page the direction comes from the filter.
  const listDirection = direction || directionFilter;

  async function loadLists() {
    // Lists are optional; the page still works if one fails.
    const [c, d] = await Promise.allSettled([api.get("/correspondents"), api.get("/departments")]);
    if (c.status === "fulfilled") setCorrespondents(c.value.data.correspondents || []);
    if (d.status === "fulfilled") setDepartments(d.value.data.departments || []);
  }
  useEffect(() => { loadLists(); }, []);

  async function load() {
    try {
      setError("");
      const params = { archived: String(archived) };
      if (listDirection) params.direction = listDirection;
      if (q.trim()) params.q = q.trim();
      if (status) params.status = status;
      if (correspondentId && listDirection !== "INT") params.correspondentId = correspondentId;
      if (departmentFilter) params.departmentId = departmentFilter;
      const { data } = await api.get("/documents", { params });
      setDocuments(data.documents || []);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load documents.");
    }
  }

  useEffect(() => { load(); }, [listDirection, archived, q, status, correspondentId, departmentFilter]);
  useEffect(() => { setCorrespondentId(""); setDepartmentFilter(""); setDirectionFilter(""); }, [direction, archived]);

  // Quick-add from a form dropdown. Returns true on success.
  async function quickAdd(name, field) {
    setError("");
    const isDepartment = field.toLowerCase().includes("department");
    try {
      if (isDepartment) {
        const { data } = await api.post("/departments", { name });
        setForm(prev => ({ ...prev, [field]: data.department.id }));
      } else {
        const { data } = await api.post("/correspondents", { name });
        setForm(prev => ({ ...prev, [field]: data.correspondent.id }));
      }
      await loadLists();
      return true;
    } catch (e) {
      setError(e.response?.data?.message || "Could not add.");
      return false;
    }
  }

  function updateForm(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }

  function closeForm() { setShowForm(false); setEditing(null); }

  function startCreate() {
    setEditing(null); setForm(makeBlank()); setFile(null); setError(""); setShowForm(true);
  }

  function startEdit(doc) {
    setEditing(doc);
    setForm({
      subject: doc.subject || "",
      description: doc.description || "",
      senderId: doc.senderId || "",
      recipientId: doc.recipientId || "",
      departmentId: doc.departmentId || "",
      fromDepartmentId: doc.fromDepartmentId || "",
      toDepartmentId: doc.toDepartmentId || "",
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().slice(0, 10) : today(),
      status: doc.status || "Pending",
    });
    setFile(null); setError(""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const formDirection = editing?.direction || direction;
  const usedFields = FIELDS_BY_DIRECTION[formDirection] || [];

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (ID_FIELDS.includes(key)) {
          if (!usedFields.includes(key)) continue;
          // When editing, only send a dropdown if it changed, so older records
          // that only have a typed name keep it.
          if (editing && (value || "") === (editing[key] || "")) continue;
        }
        body.append(key, value);
      }
      if (!editing) body.append("direction", direction);
      if (file) body.append("file", file);

      if (editing) {
        await api.patch(`/documents/${editing.id}`, body);
        setMessage("Document updated successfully.");
      } else {
        await api.post("/documents", body);
        setMessage("Document registered successfully.");
      }
      setForm(makeBlank()); setFile(null); closeForm();
      await Promise.all([load(), loadLists()]);
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
      if (editing?.id === doc.id) closeForm();
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

  const [title, subtitle] = archived ? ["Digital Archive", "Search and retrieve archived records."] : PAGE_TEXT[direction] || PAGE_TEXT.IN;
  // Active entries, plus the one already chosen even if it was deactivated later.
  const activeParties = field => correspondents.filter(c => c.active || c.id === form[field]);
  const partyHeader = listDirection === "IN" ? "Sender" : listDirection === "OUT" ? "Recipient" : listDirection === "INT" ? "From → To" : "Sender / Recipient / Departments";
  const correspondentFilterLabel = listDirection === "IN" ? "All senders" : listDirection === "OUT" ? "All recipients" : "All senders & recipients";

  return <div>
    <div className="page-heading"><div><div className="eyebrow">DOCUMENTS / {archived ? "ARCHIVE" : direction}</div><h1>{title}</h1><p>{subtitle}</p></div>
      {!archived && <button className="primary-button" onClick={showForm ? closeForm : startCreate}><Upload size={17}/> Register document</button>}
    </div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {showForm && <form className="panel form-panel" onSubmit={submit}>
      <div className="panel-heading"><div><h2>{editing ? `Edit ${editing.referenceNumber}` : `Register ${formDirection} document`}</h2><p>{editing ? "Update record details or attach a replacement file." : "Enter the record details and optionally attach a file."}</p></div><button type="button" className="icon-button" title="Close form" onClick={closeForm}><X size={17}/></button></div>
      <div className="form-grid">
        <label>Subject *<input name="subject" value={form.subject} onChange={updateForm} required maxLength="250" /></label>
        {formDirection === "IN" && <PickerField label="Sender" name="senderId" value={form.senderId} options={activeParties("senderId")} onChange={updateForm} onAdd={quickAdd} />}
        {formDirection === "OUT" && <PickerField label="Recipient" name="recipientId" value={form.recipientId} options={activeParties("recipientId")} onChange={updateForm} onAdd={quickAdd} />}
        {formDirection === "INT" && <>
          <PickerField label="From department" name="fromDepartmentId" value={form.fromDepartmentId} options={departments} onChange={updateForm} onAdd={quickAdd} required />
          <PickerField label="To department" name="toDepartmentId" value={form.toDepartmentId} options={departments} onChange={updateForm} onAdd={quickAdd} required />
        </>}
        {formDirection !== "INT" && <PickerField label="Department" name="departmentId" value={form.departmentId} options={departments} onChange={updateForm} onAdd={quickAdd} />}
        <label>Document date<input type="date" name="documentDate" value={form.documentDate} onChange={updateForm} /></label>
        <label>Status<select name="status" value={form.status} onChange={updateForm}><option>Pending</option><option>Processing</option><option>Completed</option></select></label>
        <label>Attach file<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /><small>Allowed: PDF, Word, Excel, JPG, PNG. Max 15 MB. Leave blank to keep the existing file.</small></label>
        <label className="full-field">Description<textarea name="description" value={form.description} onChange={updateForm} rows="3" /></label>
      </div>
      {editing && formDirection !== "INT" && !editing.departmentId && editing.department && <p className="form-note">Current department (typed earlier): <strong>{editing.department}</strong>. Pick one from the list to replace it.</p>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Update document" : "Save document"}</button></div>
    </form>}
    <div className="toolbar panel">
      <div className="search-box"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject, reference, sender..." /></div>
      {archived && <select value={directionFilter} onChange={e => { setDirectionFilter(e.target.value); setCorrespondentId(""); }} title="Filter by type">
        <option value="">All types</option><option value="IN">Incoming</option><option value="OUT">Outgoing</option><option value="INT">Internal</option>
      </select>}
      <select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option>Pending</option><option>Processing</option><option>Completed</option></select>
      {listDirection !== "INT" && <select value={correspondentId} onChange={e => setCorrespondentId(e.target.value)} title="Filter by sender / recipient">
        <option value="">{correspondentFilterLabel}</option>
        {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
      <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} title="Filter by department">
        <option value="">All departments</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <button className="icon-button" title="Refresh" onClick={load}><RefreshCw size={17}/></button>
    </div>
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Document register</h2><p>{documents.length} record(s) shown</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Subject</th><th>{partyHeader}</th><th>Department</th><th>Status</th><th>Date</th><th>File / Actions</th></tr></thead>
      <tbody>{documents.map(doc => <tr key={doc.id}><td><span className="reference">{doc.referenceNumber}</span><small className="direction-tag">{doc.direction}</small></td><td><strong>{doc.subject}</strong><small>{doc.description?.slice(0, 70)}</small></td><td>{partyText(doc)}</td><td>{doc.direction === "INT" ? "—" : doc.department || "—"}</td><td><span className={`status status-${doc.status.toLowerCase()}`}>{doc.status}</span></td><td>{new Date(doc.documentDate).toLocaleDateString()}</td><td><div className="action-row">
        {doc.storedFileName && <button className="icon-button" title="Download file" onClick={() => download(doc)}><Download size={16}/></button>}
        <button className="icon-button" title="Edit document" onClick={() => startEdit(doc)}><Pencil size={16}/></button>
        <button className="icon-button" title={archived ? "Restore" : "Archive"} onClick={() => archiveDoc(doc, !archived)}><Archive size={16}/></button>
        {isAdmin && <button className="icon-button" title="Delete document" onClick={() => deleteDoc(doc)}><Trash2 size={16}/></button>}
      </div></td></tr>)}
      {documents.length === 0 && <tr><td colSpan="7"><div className="empty-state"><FileText size={28}/><strong>No documents found</strong><span>Try a different search or register a new document.</span></div></td></tr>}</tbody></table></div>
    </div>
  </div>;
}
