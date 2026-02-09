-- Create email_templates table for customizable email content
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage templates
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update email templates"
ON public.email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default welcome email template
INSERT INTO public.email_templates (template_key, name, subject, html_content, description)
VALUES (
  'welcome_email',
  'Welcome Email',
  'Welcome to InnoTrue Hub - Set Up Your Account',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to InnoTrue Hub!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your account has been created and you''re ready to begin your journey with us!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; color: #666;"><strong>To get started, please set up your password:</strong></p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{passwordSetupLink}}" 
         style="background: #667eea; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
        Set Up Your Password
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px;">Or copy and paste this link into your browser:</p>
    <p style="color: #999; font-size: 12px; word-break: break-all;">{{passwordSetupLink}}</p>
    
    <hr style="border: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666;">Once you''ve set your password, you can log in and explore:</p>
    <ul style="font-size: 14px; color: #666;">
      <li>Your assigned programs and modules</li>
      <li>Track your progress and achievements</li>
      <li>Connect with your coaches and instructors</li>
    </ul>
    
    <p style="font-size: 14px; color: #999; margin-top: 30px;">
      <em>This link will expire in 24 hours. If you need a new link, please contact your administrator.</em>
    </p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>',
  'Sent when an admin manually triggers a welcome email for a new user. Available variables: {{userName}}, {{passwordSetupLink}}'
);