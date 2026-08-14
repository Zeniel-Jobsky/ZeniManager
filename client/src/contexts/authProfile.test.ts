import { describe, expect, it, vi } from 'vitest';
import { ROLE_ADMIN, ROLE_COUNSELOR } from '@shared/const';
import {
  buildFallbackUser,
  mapCounselorProfileToUser,
  normalizeLoginEmail,
  resolveCounselorProfile,
} from './authProfile';

describe('authProfile', () => {
  it('normalizes login email before resolving the app user', () => {
    expect(normalizeLoginEmail(' Senior@Test.com ')).toBe('senior@test.com');
  });

  it('maps an admin profile to the admin app role', () => {
    const user = mapCounselorProfileToUser(
      {
        authUserId: 'auth-admin-1',
        email: 'senior@test.com',
      },
      {
        id: 'auth-admin-1',
        name: '시니어 관리자',
        department: '본사',
        role: ROLE_ADMIN,
      },
    );

    expect(user.role).toBe(ROLE_ADMIN);
    expect(user.counselorId).toBe('auth-admin-1');
    expect(user.email).toBe('senior@test.com');
    expect(user.department).toBe('본사');
  });

  it('falls back through lookup strategies until it finds a profile', async () => {
    const legacyLookup = vi.fn().mockResolvedValue({
      id: 'auth-admin-1',
      name: '시니어 관리자',
      department: '본사',
      role: ROLE_ADMIN,
    });
    const result = await resolveCounselorProfile(
      {
        authUserId: 'auth-admin-1',
        email: 'senior@test.com',
      },
      [
        vi.fn().mockResolvedValue(null),
        legacyLookup,
        vi.fn().mockResolvedValue({
          id: 'ignored',
          name: 'ignored',
          department: null,
          role: ROLE_COUNSELOR,
        }),
      ],
    );

    expect(result.profile?.role).toBe(ROLE_ADMIN);
    expect(result.hadLookupError).toBe(false);
    expect(legacyLookup).toHaveBeenCalledOnce();
  });

  it('marks lookup failure when every strategy errors or misses', async () => {
    const result = await resolveCounselorProfile(
      {
        authUserId: 'auth-user-1',
        email: 'counselor@test.com',
      },
      [
        vi.fn().mockRejectedValue(new Error('network error')),
        vi.fn().mockResolvedValue(null),
      ],
    );

    expect(result.profile).toBeNull();
    expect(result.hadLookupError).toBe(true);
  });

  it('uses counselor fallback when no profile can be resolved', () => {
    const user = buildFallbackUser({
      authUserId: 'auth-user-1',
      email: 'counselor@test.com',
    });

    expect(user.role).toBe(ROLE_COUNSELOR);
    expect(user.name).toBe('counselor');
  });
});
