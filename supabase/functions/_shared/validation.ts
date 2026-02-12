// =============================================================================
// Shared Input Validation Utilities for Edge Functions
// =============================================================================

/**
 * Validate email format using a standard regex.
 * Rejects clearly invalid addresses while allowing most valid ones.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  // RFC 5322 simplified — covers 99.9% of real-world addresses
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return email.length <= 254 && emailRegex.test(email);
}

/**
 * Password strength validation.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePassword(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

/**
 * Validate UUID format (v4).
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validate and sanitize a user name.
 * Returns null if invalid, or the trimmed name if valid.
 */
export function validateName(name: string, maxLength = 200): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Validate text input size for AI prompts.
 * Returns null if valid, or an error message string if too large.
 * Default max is 10,000 characters (~2,500 words).
 */
export function validateTextInput(
  text: string,
  fieldName: string,
  maxLength = 10_000
): string | null {
  if (!text || typeof text !== "string") {
    return `${fieldName} is required`;
  }
  if (text.length > maxLength) {
    return `${fieldName} must be at most ${maxLength.toLocaleString()} characters`;
  }
  return null;
}

/**
 * Validate that a value is one of the allowed options.
 */
export function isValidEnum<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return allowed.includes(value as T);
}
