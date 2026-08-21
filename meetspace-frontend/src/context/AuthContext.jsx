import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { logoutRequest } from "../services/api";
import { getTokenExpiration, isTokenExpired, SESSION_EXPIRED_EVENT } from "../utils/authSession";

const AuthContext = createContext(null);
const EMPTY_AUTH = { user: null, token: null };

function clearStoredAuth() {
  localStorage.removeItem("auth");
  sessionStorage.removeItem("auth");
}

function parseStoredAuth(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed?.user || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readInitialSession() {
  const persistent = parseStoredAuth(localStorage.getItem("auth"));
  const temporary = parseStoredAuth(sessionStorage.getItem("auth"));
  const auth = temporary || persistent;
  const expired = Boolean(auth?.token && isTokenExpired(auth.token));

  if (!auth || expired) {
    clearStoredAuth();
    return { auth: EMPTY_AUTH, remember: false, expired };
  }

  return { auth, remember: !temporary && Boolean(persistent), expired: false };
}

export function AuthProvider({ children }) {
  const [initialSession] = useState(readInitialSession);
  const [auth, setAuth] = useState(initialSession.auth);
  const [rememberSession, setRememberSession] = useState(initialSession.remember);
  const [sessionExpired, setSessionExpired] = useState(initialSession.expired);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const clearSession = useCallback((expired = false) => {
    clearStoredAuth();
    setAuth(EMPTY_AUTH);
    setRememberSession(false);
    setSessionExpired(expired);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (auth.token) {
        const target = rememberSession ? localStorage : sessionStorage;
        const other = rememberSession ? sessionStorage : localStorage;
        target.setItem("auth", JSON.stringify(auth));
        other.removeItem("auth");
      } else {
        clearStoredAuth();
      }
    }
  }, [auth, isLoading, rememberSession]);

  useEffect(() => {
    const expireSession = () => clearSession(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession);
  }, [clearSession]);

  useEffect(() => {
    if (!auth.token) return undefined;
    const expiresAt = getTokenExpiration(auth.token);
    if (expiresAt === null) return undefined;

    let timer;
    const scheduleExpiryCheck = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        clearSession(true);
        return;
      }
      timer = window.setTimeout(scheduleExpiryCheck, Math.min(remaining, 2_147_483_647));
    };

    scheduleExpiryCheck();
    return () => window.clearTimeout(timer);
  }, [auth.token, clearSession]);

  const login = useCallback((user, token, options = {}) => {
    setRememberSession(Boolean(options.remember));
    setSessionExpired(false);
    setAuth({ user, token });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth.token) {
        await logoutRequest(auth.token);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Logout API call failed:", error);
    } finally {
      clearSession(false);
    }
  }, [auth.token, clearSession]);

  return (
    <AuthContext.Provider value={{
      ...auth,
      login,
      logout,
      isLoading,
      rememberSession,
      sessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
