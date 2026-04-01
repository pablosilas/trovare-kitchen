import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api.js";
import socket from "../services/socket.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    localStorage.removeItem("trovare-kitchen-token");
    delete api.defaults.headers.common["Authorization"];
    socket.disconnect();
    setUser(null);
  }

  useEffect(() => {
    const token = localStorage.getItem("trovare-kitchen-token");
    if (!token) { setLoading(false); return; }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    api.get("/auth/me")
      .then(({ data }) => {
        // Só aceita role kitchen
        if (data.role !== "kitchen") { logout(); return; }
        setUser(data);
        socket.connect();
        socket.emit("join-tenant", data.tenant.id);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", {
      email,
      password,
      product: "food",
    });

    // Bloqueia se não for role kitchen
    if (data.user.role !== "kitchen") {
      throw new Error("Acesso restrito à cozinha");
    }

    localStorage.setItem("trovare-kitchen-token", data.token);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    setUser(data.user);
    socket.connect();
    socket.emit("join-tenant", data.user.tenant.id);
    return data;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}