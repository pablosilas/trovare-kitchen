import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      const msg = err.message === "Acesso restrito à cozinha"
        ? "Esse login não tem acesso à cozinha"
        : err.response?.data?.error || "Credenciais inválidas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            width: "72px", height: "72px", margin: "0 auto 16px",
            background: "linear-gradient(135deg, #F59E0B, #FF6B35)",
            borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="36" height="36" viewBox="0 0 26 26" fill="none">
              <path d="M4 13 L13 4 L22 13 L13 22 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9 13 L13 9 L17 13 L13 17 Z" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-1px", color: "var(--text)" }}>
            Trovare
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.25em", color: "var(--amber)", textTransform: "uppercase", marginTop: "4px" }}>
            kitchen
          </div>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "8px" }}>
            Acesse o sistema da cozinha
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--faint)", display: "block", marginBottom: "6px" }}>
              E-mail
            </label>
            <input
              type="text"
              placeholder="usuario@restaurante.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ background: "var(--bg-inner)", border: "0.5px solid var(--border)", color: "var(--text)", width: "100%", fontSize: "14px", padding: "14px 16px", borderRadius: "12px", outline: "none", fontFamily: "'Space Mono', monospace" }}
            />
          </div>
          <div>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--faint)", display: "block", marginBottom: "6px" }}>
              Senha
            </label>
            <PasswordInput
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{
                background: "var(--bg-inner)", border: "0.5px solid var(--border)",
                color: "var(--text)", width: "100%", fontSize: "14px",
                padding: "14px 16px", borderRadius: "12px", outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{ padding: "12px", borderRadius: "10px", fontSize: "13px", color: "var(--red)", background: "#FF3D6E15", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "16px", borderRadius: "14px", cursor: "pointer", background: "linear-gradient(135deg, #F59E0B, #FF6B35)", color: "#fff", border: "none", fontSize: "15px", fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: "8px" }}>
            {loading ? "Entrando..." : "Entrar na cozinha"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "var(--faint)", fontSize: "11px", marginTop: "32px", fontFamily: "'Space Mono', monospace" }}>
          trovare kitchen © 2026
        </p>
      </div>
    </div>
  );
}