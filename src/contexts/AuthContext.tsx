import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type UserRoleType = "admin" | "coach" | "client" | "instructor" | "org_admin";

export interface OrganizationMembership {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: "org_admin" | "org_manager" | "org_member";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRoleType | null;
  userRoles: string[];
  organizationMembership: OrganizationMembership | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  switchRole: (role: UserRoleType) => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [organizationMembership, setOrganizationMembership] =
    useState<OrganizationMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const safeLocalStorageGet = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage get failed:", e);
      return null;
    }
  };

  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage set failed:", e);
    }
  };

  const safeLocalStorageRemove = (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage remove failed:", e);
    }
  };

  // Fetch organization membership for a user
  const fetchOrganizationMembership = async (
    userId: string,
  ): Promise<OrganizationMembership | null> => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          organization_id,
          role,
          organizations!inner (
            name,
            slug
          )
        `,
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) return null;

      return {
        organization_id: data.organization_id,
        organization_name: (data.organizations as any).name,
        organization_slug: (data.organizations as any).slug,
        role: data.role as "org_admin" | "org_manager" | "org_member",
      };
    } catch (error) {
      console.error("Error fetching organization membership:", error);
      return null;
    }
  };

  // Helper to determine the role to use
  const determineRole = (roles: string[], savedRole: string | null): UserRoleType | null => {
    if (roles.length === 0) return null;
    // If there's a saved role and it's valid for this user, use it
    if (savedRole && roles.includes(savedRole)) {
      return savedRole as UserRoleType;
    }
    // Otherwise default to admin if available, then org_admin, then first role
    if (roles.includes("admin")) return "admin";
    if (roles.includes("org_admin")) return "org_admin";
    return roles[0] as UserRoleType;
  };

  // Extracted helper to fetch roles and org membership - eliminates code duplication
  const fetchUserRolesAndMembership = async (userId: string) => {
    // Clear any previous auth error on fresh fetch
    setAuthError(null);

    // Fetch platform roles
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    let roles: string[] = data?.map((r) => r.role as string) || [];

    // Fetch organization membership
    const orgMembership = await fetchOrganizationMembership(userId);
    setOrganizationMembership(orgMembership);

    // Add org_admin to roles if user is org admin/manager
    // org_admin is a synthetic role derived from organization_members, not stored in user_roles
    if (
      orgMembership &&
      (orgMembership.role === "org_admin" || orgMembership.role === "org_manager")
    ) {
      if (!roles.includes("org_admin")) {
        roles = [...roles, "org_admin"];
      }
    }

    // No silent fallback — empty roles is a legitimate state handled by ProtectedRoute
    setUserRoles(roles);

    // Check for saved role preference
    const savedRole = safeLocalStorageGet("selectedRole");
    setUserRole(determineRole(roles, savedRole));

    return { roles, orgMembership };
  };

  useEffect(() => {
    // Track whether initSession already handled the initial load.
    // This prevents the onAuthStateChange listener from re-fetching roles
    // and potentially overriding a successful state with a timeout error.
    let initialLoadHandled = false;

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Safety valve: never allow the app to be stuck in loading forever.
    const loadingFailSafe = setTimeout(() => {
      // Only trigger if we're genuinely still stuck in loading
      if (!initialLoadHandled) {
        setLoading(false);
        setAuthError("Authentication timed out. Please refresh the page or try again.");
      }
    }, 15000);

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only synchronous state updates here to prevent deadlocks
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Skip re-fetching on the initial event if initSession() already handled it.
        // Only re-fetch on subsequent auth events (e.g. TOKEN_REFRESHED, or a new
        // SIGNED_IN after the user signed out and back in).
        if (initialLoadHandled && event === "INITIAL_SESSION") {
          return;
        }

        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(async () => {
          try {
            await withTimeout(
              fetchUserRolesAndMembership(session.user.id),
              8000,
              "fetchUserRolesAndMembership",
            );
          } catch (error) {
            console.error("Error fetching user roles:", error);
            // Only set authError if roles haven't been successfully loaded yet —
            // don't blank the screen if the user is already using the app
            setAuthError(
              error instanceof Error
                ? error.message
                : "Failed to load user roles. Please try again.",
            );
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setUserRole(null);
        setUserRoles([]);
        setOrganizationMembership(null);
        setLoading(false);
      }
    });

    // THEN check for existing session
    const initSession = async () => {
      let sessionUser: User | null = null;
      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), 8000, "getSession");
        setSession(session);
        setUser(session?.user ?? null);
        sessionUser = session?.user ?? null;

        if (session?.user) {
          await withTimeout(
            fetchUserRolesAndMembership(session.user.id),
            8000,
            "fetchUserRolesAndMembership",
          );
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        if (sessionUser) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "Failed to initialize session. Please try again.",
          );
        }
      } finally {
        initialLoadHandled = true;
        setLoading(false);
      }
    };

    initSession();

    return () => {
      clearTimeout(loadingFailSafe);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const roles = roleData?.map((r) => r.role) || [];

      // Check for org membership
      const orgMembership = await fetchOrganizationMembership(data.user.id);

      if (roles.includes("admin")) {
        navigate("/admin");
      } else if (
        orgMembership &&
        (orgMembership.role === "org_admin" || orgMembership.role === "org_manager")
      ) {
        navigate("/org-admin");
      } else if (roles.includes("instructor") || roles.includes("coach")) {
        navigate("/teaching");
      } else {
        navigate("/dashboard");
      }
    }

    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });

    return { error };
  };

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
      }
    } catch (error) {
      console.error("Sign out exception:", error);
    } finally {
      // Always clear local state and redirect, even if signOut fails
      safeLocalStorageRemove("selectedRole");
      setUserRole(null);
      setUserRoles([]);
      setOrganizationMembership(null);
      setAuthError(null);
      setUser(null);
      setSession(null);
      navigate("/auth");
    }
  }, [navigate]);

  const switchRole = (role: UserRoleType) => {
    if (userRoles.includes(role)) {
      setUserRole(role);
      // Save the selected role to localStorage so it persists across page loads
      safeLocalStorageSet("selectedRole", role);

      // Only navigate if the user is NOT already on a valid route for the target role
      const currentPath = window.location.pathname;
      const isOnAdminRoute = currentPath.startsWith("/admin");
      const isOnOrgAdminRoute = currentPath.startsWith("/org-admin");
      const isOnTeachingRoute = currentPath.startsWith("/teaching");
      const isOnClientRoute =
        currentPath.startsWith("/dashboard") ||
        currentPath.startsWith("/programs") ||
        currentPath.startsWith("/goals") ||
        currentPath.startsWith("/decisions") ||
        currentPath.startsWith("/tasks") ||
        currentPath.startsWith("/groups") ||
        currentPath.startsWith("/assessments") ||
        currentPath.startsWith("/wheel") ||
        currentPath.startsWith("/skills") ||
        currentPath.startsWith("/timeline") ||
        currentPath.startsWith("/calendar") ||
        currentPath.startsWith("/usage") ||
        currentPath.startsWith("/community") ||
        currentPath.startsWith("/academy");

      // Navigate to appropriate dashboard for the selected role, but only if necessary
      if (role === "admin" && !isOnAdminRoute) {
        navigate("/admin");
      } else if (role === "org_admin" && !isOnOrgAdminRoute) {
        navigate("/org-admin");
      } else if ((role === "instructor" || role === "coach") && !isOnTeachingRoute) {
        navigate("/teaching");
      } else if (role === "client" && !isOnClientRoute) {
        navigate("/dashboard");
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        userRoles,
        organizationMembership,
        loading,
        authError,
        signIn,
        signUp,
        signOut,
        switchRole,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
