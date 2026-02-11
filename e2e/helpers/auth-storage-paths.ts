import path from 'path';

/** Directory for cached auth state files (gitignored) */
const AUTH_DIR = path.join(import.meta.dirname, '..', '.auth');

export const STORAGE_STATE = {
  admin: path.join(AUTH_DIR, 'admin.json'),
  client: path.join(AUTH_DIR, 'client.json'),
  coach: path.join(AUTH_DIR, 'coach.json'),
} as const;
