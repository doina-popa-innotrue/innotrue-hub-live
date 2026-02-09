import { createClient } from "npm:@supabase/supabase-js@2";

// Restrict CORS to your app's origin for security
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SUPABASE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Unauthorized access attempt by user:', user.id);
      throw new Error('Unauthorized: Admin access required');
    }

    // Get demo credentials from environment (must be set in Supabase secrets)
    const demoAdminEmail = Deno.env.get('DEMO_ADMIN_EMAIL');
    const demoAdminPassword = Deno.env.get('DEMO_ADMIN_PASSWORD');
    const demoClientPassword = Deno.env.get('DEMO_CLIENT_PASSWORD');

    if (!demoAdminEmail || !demoAdminPassword || !demoClientPassword) {
      throw new Error('Demo credentials not configured. Please set DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, and DEMO_CLIENT_PASSWORD secrets.');
    }

    // Create admin user
    console.log('Creating admin user...');
    const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: demoAdminEmail,
      password: demoAdminPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Admin User'
      }
    });

    if (adminError) {
      console.error('Admin user error:', adminError);
      if (!adminError.message.includes('already registered')) {
        throw adminError;
      }
      console.log('Admin user already exists');
    } else {
      console.log('Admin user created:', adminUser.user.id);
      
      // Add admin role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: adminUser.user.id, role: 'admin' });
      
      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Admin role error:', roleError);
      }
    }

    // Create client 1 with a generated unique email
    const client1Email = `client1-${Date.now()}@demo.local`;
    console.log('Creating client 1...');
    const { data: client1, error: client1Error } = await supabaseAdmin.auth.admin.createUser({
      email: client1Email,
      password: demoClientPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Sarah Johnson'
      }
    });

    if (client1Error && !client1Error.message.includes('already registered')) {
      throw client1Error;
    }

    if (client1 && client1.user) {
      console.log('Client 1 created:', client1.user.id);
      
      // Add client role
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: client1.user.id, role: 'client' });
      
      // Add client profile
      await supabaseAdmin
        .from('client_profiles')
        .insert({ 
          user_id: client1.user.id, 
          status: 'active',
          notes: 'Executive coaching client focused on leadership development'
        });
    }

    // Create client 2
    const client2Email = `client2-${Date.now()}@demo.local`;
    console.log('Creating client 2...');
    const { data: client2, error: client2Error } = await supabaseAdmin.auth.admin.createUser({
      email: client2Email,
      password: demoClientPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Michael Chen'
      }
    });

    if (client2Error && !client2Error.message.includes('already registered')) {
      throw client2Error;
    }

    if (client2 && client2.user) {
      console.log('Client 2 created:', client2.user.id);
      
      // Add client role
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: client2.user.id, role: 'client' });
      
      // Add client profile
      await supabaseAdmin
        .from('client_profiles')
        .insert({ 
          user_id: client2.user.id, 
          status: 'active',
          notes: 'Working on personal transformation and clarity'
        });
    }

    // Get programs
    const { data: programs } = await supabaseAdmin
      .from('programs')
      .select('id, slug, name');

    console.log('Found programs:', programs?.length);

    if (programs && client1 && client1.user) {
      // Enroll client 1 in CTA Immersion
      const ctaProgram = programs.find(p => p.slug === 'cta-immersion-premium');
      if (ctaProgram) {
        console.log('Enrolling client 1 in CTA Immersion...');
        const { data: enrollment } = await supabaseAdmin
          .from('client_enrollments')
          .insert({
            client_user_id: client1.user.id,
            program_id: ctaProgram.id,
            status: 'active'
          })
          .select()
          .single();

        if (enrollment) {
          // Get modules for this program
          const { data: modules } = await supabaseAdmin
            .from('program_modules')
            .select('id, order_index')
            .eq('program_id', ctaProgram.id)
            .order('order_index');

          if (modules) {
            // Mark first 3 modules as completed
            const progressRecords: Array<{
              enrollment_id: string;
              module_id: string;
              status: string;
              completed_at: string | null;
              notes: string | null;
            }> = modules.slice(0, 3).map(m => ({
              enrollment_id: enrollment.id,
              module_id: m.id,
              status: 'completed',
              completed_at: new Date().toISOString(),
              notes: 'Completed during onboarding'
            }));

            // Mark 4th module as in_progress
            if (modules[3]) {
              progressRecords.push({
                enrollment_id: enrollment.id,
                module_id: modules[3].id,
                status: 'in_progress',
                completed_at: null,
                notes: null
              });
            }

            await supabaseAdmin
              .from('module_progress')
              .insert(progressRecords);
            
            console.log('Added progress for client 1');
          }
        }
      }
    }

    if (programs && client2 && client2.user) {
      // Enroll client 2 in Leadership Elevate
      const leadershipProgram = programs.find(p => p.slug === 'leadership-elevate');
      if (leadershipProgram) {
        console.log('Enrolling client 2 in Leadership Elevate...');
        const { data: enrollment } = await supabaseAdmin
          .from('client_enrollments')
          .insert({
            client_user_id: client2.user.id,
            program_id: leadershipProgram.id,
            status: 'active'
          })
          .select()
          .single();

        if (enrollment) {
          // Get modules for this program
          const { data: modules } = await supabaseAdmin
            .from('program_modules')
            .select('id, order_index')
            .eq('program_id', leadershipProgram.id)
            .order('order_index');

          if (modules) {
            // Mark first 2 modules as completed
            const progressRecords: Array<{
              enrollment_id: string;
              module_id: string;
              status: string;
              completed_at: string | null;
              notes: string | null;
            }> = modules.slice(0, 2).map(m => ({
              enrollment_id: enrollment.id,
              module_id: m.id,
              status: 'completed',
              completed_at: new Date().toISOString(),
              notes: 'Great insights on leadership identity'
            }));

            await supabaseAdmin
              .from('module_progress')
              .insert(progressRecords);
            
            console.log('Added progress for client 2');
          }
        }
      }

      // Also enroll client 2 in CTA Immersion
      const ctaProgram = programs.find(p => p.slug === 'cta-immersion-premium');
      if (ctaProgram) {
        console.log('Enrolling client 2 in CTA Immersion...');
        await supabaseAdmin
          .from('client_enrollments')
          .insert({
            client_user_id: client2.user.id,
            program_id: ctaProgram.id,
            status: 'active'
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Demo data seeded successfully',
        note: 'Demo users created using configured secrets. Emails are unique per execution.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage === 'Unauthorized' || errorMessage.includes('Unauthorized') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    )
  }
})
