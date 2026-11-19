import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ministryLogo from "../assets/ministry-logo.png";
import "./login.css";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.message || "Unable to sign in. Check the API connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lg-page">
      <div className="lg-star lg-star-a" />
      <div className="lg-star lg-star-b" />

      <section className="lg-card">
        <aside className="lg-left">
          <div className="lg-left-star" />
          <div className="lg-logo-circle">
            <img src={ministryLogo} alt="Astaanta Wasaaradda Isgaarsiinta iyo Teknolojiyadda" />
          </div>
          <h2>Archive & Document Management System</h2>
          <i className="lg-gold-line" />
          <p>Maareynta Dukumentiyada iyo Kaydka Wasaaradda</p>
          <small>JAMHUURIYADDA FEDERAALKA SOOMAALIYA</small>
        </aside>

        <div className="lg-right">
          <h1>Ku soo dhawoow</h1>
          <i className="lg-gold-line lg-gold-left" />
          <p className="lg-sub">Sign in to securely access and manage official ministry records.</p>

          {error && <div className="lg-alert" role="alert">{error}</div>}

          <form onSubmit={submit} className="lg-form">
            <div className="lg-field">
              <User size={17} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="name@ministry.gov.so" aria-label="Email address" required />
            </div>
            <div className="lg-field">
              <Lock size={17} />
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" aria-label="Password" required />
              <button type="button" className="lg-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button className="lg-submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in securely"} {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="lg-footnote"><ShieldCheck size={15} /> Restricted access for authorised ministry personnel</div>
          <div className="lg-copyright">Federal Republic of Somalia · Ministry of Communications & Technology</div>
        </div>
      </section>
    </main>
  );
}
