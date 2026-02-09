-- Insert all email templates from hardcoded edge function content

-- Auth emails (send-auth-email)
INSERT INTO public.email_templates (template_key, name, subject, html_content, description) VALUES
('auth_signup_confirm', 'Signup Confirmation', 'Confirm your email address', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Welcome to InnoTrue Hub!</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Please confirm your email address by clicking the link below:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{confirmationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm Email</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{confirmationLink}}</p>
  </div>
</body>
</html>', 'Sent when users sign up via Supabase Auth. Variables: {{confirmationLink}}'),

('auth_magic_link', 'Magic Link Sign In', 'Your magic link to sign in', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Sign in to InnoTrue Hub</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Click the link below to sign in:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{confirmationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign In</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{confirmationLink}}</p>
  </div>
</body>
</html>', 'Sent for passwordless magic link sign in. Variables: {{confirmationLink}}'),

('auth_password_recovery', 'Password Recovery', 'Reset your password', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Reset your password</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Click the link below to reset your password:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{confirmationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{confirmationLink}}</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn''t request this, you can safely ignore this email.</p>
  </div>
</body>
</html>', 'Sent for password reset requests. Variables: {{confirmationLink}}'),

('auth_email_change', 'Email Change Confirmation', 'Confirm your new email address', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Confirm Email Change</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">You requested to change your email address. Click the link below to confirm this change:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{confirmationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm Email Change</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{confirmationLink}}</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn''t request this change, please contact support immediately.</p>
  </div>
</body>
</html>', 'Sent when users request to change their email. Variables: {{confirmationLink}}'),

-- Signup verification (signup-user)
('signup_verification', 'Signup Verification', 'Confirm your email address - InnoTrue Hub', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin-bottom: 24px;">Welcome to InnoTrue Hub!</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Hi {{userName}},</p>
    <p style="color: #666; font-size: 16px; line-height: 1.5;">Thank you for signing up! Please confirm your email address by clicking the button below:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verificationLink}}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm Email Address</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 14px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">{{verificationLink}}</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This link will expire in 24 hours. If you didn''t create an account, you can safely ignore this email.</p>
  </div>
</body>
</html>', 'Sent when users sign up via custom signup flow. Variables: {{userName}}, {{verificationLink}}'),

-- Organization invite (send-org-invite)
('org_invite', 'Organization Invitation', 'You''ve been invited to join {{organizationName}}', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You''re Invited!</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hello,</p>
    <p style="font-size: 16px;">You''ve been invited to join <strong>{{organizationName}}</strong> as a <strong>{{roleDisplay}}</strong> on InnoTrue Hub.</p>
    <p style="font-size: 16px;">Click the button below to accept this invitation:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{inviteLink}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>
    <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
    <p style="font-size: 14px; color: #666; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">{{inviteLink}}</p>
    <p style="font-size: 14px; color: #999; margin-top: 30px;">This invitation will expire in 7 days. If you didn''t expect this invitation, you can safely ignore this email.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© {{currentYear}} InnoTrue Hub. All rights reserved.</p>
  </div>
</body>
</html>', 'Sent when inviting users to an organization. Variables: {{organizationName}}, {{roleDisplay}}, {{inviteLink}}, {{currentYear}}'),

-- Account deletion (request-account-deletion)
('account_deletion_user', 'Account Deletion Request - User Confirmation', 'Account Deletion Request Received', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">Account Deletion Request Received</h2>
  <p>Dear {{userName}},</p>
  <p>We have received your request to delete your InnoTrue Hub account. Our team will review your request and process it in accordance with our data retention policies.</p>
  <p>If you did not make this request or have changed your mind, please contact us immediately at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
  <p>Please note that account deletion is permanent and all your data including:</p>
  <ul>
    <li>Program enrollments and progress</li>
    <li>Goals and milestones</li>
    <li>Decisions and reflections</li>
    <li>All other associated data</li>
  </ul>
  <p>will be permanently removed and cannot be recovered.</p>
  <p>Best regards,<br>The InnoTrue Hub Team</p>
</body>
</html>', 'Sent to users when they request account deletion. Variables: {{userName}}, {{supportEmail}}'),

('account_deletion_admin', 'Account Deletion Request - Admin Notification', 'Account Deletion Request from {{userName}}', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">New Account Deletion Request</h2>
  <p>A user has requested to delete their account.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userName}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userEmail}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>User ID:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{userId}}</td>
    </tr>
    {{#if reason}}
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{reason}}</td>
    </tr>
    {{/if}}
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Requested at:</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;">{{requestedAt}}</td>
    </tr>
  </table>
  <p>Please review and process this request in the admin dashboard.</p>
</body>
</html>', 'Sent to admins when a user requests account deletion. Variables: {{userName}}, {{userEmail}}, {{userId}}, {{reason}}, {{requestedAt}}'),

-- Subscription reminders (subscription-reminders)
('subscription_reminder', 'Subscription Renewal Reminder', 'Your InnoTrue Hub subscription renews in {{timeframe}}', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">InnoTrue Hub</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Hi {{userName}},</h2>
    
    <p>This is a friendly reminder that your InnoTrue Hub subscription will renew in <strong>{{timeframe}}</strong>.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 16px;">
        <strong>Renewal Date:</strong> {{renewalDate}}
      </p>
    </div>
    
    <p>If you''d like to make any changes to your subscription, you can do so from your account settings.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{subscriptionLink}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Manage Subscription
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If you have any questions, please don''t hesitate to reach out to our support team.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      © {{currentYear}} InnoTrue Hub. All rights reserved.
    </p>
  </div>
</body>
</html>', 'Sent to remind users about upcoming subscription renewals. Variables: {{userName}}, {{timeframe}}, {{renewalDate}}, {{subscriptionLink}}, {{currentYear}}'),

-- AI usage alert (check-ai-usage)
('ai_usage_alert', 'AI Credit Usage Alert', '⚠️ AI Credit Usage Alert - {{usagePercent}}% of Monthly Limit', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>AI Credit Usage Alert</h2>
  <p>Your platform''s AI credit usage has reached <strong>{{usagePercent}}%</strong> of the monthly limit.</p>
  <ul>
    <li><strong>Credits Used:</strong> {{creditsUsed}}</li>
    <li><strong>Monthly Limit:</strong> {{monthlyLimit}}</li>
    <li><strong>Alert Threshold:</strong> {{alertThreshold}}%</li>
  </ul>
  <p>Consider reviewing usage patterns or increasing the monthly limit in System Settings.</p>
  <p>This alert is sent once per month when the threshold is reached.</p>
</body>
</html>', 'Sent to admins when AI credit usage exceeds threshold. Variables: {{usagePercent}}, {{creditsUsed}}, {{monthlyLimit}}, {{alertThreshold}}'),

-- Wheel of Life PDF (send-wheel-pdf)
('wheel_of_life_results', 'Wheel of Life Results', '🎯 Your Wheel of Life Results - {{userName}}', '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Wheel of Life Results</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎯 Wheel of Life Results</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your personal life balance assessment</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #374151;">Hello {{userName}},</p>
    <p style="font-size: 16px; color: #374151;">Thank you for completing the Wheel of Life assessment. Here''s a summary of your results:</p>
    
    <!-- Summary Stats -->
    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <div style="display: inline-block; margin: 0 20px;">
        <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">{{average}}</div>
        <div style="font-size: 12px; color: #6b7280;">Average</div>
      </div>
      <div style="display: inline-block; margin: 0 20px;">
        <div style="font-size: 24px; font-weight: 700; color: #22c55e;">{{highest}}</div>
        <div style="font-size: 12px; color: #6b7280;">Highest</div>
      </div>
      <div style="display: inline-block; margin: 0 20px;">
        <div style="font-size: 24px; font-weight: 700; color: #ef4444;">{{lowest}}</div>
        <div style="font-size: 12px; color: #6b7280;">Lowest</div>
      </div>
    </div>

    <!-- All Ratings -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">Your Ratings</h3>
    {{ratingsHtml}}

    <!-- Growth Areas -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">🌱 Areas for Growth</h3>
    {{growthAreasHtml}}

    <!-- Strengths -->
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">💪 Your Strengths</h3>
    {{strengthsHtml}}

    {{#if notes}}
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">📝 Your Notes</h3>
    <p style="color: #6b7280; font-style: italic; background: #f9fafb; padding: 15px; border-radius: 8px;">{{notes}}</p>
    {{/if}}

    <!-- CTA -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 25px; border-radius: 8px; text-align: center; margin-top: 30px;">
      <h3 style="color: white; margin: 0 0 10px 0;">Ready to improve your life balance?</h3>
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 15px 0;">Join InnoTrue Hub to track your progress and receive personalized guidance.</p>
      <a href="{{ctaLink}}" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">Get Started</a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>InnoTrue Hub - Your Personal Development Partner</p>
    <p>If you have any questions, reply to this email.</p>
  </div>
</body>
</html>', 'Sent with Wheel of Life assessment results. Variables: {{userName}}, {{average}}, {{highest}}, {{lowest}}, {{ratingsHtml}}, {{growthAreasHtml}}, {{strengthsHtml}}, {{notes}}, {{ctaLink}}')

ON CONFLICT (template_key) DO NOTHING;