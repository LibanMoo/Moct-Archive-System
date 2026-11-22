import { useEffect, useState } from "react";
import { UserPlus, Users as UsersIcon, Trash2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", email: "", password: "", role: "staff", department: "" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");

  async function load() {
    try { const { data } = await api.get("/users"); setUsers(data.users || []); }
    catch (e) { setError(e.response?.data?.message || "Unable to load users."); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      await api.post("/users", form);
      setForm(emptyForm); setShow(false); setMessage("User created successfully."); await load();
    } catch (e) { setError(e.response?.data?.message || "Could not create user."); }
  }

  async function toggle(user) {
    setError(""); setMessage("");
    try { await api.patch(`/users/${user.id}/active`, { active: !user.active }); setMessage(`${user.name} is now ${user.active ? "inactive" : "active"}.`); await load(); }
    catch (e) { setError(e.response?.data?.message || "Could not update user."); }
  }

  async function removeUser(user) {
    const confirmed = window.confirm(`Ma hubtaa inaad si joogto ah u tirtirayso user-ka ${user.name} (${user.email})? Ficilkan lama soo celin karo.`);
    if (!confirmed) return;
    setDeleting(user.id); setError(""); setMessage("");
    try {
      await api.delete(`/users/${user.id}`);
      setMessage(`User-ka ${user.name} si guul leh ayaa loo tirtiray.`);
      await load();
    } catch (e) { setError(e.response?.data?.message || "Could not delete user."); }
    finally { setDeleting(""); }
  }

  return <div>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>User Management</h1><p>Create accounts, manage access, and permanently remove former staff.</p></div><button className="primary-button" onClick={() => setShow(!show)}><UserPlus size={17}/> Add user</button></div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {show && <form className="panel form-panel" onSubmit={submit}><div className="form-grid"><label>Full name<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><label>Email<input type="email" required value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label><label>Password (min. 10 characters)<input type="password" minLength="10" required value={form.password} onChange={e => setForm({...form,password:e.target.value})}/></label><label>Role<select value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="staff">Staff</option><option value="admin">Administrator</option></select></label><label>Department<input value={form.department} onChange={e => setForm({...form,department:e.target.value})}/></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShow(false)}>Cancel</button><button className="primary-button">Create user</button></div></form>}
    <div className="panel table-panel"><div className="panel-heading"><div><h2>Registered users</h2><p>{users.length} account(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Department</th><th>Role</th><th>Access</th><th>Actions</th></tr></thead><tbody>{users.map(u => { const isSelf = String(u.id) === String(currentUser?.id); return <tr key={u.id}><td><strong>{u.name}</strong>{isSelf && <small>Your account</small>}</td><td>{u.email}</td><td>{u.department || "—"}</td><td>{u.role}</td><td><span className={`status ${u.active ? "status-completed" : "status-pending"}`}>{u.active ? "Active" : "Inactive"}</span></td><td><div className="user-actions"><button className="secondary-button small-button" onClick={() => toggle(u)} disabled={isSelf}>{u.active ? "Deactivate" : "Activate"}</button><button className="danger-button small-button" onClick={() => removeUser(u)} disabled={isSelf || deleting === u.id} title={isSelf ? "You cannot delete your own account" : "Permanently delete user"}><Trash2 size={14}/>{deleting === u.id ? "Deleting..." : "Delete"}</button></div></td></tr>; })}{users.length === 0 && <tr><td colSpan="6"><div className="empty-state"><UsersIcon size={20}/><strong>No users found.</strong></div></td></tr>}</tbody></table></div></div>
  </div>;
}
