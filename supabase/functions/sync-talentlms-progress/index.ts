import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TalentLMSCourse {
  id: string;
  name: string;
  completion_status: string;
  completion_percentage: number;
  time_spent: number;
  score?: number;
  completed_on?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log(`Syncing TalentLMS progress for user ${user.id}`);

    // Get user's TalentLMS mapping
    const { data: talentLmsUser, error: mappingError } = await supabase
      .from('talentlms_users')
      .select('talentlms_user_id, talentlms_username')
      .eq('user_id', user.id)
      .maybeSingle();

    if (mappingError) {
      throw new Error(`Error fetching TalentLMS mapping: ${mappingError.message}`);
    }

    if (!talentLmsUser) {
      return new Response(
        JSON.stringify({ 
          error: 'TalentLMS account not linked',
          message: 'Please contact your administrator to link your TalentLMS account.'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch courses from TalentLMS API
    const talentLmsDomain = Deno.env.get('TALENTLMS_DOMAIN');
    const talentLmsApiKey = Deno.env.get('TALENTLMS_API_KEY');

    if (!talentLmsDomain || !talentLmsApiKey) {
      throw new Error('TalentLMS configuration missing');
    }

    const apiUrl = `https://${talentLmsDomain}/api/v1/users/id:${talentLmsUser.talentlms_user_id}/courses`;
    console.log(`Fetching courses from TalentLMS for user ${talentLmsUser.talentlms_user_id}`);

    const talentLmsResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${talentLmsApiKey}:`),
        'Content-Type': 'application/json',
      },
    });

    if (!talentLmsResponse.ok) {
      const errorText = await talentLmsResponse.text();
      console.error('TalentLMS API error:', errorText);
      throw new Error(`TalentLMS API error: ${talentLmsResponse.status}`);
    }

    const courses = await talentLmsResponse.json();
    console.log(`Fetched ${courses.length} courses from TalentLMS`);

    // Process and store progress for each course
    const progressUpdates = [];
    
    for (const course of courses) {
      // Determine completion status
      let completionStatus = 'not_started';
      if (course.completion_percentage === 100) {
        completionStatus = 'completed';
      } else if (course.completion_percentage > 0) {
        completionStatus = 'in_progress';
      }

      const progressData = {
        user_id: user.id,
        talentlms_course_id: course.id.toString(),
        course_name: course.name,
        completion_status: completionStatus,
        progress_percentage: Math.round(course.completion_percentage || 0),
        time_spent_minutes: Math.round((course.time_spent_unit === 'hours' ? course.time_spent * 60 : course.time_spent) || 0),
        test_score: course.score ? parseFloat(course.score) : null,
        completed_at: course.completed_on ? new Date(course.completed_on * 1000).toISOString() : null,
        last_synced_at: new Date().toISOString(),
      };

      progressUpdates.push(progressData);

      // Upsert progress data
      const { error: upsertError } = await supabase
        .from('talentlms_progress')
        .upsert(progressData, {
          onConflict: 'user_id,talentlms_course_id',
        });

      if (upsertError) {
        console.error(`Error upserting progress for course ${course.id}:`, upsertError);
      }

      // Auto-sync: Mark corresponding Evolve360 modules based on TalentLMS progress
      if (completionStatus === 'completed' || completionStatus === 'in_progress') {
        // Find modules linked to this TalentLMS course
        const { data: modules, error: modulesError } = await supabase
          .from('program_modules')
          .select('id, links')
          .not('links', 'is', null);

        if (!modulesError && modules) {
          for (const module of modules) {
            const links = module.links as any[] || [];
            const hasTalentLmsLink = links.some(link => 
              link.type === 'talentlms' && link.url.includes(course.id.toString())
            );

            if (hasTalentLmsLink) {
              console.log(`Found matching module ${module.id} for TalentLMS course ${course.id}, status: ${completionStatus}`);
              
              // Get user's enrollment for this module's program
              const { data: enrollment, error: enrollmentError } = await supabase
                .from('program_modules')
                .select('program_id')
                .eq('id', module.id)
                .single();

              if (!enrollmentError && enrollment) {
                const { data: userEnrollment, error: userEnrollmentError } = await supabase
                  .from('client_enrollments')
                  .select('id')
                  .eq('client_user_id', user.id)
                  .eq('program_id', enrollment.program_id)
                  .maybeSingle();

                if (!userEnrollmentError && userEnrollment) {
                  // Prepare the progress data based on TalentLMS status
                  const moduleProgressData: Record<string, any> = {
                    enrollment_id: userEnrollment.id,
                    module_id: module.id,
                    status: completionStatus,
                  };
                  
                  // Only set completed_at for completed status
                  if (completionStatus === 'completed') {
                    moduleProgressData.completed_at = progressData.completed_at || new Date().toISOString();
                  }

                  // Upsert module progress
                  const { error: progressError } = await supabase
                    .from('module_progress')
                    .upsert(moduleProgressData, {
                      onConflict: 'enrollment_id,module_id',
                    });

                  if (progressError) {
                    console.error(`Error updating module ${module.id} progress:`, progressError);
                  } else {
                    console.log(`Successfully updated module ${module.id} to ${completionStatus} via TalentLMS sync`);
                  }
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        coursesProcessed: progressUpdates.length,
        message: 'TalentLMS progress synced successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in sync-talentlms-progress function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
