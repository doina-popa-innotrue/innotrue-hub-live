-- Insert email template for assignment submission notification (for instructors/coaches)
INSERT INTO public.email_templates (template_key, name, subject, html_content, description)
VALUES (
  'assignment_submitted',
  'Assignment Submitted (for Instructors)',
  'Assignment Submitted: {{assignmentName}} - {{clientName}}',
  '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">📋 Assignment Submitted</h1>
    </div>
    <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p>Hello,</p>
      <p><strong>{{clientName}}</strong> has submitted an assignment for your review.</p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #6366f1;">
        <p style="margin: 0 0 8px 0;"><strong>Assignment:</strong> {{assignmentName}}</p>
        <p style="margin: 0 0 8px 0;"><strong>Module:</strong> {{moduleName}}</p>
        <p style="margin: 0;"><strong>Program:</strong> {{programName}}</p>
      </div>
      
      <p>Please log in to the InnoTrue Hub to review the submission and provide feedback.</p>
      
      <a href="{{reviewLink}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">
        Review Assignment
      </a>
    </div>
    <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
      <p>This is an automated notification from InnoTrue Hub.</p>
    </div>
  </div>
</div>',
  'Sent to instructors and coaches when a client submits an assignment for review. Available variables: {{clientName}}, {{assignmentName}}, {{moduleName}}, {{programName}}, {{reviewLink}}'
)
ON CONFLICT (template_key) DO NOTHING;

-- Insert email template for assignment graded notification (for clients)
INSERT INTO public.email_templates (template_key, name, subject, html_content, description)
VALUES (
  'assignment_graded',
  'Assignment Graded (for Clients)',
  'Your Assignment Has Been Reviewed: {{assignmentName}}',
  '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">✅ Your Assignment Has Been Reviewed</h1>
    </div>
    <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p>Hi {{clientName}},</p>
      <p>Good news! Your assignment has been reviewed by {{instructorName}}.</p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0 0 8px 0;"><strong>Assignment:</strong> {{assignmentName}}</p>
        <p style="margin: 0 0 8px 0;"><strong>Module:</strong> {{moduleName}}</p>
        <p style="margin: 0;"><strong>Program:</strong> {{programName}}</p>
      </div>
      
      <p>Log in to view your feedback and assessment results.</p>
      
      <a href="{{viewLink}}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">
        View Feedback
      </a>
    </div>
    <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
      <p>This is an automated notification from InnoTrue Hub.</p>
    </div>
  </div>
</div>',
  'Sent to clients when their assignment has been reviewed/graded. Available variables: {{clientName}}, {{instructorName}}, {{assignmentName}}, {{moduleName}}, {{programName}}, {{viewLink}}'
)
ON CONFLICT (template_key) DO NOTHING;

-- Add notification preference for assignment graded
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS assignment_graded boolean DEFAULT true;

-- Add notification preference for assignment submitted (for instructors)
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS assignment_submitted boolean DEFAULT true;