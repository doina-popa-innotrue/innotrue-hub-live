import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-experience-api-version',
};

// xAPI Statement structure
interface XAPIStatement {
  id?: string;
  actor: {
    mbox?: string;
    account?: {
      name: string;
      homePage: string;
    };
    name?: string;
  };
  verb: {
    id: string;
    display?: Record<string, string>;
  };
  object: {
    id: string;
    definition?: {
      name?: Record<string, string>;
      type?: string;
    };
    objectType?: string;
  };
  result?: {
    completion?: boolean;
    success?: boolean;
    score?: {
      scaled?: number;
      raw?: number;
      min?: number;
      max?: number;
    };
    duration?: string;
  };
  context?: {
    registration?: string;
    extensions?: Record<string, unknown>;
  };
  timestamp?: string;
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid timing differences
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('TALENTLMS_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for Basic Auth (xAPI key:secret)
    const authHeader = req.headers.get('authorization');
    let isAuthenticated = false;

    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.slice(6);
      let credentials: string;
      try {
        credentials = atob(base64Credentials);
      } catch {
        console.error('Invalid base64 in authorization header');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const colonIndex = credentials.indexOf(':');
      if (colonIndex === -1) {
        console.error('Invalid credentials format');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const key = credentials.substring(0, colonIndex);
      const secret = credentials.substring(colonIndex + 1);
      
      // Verify against stored secret (format: key:secret or just secret)
      if (webhookSecret) {
        const colonIdx = webhookSecret.indexOf(':');
        const expectedSecret = colonIdx !== -1 ? webhookSecret.substring(colonIdx + 1) : webhookSecret;
        const expectedKey = colonIdx !== -1 ? webhookSecret.substring(0, colonIdx) : null;
        
        // Use timing-safe comparison
        if (expectedKey && !timingSafeEqual(key, expectedKey)) {
          console.error('Invalid xAPI key');
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!timingSafeEqual(secret, expectedSecret)) {
          console.error('Invalid xAPI secret');
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        isAuthenticated = true;
      }
    } else if (webhookSecret) {
      // Fallback: check query param or header
      const url = new URL(req.url);
      const querySecret = url.searchParams.get('secret');
      const headerSecret = req.headers.get('x-talentlms-webhook-secret');
      const providedSecret = headerSecret || querySecret;
      
      if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
        console.error('Invalid webhook secret');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      isAuthenticated = true;
    }

    // If webhook secret is configured but auth failed
    if (webhookSecret && !isAuthenticated) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse xAPI statement(s)
    const body = await req.json();
    const statements: XAPIStatement[] = Array.isArray(body) ? body : [body];
    
    console.log('Received xAPI statements:', statements.length);

    const results: Array<{ statementId?: string; success: boolean; message: string }> = [];

    for (const statement of statements) {
      // Extract user email from actor
      let userEmail: string | null = null;
      if (statement.actor.mbox) {
        userEmail = statement.actor.mbox.replace('mailto:', '');
      } else if (statement.actor.account?.name) {
        userEmail = statement.actor.account.name;
      }

      // Extract course ID from object
      const objectId = statement.object.id;
      const courseIdMatch = objectId.match(/course[\/:]?(\d+)|\/(\d+)$/);
      const courseId = courseIdMatch ? (courseIdMatch[1] || courseIdMatch[2]) : objectId;
      const courseName = statement.object.definition?.name?.['en-US'] || 
                         statement.object.definition?.name?.['en'] || 
                         `Course ${courseId}`;

      // Check if this is a completion verb
      const verbId = statement.verb.id;
      const isCompletion = verbId.includes('completed') || 
                           verbId.includes('passed') ||
                           verbId.includes('mastered') ||
                           statement.result?.completion === true;

      console.log(`Processing xAPI: user=${userEmail}, course=${courseId}, verb=${verbId}, completion=${isCompletion}`);

      if (!userEmail) {
        results.push({ 
          statementId: statement.id, 
          success: false, 
          message: 'No user email found in actor' 
        });
        continue;
      }

      // Find internal user by email
      let internalUserId: string | null = null;

      // Check talentlms_users first
      const { data: tlmsUser } = await supabase
        .from('talentlms_users')
        .select('user_id')
        .ilike('talentlms_username', userEmail)
        .maybeSingle();

      if (tlmsUser) {
        internalUserId = tlmsUser.user_id;
      }

      if (!internalUserId) {
        console.log(`No internal user found for email: ${userEmail}`);
        results.push({ 
          statementId: statement.id, 
          success: false, 
          message: `User not found: ${userEmail}` 
        });
        continue;
      }

      // Determine completion status
      const completionStatus = isCompletion ? 'completed' : 
                               statement.result?.score ? 'in_progress' : 
                               'not_started';

      const progressPercentage = isCompletion ? 100 : 
                                  (statement.result?.score?.scaled ? Math.round(statement.result.score.scaled * 100) : 0);

      // Update talentlms_progress
      const { error: upsertError } = await supabase
        .from('talentlms_progress')
        .upsert({
          user_id: internalUserId,
          talentlms_course_id: courseId,
          course_name: courseName,
          completion_status: completionStatus,
          progress_percentage: progressPercentage,
          test_score: statement.result?.score?.raw || null,
          completed_at: isCompletion ? (statement.timestamp || new Date().toISOString()) : null,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,talentlms_course_id',
        });

      if (upsertError) {
        console.error('Error upserting progress:', upsertError);
        results.push({ 
          statementId: statement.id, 
          success: false, 
          message: upsertError.message 
        });
        continue;
      }

      // If completed, update linked modules
      let modulesUpdated = 0;
      if (isCompletion) {
        const { data: modules } = await supabase
          .from('program_modules')
          .select('id, program_id, links')
          .not('links', 'is', null);

        if (modules) {
          for (const module of modules) {
            const links = module.links as unknown[] || [];
            const hasTalentLmsLink = links.some((link: unknown) => {
              const l = link as { type?: string; url?: string };
              return l.type === 'talentlms' && 
                (l.url?.includes(`/course/id:${courseId}`) || 
                 l.url?.includes(`course_id=${courseId}`) ||
                 l.url?.includes(`/${courseId}`));
            });

            if (hasTalentLmsLink) {
              const { data: enrollment } = await supabase
                .from('client_enrollments')
                .select('id')
                .eq('client_user_id', internalUserId)
                .eq('program_id', module.program_id)
                .maybeSingle();

              if (enrollment) {
                const { error: progressError } = await supabase
                  .from('module_progress')
                  .upsert({
                    enrollment_id: enrollment.id,
                    module_id: module.id,
                    status: 'completed',
                    completed_at: statement.timestamp || new Date().toISOString(),
                  }, {
                    onConflict: 'enrollment_id,module_id',
                  });

                if (!progressError) {
                  modulesUpdated++;
                  console.log(`Marked module ${module.id} as complete`);
                }
              }
            }
          }
        }
      }

      results.push({ 
        statementId: statement.id, 
        success: true, 
        message: `Processed: ${completionStatus}, modules updated: ${modulesUpdated}` 
      });
    }

    // xAPI LRS should return statement IDs
    return new Response(
      JSON.stringify(results.map(r => r.statementId || 'processed')),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing xAPI statement:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
