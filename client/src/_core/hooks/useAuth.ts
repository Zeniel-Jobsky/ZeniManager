import { getLoginUrl } from "@/const";
import { useAuth as useAuthContext } from "@/contexts/AuthContext";
import { useEffect } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const { user, isAuthenticated, isLoading, logout } = useAuthContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(user));
      return;
    }
    localStorage.removeItem("manus-runtime-user-info");
  }, [user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (isLoading) return;
    if (user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    isLoading,
    user,
  ]);

  return {
    user,
    loading: isLoading,
    error: null,
    isAuthenticated,
    refresh: async () => undefined,
    logout,
  };
}
