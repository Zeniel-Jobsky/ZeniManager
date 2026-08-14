import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeAppRole,
  ROLE_COUNSELOR,
  type AppRole,
} from '@shared/const';

export interface UserIdentity {
  authUserId: string;
  email: string;
}

export interface CounselorProfileRecord {
  id: string;
  name: string;
  department: string | null;
  role: unknown;
}

export interface AuthenticatedUserProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  department?: string;
  branch?: string;
  counselorId?: string;
}

export interface CounselorProfileResolution {
  profile: CounselorProfileRecord | null;
  hadLookupError: boolean;
}

type SupabaseLike = Pick<SupabaseClient, 'from' | 'rpc'>;
export type ProfileLookup = (
  identity: UserIdentity,
) => Promise<CounselorProfileRecord | null>;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mapCounselorProfileToUser(
  identity: UserIdentity,
  profile: CounselorProfileRecord,
): AuthenticatedUserProfile {
  const department = profile.department || undefined;

  return {
    id: identity.authUserId,
    name: profile.name,
    email: identity.email,
    role: normalizeAppRole(profile.role),
    department,
    branch: department,
    counselorId: profile.id,
  };
}

export function buildFallbackUser(
  identity: UserIdentity,
): AuthenticatedUserProfile {
  return {
    id: identity.authUserId,
    name: identity.email.split('@')[0] || '사용자',
    email: identity.email,
    role: ROLE_COUNSELOR,
  };
}

export async function resolveCounselorProfile(
  identity: UserIdentity,
  lookups: ProfileLookup[],
): Promise<CounselorProfileResolution> {
  let hadLookupError = false;

  for (const lookup of lookups) {
    try {
      const profile = await lookup(identity);
      if (profile) {
        return {
          profile,
          hadLookupError,
        };
      }
    } catch {
      hadLookupError = true;
    }
  }

  return {
    profile: null,
    hadLookupError,
  };
}

export function createCounselorProfileLookups(
  sb: SupabaseLike,
): ProfileLookup[] {
  return [
    async ({ authUserId }) => {
      const { data, error } = await sb
        .from('user')
        .select('user_id, user_name, role, department')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.user_id,
        name: data.user_name,
        department: data.department,
        role: data.role,
      };
    },
  ];
}
