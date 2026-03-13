/**
 * Auth context mock factories for hook tests.
 *
 * Usage:
 *   const mockAuth = mockAuthProfiles.client();
 *   vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
 */
import { vi } from "vitest";
import type { User, Session } from "@supabase/supabase-js";

// ── Minimal type mirror of AuthContextType ──

export type UserRoleType = "admin" | "client" | "instructor" | "org_admin";

export interface OrganizationMembership {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
}

export interface MockAuthValue {
  user: User | null;
  session: Session | null;
  userRole: UserRoleType | null;
  userRoles: string[];
  organizationMembership: OrganizationMembership | null;
  registrationStatus: string | null;
  loading: boolean;
  authError: string | null;
  signIn: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  switchRole: ReturnType<typeof vi.fn>;
  clearAuthError: ReturnType<typeof vi.fn>;
}

// ── Helpers ──

export function createMockUser(
  id = "user-1",
  email = "test@example.com",
): User {
  return {
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  } as User;
}

function createMockSession(user: User): Session {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;
}

// ── Factory ──

interface MockAuthOptions {
  userId?: string;
  email?: string;
  roles?: string[];
  activeRole?: UserRoleType;
  orgMembership?: OrganizationMembership | null;
  registrationStatus?: string | null;
  authenticated?: boolean;
}

export function createMockAuth(
  options: MockAuthOptions = {},
): MockAuthValue {
  const userId = options.userId ?? "user-1";
  const authenticated = options.authenticated ?? true;
  const user = authenticated ? createMockUser(userId, options.email) : null;
  const session = user ? createMockSession(user) : null;
  const roles = options.roles ?? ["client"];

  return {
    user,
    session,
    userRole: options.activeRole ?? (roles[0] as UserRoleType) ?? null,
    userRoles: roles,
    organizationMembership: options.orgMembership ?? null,
    registrationStatus: options.registrationStatus ?? null,
    loading: false,
    authError: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    switchRole: vi.fn(),
    clearAuthError: vi.fn(),
  };
}

// ── Pre-built profiles ──

export const mockAuthProfiles = {
  client: () => createMockAuth({ roles: ["client"], activeRole: "client" }),
  admin: () => createMockAuth({ roles: ["admin"], activeRole: "admin" }),
  instructor: () =>
    createMockAuth({ roles: ["instructor"], activeRole: "instructor" }),
  orgAdmin: () =>
    createMockAuth({
      roles: ["client", "org_admin"],
      activeRole: "org_admin",
      orgMembership: {
        organization_id: "org-1",
        organization_name: "Test Org",
        organization_slug: "test-org",
        role: "org_admin",
      },
    }),
  unauthenticated: () =>
    createMockAuth({
      authenticated: false,
      roles: [],
      activeRole: undefined,
    }),
};
