import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../src/integrations/supabase/types";

/**
 * Load a value from process.env, falling back to the project .env file.
 * Playwright doesn't load .env automatically, so we read it ourselves.
 */
function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(import.meta.dirname, "..", "..", ".env");
    const envFile = fs.readFileSync(envPath, "utf-8");
    const match = envFile.match(new RegExp(`^${key}=(.+)$`, "m"));
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/**
 * Pre-accept platform terms in the database for the currently logged-in user.
 * Reads the session from the page's localStorage and uses the Supabase API to insert
 * a row into user_platform_terms_acceptance so the PlatformTermsAcceptanceGate won't show.
 */
export async function acceptPlatformTermsViaApi(page: Page): Promise<boolean> {
  const url = getEnv("VITE_SUPABASE_URL");
  const anonKey = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return false;

  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const raw = await page.evaluate((key: string) => localStorage.getItem(key), storageKey);
  if (!raw) return false;

  let session: { access_token?: string; user?: { id: string } };
  try {
    session = JSON.parse(raw);
  } catch {
    return false;
  }
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) return false;

  const supabase = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: terms, error: termsError } = await supabase
    .from("platform_terms")
    .select("id, content_html")
    .eq("is_current", true)
    .maybeSingle();

  if (termsError || !terms) return false;

  const contentHash = crypto.createHash("sha256").update(terms.content_html).digest("hex");

  const { error: insertError } = await supabase.from("user_platform_terms_acceptance").insert({
    user_id: userId,
    platform_terms_id: terms.id,
    content_hash: contentHash,
  });

  return !insertError;
}
