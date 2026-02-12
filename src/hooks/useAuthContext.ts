import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuthContextData {
  id: string;
  slug: string;
  context_type: string;
  headline: string;
  subheadline: string | null;
  description: string | null;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }> | null;
  logo_url: string | null;
  primary_color: string | null;
  default_to_signup: boolean;
  program_id: string | null;
  track_id: string | null;
  organization_id: string | null;
  auto_enroll_program: boolean;
  auto_assign_track: boolean;
}

const DEFAULT_FEATURES = [
  {
    icon: "Target",
    title: "Goal-Driven Growth",
    description: "Set meaningful goals and track your progress with structured milestones",
  },
  {
    icon: "Users",
    title: "Expert Training and Coaching",
    description: "Partner up with certified coaches and instructors for personalized development",
  },
  {
    icon: "TrendingUp",
    title: "Decision Intelligence",
    description: "Make better decisions with proven frameworks and reflection tools",
  },
  {
    icon: "Sparkles",
    title: "AI-Powered Insights",
    description: "Receive intelligent recommendations tailored to your journey",
  },
];

const DEFAULT_CONTEXT: AuthContextData = {
  id: "default",
  slug: "default",
  context_type: "generic",
  headline: "Your platform for lifelong development",
  subheadline: "Evolving people. Strengthening organisations.",
  description:
    "InnoTrue Hub is your comprehensive platform for personal and professional evolution. Transform your potential through structured programs, expert coaching, and intelligent insights.",
  features: DEFAULT_FEATURES,
  logo_url: null,
  primary_color: null,
  default_to_signup: false,
  program_id: null,
  track_id: null,
  organization_id: null,
  auto_enroll_program: false,
  auto_assign_track: false,
};

export function useAuthContext(contextSlug: string | null) {
  const [context, setContext] = useState<AuthContextData>(DEFAULT_CONTEXT);
  const [isLoading, setIsLoading] = useState(!!contextSlug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contextSlug) {
      setContext(DEFAULT_CONTEXT);
      setIsLoading(false);
      return;
    }

    const fetchContext = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use the public view for auth context lookups (safer - only exposes necessary columns)
        // First try to find by public_code
        let { data, error: fetchError } = await supabase
          .from("auth_contexts_public")
          .select("*")
          .eq("public_code", contextSlug)
          .maybeSingle();

        // If not found by public_code, try slug (only if context allows it)
        if (!data) {
          const { data: slugData } = await supabase
            .from("auth_contexts_public")
            .select("*")
            .eq("slug", contextSlug)
            .eq("allow_slug_access", true)
            .maybeSingle();

          data = slugData;
        }

        if (!data) {
          console.warn("Auth context not found:", contextSlug);
          setContext(DEFAULT_CONTEXT);
        } else {
          // Merge with defaults for any missing fields
          const features = data.features as AuthContextData["features"];
          setContext({
            id: data.id ?? "",
            slug: data.slug ?? "",
            context_type: data.context_type ?? "generic",
            headline: data.headline || DEFAULT_CONTEXT.headline,
            subheadline: data.subheadline || DEFAULT_CONTEXT.subheadline,
            description: data.description || DEFAULT_CONTEXT.description,
            features: features && features.length > 0 ? features : DEFAULT_FEATURES,
            logo_url: data.logo_url,
            primary_color: data.primary_color,
            default_to_signup: data.default_to_signup ?? false,
            program_id: data.program_id,
            track_id: data.track_id,
            organization_id: data.organization_id,
            auto_enroll_program: data.auto_enroll_program ?? false,
            auto_assign_track: data.auto_assign_track ?? false,
          });
        }
      } catch (err) {
        console.error("Error fetching auth context:", err);
        setError("Failed to load context");
        setContext(DEFAULT_CONTEXT);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContext();
  }, [contextSlug]);

  return { context, isLoading, error };
}
