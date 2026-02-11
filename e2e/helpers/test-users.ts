/**
 * Test user credentials for E2E tests.
 *
 * These match the demo users in supabase/seed.sql.
 * Override via environment variables if needed.
 */
export const TEST_USERS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'doinapopade@gmail.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'DemoPass123!',
    expectedRole: 'admin' as const,
    dashboardPath: '/admin',
  },
  client: {
    email: process.env.E2E_CLIENT_EMAIL || 'innohub_client1@innotrue.com',
    password: process.env.E2E_CLIENT_PASSWORD || '12345IHClient',
    expectedRole: 'client' as const,
    dashboardPath: '/dashboard',
  },
  coach: {
    email: process.env.E2E_COACH_EMAIL || 'emily.parker@demo.innotrue.com',
    password: process.env.E2E_COACH_PASSWORD || 'DemoPass123!',
    expectedRole: 'coach' as const,
    dashboardPath: '/teaching',
  },
  instructor: {
    email: process.env.E2E_INSTRUCTOR_EMAIL || 'innohub_instructor@innotrue.com',
    password: process.env.E2E_INSTRUCTOR_PASSWORD || 'DemoPass123!',
    expectedRole: 'instructor' as const,
    dashboardPath: '/teaching',
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;
