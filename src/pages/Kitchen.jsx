import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/useAuth.js";
import api from "../services/api.js";
import socket from "../services/socket.js";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { Sun, Moon, ChefHat, Bike, AlertTriangle, CheckCircle } from "lucide-react";

const statusColors = {
  aberto: { color: "#FF6B35", bg: "#FF6B3515", label: "Novo" },
  preparando: { color: "#F59E0B", bg: "#F59E0B15", label: "Preparando" },
  pronto: { color: "#00F5A0", bg: "#00F5A015", label: "Pronto" },
};

function tempoEspera(createdAt) {
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000 / 60);
  if (diff < 1) return "< 1 min";
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
}

function corTempo(createdAt) {
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000 / 60);
  if (diff < 10) return "#00F5A0";
  if (diff < 20) return "#F59E0B";
  return "#FF3D6E";
}

const TEMPO_AUTO_REMOVER = 15 * 60 * 1000; // 15 minutos

export default function Kitchen() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [tick, setTick] = useState(0);
  const audioRef = useRef(null);
  const timersRef = useRef({}); // ← guarda os timers de auto-remoção

  const fetchPedidos = useCallback(async () => {
    try {
      const { data } = await api.get("/food/pedidos");
      setPedidos(data.filter(p => !["fechado", "aguardando_pagamento", "cancelado", "retirado"].includes(p.status)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Agenda remoção automática após 15min para pedidos prontos
  function agendarRemocao(pedidoId) {
    // Cancela timer anterior se existir
    if (timersRef.current[pedidoId]) {
      clearTimeout(timersRef.current[pedidoId]);
    }

    timersRef.current[pedidoId] = setTimeout(() => {
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
      delete timersRef.current[pedidoId];
    }, TEMPO_AUTO_REMOVER);
  }

  function cancelarRemocao(pedidoId) {
    if (timersRef.current[pedidoId]) {
      clearTimeout(timersRef.current[pedidoId]);
      delete timersRef.current[pedidoId];
    }
  }

  // Atualiza timer a cada 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchPedidos();

    socket.on("pedido:novo", (pedido) => {
      setPedidos(prev => {
        const exists = prev.find(p => p.id === pedido.id);
        if (exists) return prev;
        try { audioRef.current?.play(); } catch { }
        return [pedido, ...prev];
      });
    });

    socket.on("pedido:atualizado", (pedido) => {
      if (["fechado", "aguardando_pagamento", "cancelado", "retirado"].includes(pedido.status)) {
        setPedidos(prev => prev.filter(p => p.id !== pedido.id));
        cancelarRemocao(pedido.id);
      } else {
        setPedidos(prev => prev.map(p => p.id === pedido.id ? pedido : p));
      }
    });

    socket.on("pedido:status", (pedido) => {
      if (["fechado", "aguardando_pagamento", "cancelado", "retirado"].includes(pedido.status)) {
        setPedidos(prev => prev.filter(p => p.id !== pedido.id));
        cancelarRemocao(pedido.id);
      } else {
        setPedidos(prev => prev.map(p => p.id === pedido.id ? pedido : p));
        // Agenda remoção automática quando ficar pronto
        if (pedido.status === "pronto") {
          agendarRemocao(pedido.id);
        }
      }
    });

    socket.on("pedido:retirado", (pedido) => {
      setPedidos(prev => prev.filter(p => p.id !== pedido.id));
      cancelarRemocao(pedido.id);
    });

    socket.on("pedido:cancelado", (pedido) => {
      setPedidos(prev => prev.filter(p => p.id !== pedido.id));
      cancelarRemocao(pedido.id);
    });

    socket.on("pedido:fechado", (pedido) => {
      setPedidos(prev => prev.filter(p => p.id !== pedido.id));
      cancelarRemocao(pedido.id);
    });

    return () => {
      socket.off("pedido:novo");
      socket.off("pedido:atualizado");
      socket.off("pedido:status");
      socket.off("pedido:retirado");
      socket.off("pedido:cancelado");
      socket.off("pedido:fechado");
      // Limpa todos os timers
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [fetchPedidos]);

  async function handleStatus(id, status) {
    try {
      await api.patch(`/food/pedidos/${id}/status`, { status });
      // Agenda remoção se ficou pronto
      if (status === "pronto") agendarRemocao(id);
    } catch (e) {
      console.error(e);
    }
  }

  const filtered = filter === "all" ? pedidos : pedidos.filter(p => p.status === filter);
  const novos = pedidos.filter(p => p.status === "aberto").length;
  const preparando = pedidos.filter(p => p.status === "preparando").length;
  const prontos = pedidos.filter(p => p.status === "pronto").length;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ color: "var(--muted)", fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>
          Conectando à cozinha...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>

      <audio ref={audioRef} preload="auto">
        <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div style={{
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-card)", borderBottom: "0.5px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px",
            background: "linear-gradient(135deg, #F59E0B, #FF6B35)",
            borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 26 26" fill="none">
              <path d="M4 13 L13 4 L22 13 L13 22 Z" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M9 13 L13 9 L17 13 L13 17 Z" fill="#fff" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text)" }}>
              Trovare Kitchen
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "var(--amber)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              {user?.tenant?.name}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {[
            { label: "Novos", value: novos, color: "#FF6B35" },
            { label: "Preparando", value: preparando, color: "#F59E0B" },
            { label: "Prontos", value: prontos, color: "#00F5A0" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "var(--faint)", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
          {/* Toggle tema */}
          <button onClick={toggleTheme}
            style={{
              background: "var(--bg-inner)", border: "0.5px solid var(--border)",
              color: "var(--muted)", padding: "6px 10px", borderRadius: "8px",
              fontSize: "14px", cursor: "pointer",
            }}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={logout}
            style={{ background: "#FF3D6E15", color: "#FF3D6E", border: "0.5px solid #FF3D6E30", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", marginLeft: "8px" }}>
            Sair
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding: "12px 24px", display: "flex", gap: "8px", background: "var(--bg-card)", borderBottom: "0.5px solid var(--border)" }}>
        {[
          { value: "all", label: `Todos (${pedidos.length})` },
          { value: "aberto", label: `Novos (${novos})` },
          { value: "preparando", label: `Preparando (${preparando})` },
          { value: "pronto", label: `Prontos (${prontos})` },
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            style={{
              fontSize: "12px", padding: "6px 14px", borderRadius: "8px",
              cursor: "pointer", border: "0.5px solid",
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
              background: filter === f.value ? "#F59E0B20" : "transparent",
              color: filter === f.value ? "#F59E0B" : "var(--muted)",
              borderColor: filter === f.value ? "#F59E0B50" : "var(--border)",
              transition: "all 0.15s",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "16px" }}>
            <div style={{ fontSize: "48px" }}>👨‍🍳</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>Nenhum pedido no momento</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--muted)" }}>
              Aguardando novos pedidos...
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {filtered.map(p => {
              const cfg = statusColors[p.status] || statusColors.aberto;
              const tempo = tempoEspera(p.createdAt);
              const cor = corTempo(p.createdAt);

              return (
                <div key={p.id} style={{
                  background: "var(--bg-card)",
                  border: `0.5px solid ${cfg.color}40`,
                  borderRadius: "16px", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                }}>

                  {/* Barra de status */}
                  <div style={{ height: "4px", background: cfg.color }} />

                  {/* Header do card */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid var(--border)" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                          #{p.id}
                        </span>
                        <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                        {p.mesa ? `Mesa ${p.mesa.numero}` : p.nomeCliente ? <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Bike size={13} />{p.nomeCliente}</span> : "Balcão"}
                        {p.garcom ? ` · ${p.garcom.nome.split(" ")[0]}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: cor }}>{tempo}</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "var(--faint)", textTransform: "uppercase" }}>
                        espera
                      </div>
                    </div>
                  </div>

                  {/* Itens */}
                  <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {p.itens?.map(ip => (
                      <div key={ip.id} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "10px",
                        background: "var(--bg-inner)",
                      }}>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "8px",
                          background: cfg.color + "20",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px", fontWeight: 700, color: cfg.color, flexShrink: 0,
                        }}>
                          {ip.quantidade}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                            {ip.item?.nome}
                          </div>
                          {ip.obs && (
                            <div style={{ fontSize: "11px", color: "var(--amber)", marginTop: "2px", fontStyle: "italic", display: "flex", alignItems: "center", gap: "4px" }}>
                              <AlertTriangle size={11} />{ip.obs}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {p.observacao && (
                      <div style={{ padding: "8px 12px", borderRadius: "8px", background: "#F59E0B10", border: "0.5px solid #F59E0B30" }}>
                        <div style={{ fontSize: "11px", color: "#F59E0B" }}>⚠️ {p.observacao}</div>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ padding: "12px 16px", borderTop: "0.5px solid var(--border)", display: "flex", gap: "8px" }}>
                    {p.status === "aberto" && (
                      <button
                        onClick={() => handleStatus(p.id, "preparando")}
                        style={{
                          flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
                          border: "none", fontWeight: 700, fontSize: "13px",
                          background: "#F59E0B20", color: "#F59E0B",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}>
                        <ChefHat size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />Iniciar preparo
                      </button>
                    )}
                    {p.status === "preparando" && (
                      <button
                        onClick={() => handleStatus(p.id, "pronto")}
                        style={{
                          flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
                          border: "none", fontWeight: 700, fontSize: "13px",
                          background: "#00F5A020", color: "#00F5A0",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}>
                        <CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />Marcar como pronto
                      </button>
                    )}
                    {p.status === "pronto" && (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{
                          padding: "10px 12px", borderRadius: "10px", textAlign: "center",
                          background: "#00F5A010", color: "#00F5A0", fontSize: "13px", fontWeight: 700,
                        }}>
                          ✅ Pronto para servir!
                        </div>
                        <div style={{
                          fontFamily: "'Space Mono', monospace", fontSize: "10px",
                          color: "var(--faint)", textAlign: "center",
                        }}>
                          Some em 15 min automaticamente
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}