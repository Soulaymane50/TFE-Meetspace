import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { logoutRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { user: null, token: null };
      }
    }
    return { user: null, token: null };
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (auth.token) {
        localStorage.setItem("auth", JSON.stringify(auth));
      } else {
        localStorage.removeItem("auth");
      }
    }
  }, [auth, isLoading]);

  const login = useCallback((user, token) => {
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
    }
  }, [auth.token]);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
