/**
 * AuthContext
 *
 * Supports two modes:
 * 1. Supabase Auth — when Supabase URL + anon key are configured in Settings
 * 2. Local demo — when Supabase is not configured (mock users)
 *
 * SECURITY: No API keys are hardcoded. All credentials come from localStorage.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { normalizeAppRole, ROLE_ADMIN, ROLE_COUNSELOR, type AppRole } from '@shared/const';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SUPABASE_SESSION_STORAGE_KEY,
} from '@/lib/supabase';
import {
  COUNSEL_ACCOUNT_NOT_FOUND_MESSAGE,
  COUNSEL_SERVER_UNAVAILABLE_MESSAGE,
  persistAuthNotice,
} from '@/lib/authAccess';
import {
  createCounselorProfileLookups,
  mapCounselorProfileToUser,
  normalizeLoginEmail,
  resolveCounselorProfile,
} from './authProfile';

export type UserRole = AppRole;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  department?: string;
  branch?: string;
  counselorId?: string; // Current profile key used by downstream filters
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Demo users (used only when Supabase is not configured) ──────────────────
const DEMO_USERS: Record<string, User & { password: string }> = {
  'counselor@example.com': {
    id: 'demo-c001',
    name: '최인수',
    email: 'counselor@example.com',
    password: 'REDACTED',
    role: ROLE_COUNSELOR,
    branch: '울산지점',
  },
  'admin@example.com': {
    id: 'demo-a001',
    name: '관리자',
    email: 'admin@example.com',
    password: 'REDACTED',
    role: ROLE_ADMIN,
    branch: '본사',
  },
};

const USER_STORAGE_KEY = 'counsel_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as Partial<User> & { role?: unknown };
      return {
        ...parsed,
        role: normalizeAppRole(parsed.role),
      } as User;
    } catch {
      return null;
    }
  });
  const [isBootstrapping, setIsBootstrapping] = useState(() => isSupabaseConfigured());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = isBootstrapping || isSubmitting;

  const clearLocalAuthState = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
  }, []);

  const clearSupabaseSession = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return;

    try {
      await Promise.race([
        sb.auth.signOut({ scope: 'local' }),
        new Promise(resolve => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Ignore sign-out failures and continue clearing the local auth state.
    }
  }, []);

  const resolveSupabaseUser = useCallback(async (authUserId: string, email: string): Promise<LoginResult> => {
    const sb = getSupabaseClient();
    if (!sb) {
      return {
        success: false,
        error: COUNSEL_SERVER_UNAVAILABLE_MESSAGE,
      };
    }

    const normalizedEmail = normalizeLoginEmail(email);
    const identity = { authUserId, email: normalizedEmail };

    const { profile, hadLookupError } = await resolveCounselorProfile(
      identity,
      createCounselorProfileLookups(sb),
    );

    if (!profile) {
      return {
        success: false,
        error: hadLookupError
          ? COUNSEL_SERVER_UNAVAILABLE_MESSAGE
          : COUNSEL_ACCOUNT_NOT_FOUND_MESSAGE,
      };
    }

    const resolvedUser: User = mapCounselorProfileToUser(identity, profile);

    setUser(resolvedUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resolvedUser));
    return {
      success: true,
      user: resolvedUser,
    };
  }, []);

  // Listen for Supabase session changes when configured
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsBootstrapping(false);
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      setIsBootstrapping(false);
      return;
    }

    const syncResolvedUser = async (authUserId: string, email: string) => {
      const result = await resolveSupabaseUser(authUserId, email);

      if (!result.success) {
        persistAuthNotice(result.error || COUNSEL_SERVER_UNAVAILABLE_MESSAGE);
        clearLocalAuthState();
        void clearSupabaseSession();
      }
    };

    sb.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          await syncResolvedUser(session.user.id, session.user.email || '');
        } else {
          clearLocalAuthState();
        }
      })
      .finally(() => {
        setIsBootstrapping(false);
      });

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncResolvedUser(session.user.id, session.user.email || '');
      } else {
        clearLocalAuthState();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearLocalAuthState, clearSupabaseSession, resolveSupabaseUser]);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    setIsSubmitting(true);
    const normalizedEmail = normalizeLoginEmail(email);
    try {
      // ── Supabase Auth ──────────────────────────────────────────────────────
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase 클라이언트 초기화 실패');

        const { data, error } = await sb.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) return { success: false, error: error.message };

        if (data.user) {
          const resolvedResult = await resolveSupabaseUser(
            data.user.id,
            data.user.email || normalizedEmail,
          );

          if (!resolvedResult.success) {
            clearLocalAuthState();
            void clearSupabaseSession();
          }

          return resolvedResult;
        }
        return { success: false, error: '로그인 실패' };
      }

      // ── Demo / local mode ─────────────────────────────────────────────────
      await new Promise(r => setTimeout(r, 500)); // simulate latency

      const demo = DEMO_USERS[normalizedEmail];
      if (demo && demo.password === password) {
        const { password: _, ...resolvedUser } = demo;
        setUser(resolvedUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resolvedUser));
        return { success: true, user: resolvedUser };
      }

      // Fallback: accept any credentials in demo mode as a counselor profile.
      const fallbackUser: User = {
        id: `local_${Date.now()}`,
        name: normalizedEmail.split('@')[0] || '상담사',
        email: normalizedEmail,
        role: ROLE_COUNSELOR,
        branch: '서울지점',
      };
      setUser(fallbackUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fallbackUser));
      return { success: true, user: fallbackUser };
    } catch (e: any) {
      return { success: false, error: e.message || '로그인 중 오류 발생' };
    } finally {
      setIsSubmitting(false);
    }
  }, [clearLocalAuthState, clearSupabaseSession, resolveSupabaseUser]);

  const logout = useCallback(async () => {
    clearLocalAuthState();
    if (isSupabaseConfigured()) {
      await clearSupabaseSession();
    }
  }, [clearLocalAuthState, clearSupabaseSession]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
