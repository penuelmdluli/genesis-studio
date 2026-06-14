"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour — must match backend
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // check every 60s

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: string;
  creditBalance: number;
  monthlyCreditsUsed: number;
  monthlyCreditsLimit: number;
}

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: false,
  isSignedIn: false,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else if (res.status === 401) {
        // Session expired — redirect to sign-in
        setUser(null);
        if (window.location.pathname.startsWith("/dashboard") ||
            window.location.pathname.startsWith("/generate") ||
            window.location.pathname.startsWith("/brain") ||
            window.location.pathname.startsWith("/motion-control") ||
            window.location.pathname.startsWith("/react-studio") ||
            window.location.pathname.startsWith("/gallery") ||
            window.location.pathname.startsWith("/settings")) {
          window.location.href = "/sign-in?expired=1";
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors — clear local state anyway
    }
    setUser(null);
    window.location.href = "/sign-in";
  }, []);

  // ── Inactivity detection ──────────────────────────────────────
  useEffect(() => {
    // Track user activity
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Periodically check if the user has been idle too long
    const interval = setInterval(() => {
      if (!user) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= INACTIVITY_TIMEOUT_MS) {
        // Session timed out due to inactivity — sign out with expired flag
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        setUser(null);
        window.location.href = "/sign-in?expired=1";
        return;
      }
    }, ACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        signOut,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUser() {
  const { user, isLoaded } = useContext(AuthContext);
  return { user, isLoaded };
}
