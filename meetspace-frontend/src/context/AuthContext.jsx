import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { logoutRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = sessionStorage.getItem("auth") || localStorage.getItem("auth");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { user: null, token: null };
      }
    }
    return { user: null, token: null };
  });
  const [rememberSession, setRememberSession] = useState(() => Boolean(localStorage.getItem("auth")));

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (auth.token) {
        const target = rememberSession ? localStorage : sessionStorage;
        const other = rememberSession ? sessionStorage : localStorage;
        target.setItem("auth", JSON.stringify(auth));
        other.removeItem("auth");
      } else {
        localStorage.removeItem("auth");
        sessionStorage.removeItem("auth");
      }
    }
  }, [auth, isLoading, rememberSession]);

  const login = useCallback((user, token, options = {}) => {
    setRememberSession(Boolean(options.remember));
    setAuth({ user, token });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth.token) {
        await logoutRequest(auth.token);
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout API call failed:", error);
    } finally {
      setAuth({ user: null, token: null });
      localStorage.removeItem("auth");
      sessionStorage.removeItem("auth");
    }
  }, [auth.token]);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isLoading, rememberSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
