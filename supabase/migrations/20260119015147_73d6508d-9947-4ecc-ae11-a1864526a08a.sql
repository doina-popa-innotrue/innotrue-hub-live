-- Insert notification email templates for send-notification-email function
INSERT INTO public.email_templates (template_key, name, subject, html_content, description)
VALUES
('notification_profile_update', 'Profile Updated Notification', 'Profile Updated - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Profile Updated</h2>
  <p>Hi {{userName}},</p>
  <p>Your profile information has been successfully updated.</p>
  <p><strong>Time:</strong> {{timestamp}}</p>
  <p>If you did not make this change, please contact support immediately.</p>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Sent when a user updates their profile'),

('notification_password_change', 'Password Changed Notification', 'Password Changed - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #d32f2f;">Security Alert: Password Changed</h2>
  <p>Hi {{userName}},</p>
  <p>Your account password has been successfully changed.</p>
  <p><strong>Time:</strong> {{timestamp}}</p>
  <p style="color: #d32f2f; font-weight: bold;">If you did not make this change, your account may be compromised. Please contact support immediately and secure your account.</p>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Sent when a user changes their password'),

('notification_email_change', 'Email Change Request', 'Email Change Request - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Email Change Requested</h2>
  <p>Hi {{userName}},</p>
  <p>A request was made to change your account email address.</p>
  <p><strong>Time:</strong> {{timestamp}}</p>
  <p>If you made this request, please check your new email address and click the verification link to complete the change.</p>
  <p>If you did not make this request, please ignore this notification and contact support if you have concerns.</p>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Sent when user requests email change'),

('notification_email_change_old', 'Email Changed (Old Address)', 'Your Email Address Has Been Changed - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #d32f2f; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">⚠️ Security Alert: Email Changed</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your InnoTrue Hub account email has been successfully changed.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
      <p style="margin: 10px 0;"><strong style="color: #666;">New Email:</strong> {{newEmail}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Changed:</strong> {{timestamp}}</p>
    </div>
    <p style="color: #d32f2f; font-weight: bold; font-size: 14px;">This email was sent to your previous address as a security notification.</p>
    <p style="color: #666; font-size: 14px;">If you did not make this change, your account may be compromised. Please contact support immediately.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Sent to old email when email is changed'),

('notification_email_change_verification', 'Confirm Email Change', 'Confirm Your Email Change - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🔐 Confirm Email Change</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You requested to change your InnoTrue Hub account email to this address.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 10px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="color: #666; font-size: 14px;">Please click the button below to confirm this change:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{verificationUrl}}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Confirm Email Change</a>
    </div>
    <p style="color: #999; font-size: 12px;">Or copy and paste this link into your browser:</p>
    <p style="color: #999; font-size: 12px; word-break: break-all;">{{verificationUrl}}</p>
    <p style="color: #d32f2f; font-size: 14px; margin-top: 20px;">⚠️ This link will expire in 24 hours.</p>
    <p style="color: #666; font-size: 14px;">If you didn''t request this change, you can safely ignore this email.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent to new email for verification'),

('notification_email_change_initiated', 'Email Change Initiated', 'Email Change Request - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">⚠️ Email Change Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">A request was made to change your InnoTrue Hub account email from this address to <strong>{{newEmail}}</strong>.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 10px 0;"><strong style="color: #666;">New Email:</strong> {{newEmail}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="color: #666; font-size: 14px;">A confirmation email has been sent to the new email address. The change will only be completed after verification.</p>
    <p style="color: #d32f2f; font-weight: bold; font-size: 14px; margin-top: 20px;">If you didn''t make this change, please secure your account immediately by changing your password.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Sent to current email when change is initiated'),

('notification_admin_email_change', 'Admin Email Change', 'Your Email Address Has Been Updated - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">📧 Email Address Updated</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">An administrator has updated your InnoTrue Hub account email address to this address.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
      <p style="margin: 10px 0;"><strong style="color: #666;">Updated:</strong> {{timestamp}}</p>
    </div>
    <p style="color: #666; font-size: 14px;">You can now use this email address to sign in to your account.</p>
    <p style="color: #999; font-size: 14px; font-style: italic;">If you have any questions about this change, please contact your administrator.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when admin changes user email'),

('notification_email_change_new', 'Email Changed (New Address)', 'Welcome to Your New Email Address - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">✅ Email Successfully Updated!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your InnoTrue Hub account email has been successfully updated to this address.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 10px 0;"><strong style="color: #666;">New Email:</strong> {{newEmail}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Updated:</strong> {{timestamp}}</p>
    </div>
    <p style="color: #666; font-size: 14px;">You can now use this email address to sign in to your account.</p>
    <p style="color: #999; font-size: 14px; font-style: italic;">If you did not make this change, please contact support immediately.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent to new email after change is complete'),

('notification_program_assignment', 'Program Assignment', 'New Program Assigned: {{programName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎉 New Program Assigned!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Great news! You''ve been enrolled in a new program.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0;">{{programName}}</h2>
      <p style="color: #666; margin-bottom: 0;">{{programDescription}}</p>
    </div>
    <p style="font-size: 14px; color: #666;"><strong>Assigned:</strong> {{timestamp}}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/programs" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Program</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to your dashboard to start exploring the program modules and begin your journey.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when user is assigned to a program'),

('notification_talentlms_reconnect', 'TalentLMS Reconnect Request', 'TalentLMS Reconnection Request from {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🔗 TalentLMS Reconnection Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;">A user has requested to reconnect their TalentLMS account.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please log in to the admin panel to set up this user''s TalentLMS account mapping.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/talentlms" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage TalentLMS Users</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent to admins for TalentLMS reconnection'),

('notification_tier_change', 'Tier Upgrade', 'Tier Upgraded: {{programName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎉 Subscription Tier Upgraded!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Great news! Your subscription tier has been upgraded.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h2 style="color: #10b981; margin-top: 0;">{{programName}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">Previous Tier:</strong> <span style="color: #999;">{{oldTier}}</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">New Tier:</strong> <span style="color: #10b981; font-weight: bold;">{{newTier}}</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Upgraded:</strong> {{timestamp}}</p>
    </div>
    {{unlockedModulesHtml}}
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/programs" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Explore Unlocked Content</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to your dashboard to access the newly available modules and continue your learning journey!</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when user tier is upgraded'),

('notification_instructor_program', 'Instructor Program Assignment', 'New Program Assignment as Instructor: {{programName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">👨‍🏫 New Instructor Assignment</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You''ve been assigned as an instructor for a new program.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <h2 style="color: #3b82f6; margin-top: 0;">{{programName}}</h2>
      <p style="color: #666; margin: 10px 0;">{{programDescription}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Role:</strong> <span style="color: #3b82f6; font-weight: bold;">Instructor</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Assigned:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Program</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to see the program modules and start working with your students.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when instructor is assigned to program'),

('notification_coach_program', 'Coach Program Assignment', 'New Program Assignment as Coach: {{programName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎯 New Coach Assignment</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You''ve been assigned as a coach for a new program.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
      <h2 style="color: #8b5cf6; margin-top: 0;">{{programName}}</h2>
      <p style="color: #666; margin: 10px 0;">{{programDescription}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Role:</strong> <span style="color: #8b5cf6; font-weight: bold;">Coach</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Assigned:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Program</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to see the program modules and start coaching your clients.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when coach is assigned to program'),

('notification_instructor_module', 'Instructor Module Assignment', 'New Module Assignment as Instructor: {{moduleName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">👨‍🏫 New Module Instructor Assignment</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You''ve been assigned as an instructor for a module.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <h2 style="color: #3b82f6; margin-top: 0;">{{moduleName}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">Program:</strong> {{programName}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Module Type:</strong> {{moduleType}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Role:</strong> <span style="color: #3b82f6; font-weight: bold;">Instructor</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Assigned:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Module</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to see the module details and start working with your students.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when instructor assigned to module'),

('notification_coach_module', 'Coach Module Assignment', 'New Module Assignment as Coach: {{moduleName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎯 New Module Coach Assignment</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You''ve been assigned as a coach for a module.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
      <h2 style="color: #8b5cf6; margin-top: 0;">{{moduleName}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">Program:</strong> {{programName}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Module Type:</strong> {{moduleType}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Role:</strong> <span style="color: #8b5cf6; font-weight: bold;">Coach</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Assigned:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Module</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to see the module details and start coaching your clients.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when coach assigned to module'),

('notification_goal_shared', 'Goal Shared', 'Goal Shared: {{goalTitle}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎯 New Goal Shared With You</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">{{sharedByName}} has shared a personal goal with you for feedback and support.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ec4899;">
      <h2 style="color: #ec4899; margin-top: 0;">{{goalTitle}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">Shared by:</strong> {{sharedByName}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Shared on:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Goal & Provide Feedback</a>
    </div>
    <p style="color: #666; font-size: 14px;">You can now view this goal, track its progress, and provide feedback to help {{sharedByName}} achieve their objectives.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when a goal is shared'),

('notification_goal_feedback', 'Goal Feedback', 'New Feedback on Your Goal: {{goalTitle}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">💬 New Feedback on Your Goal</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">{{feedbackAuthor}} has left feedback on your goal.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #14b8a6;">
      <h2 style="color: #14b8a6; margin-top: 0;">{{goalTitle}}</h2>
      <div style="background: #f0fdfa; padding: 15px; border-radius: 6px; margin-top: 15px;">
        <p style="color: #666; font-size: 14px; margin: 0;"><strong>{{feedbackAuthor}}:</strong></p>
        <p style="color: #333; margin: 10px 0 0 0;">{{feedbackPreview}}</p>
      </div>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #14b8a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Full Feedback</a>
    </div>
    <p style="color: #666; font-size: 14px;">Log in to see the complete feedback and continue the conversation about your goal.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when feedback is added to a goal'),

('notification_program_interest', 'Program Interest Registration', 'New Program Interest Registration from {{registrantName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">📝 New Program Interest Registration</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello {{userName}},</p>
    <p style="font-size: 16px; color: #333;">A user has expressed interest in enrolling in a program.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <h2 style="color: #f59e0b; margin-top: 0;">{{programName}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">User Name:</strong> {{registrantName}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Email:</strong> {{registrantEmail}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Preferred Timeline:</strong> <span style="color: #f59e0b; font-weight: bold;">{{enrollmentTimeframe}}</span></p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Registered:</strong> {{timestamp}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/interest-registrations" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Registration</a>
    </div>
    <p style="color: #666; font-size: 14px;">Please review this registration and take appropriate action.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when user registers interest in program'),

('notification_schedule_reminder', 'Schedule Reminder', 'Reminder: {{scheduleTitle}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">⏰ Upcoming Schedule Reminder</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">This is a reminder about an upcoming scheduled item.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
      <h2 style="color: #6366f1; margin-top: 0;">{{scheduleTitle}}</h2>
      <p style="margin: 10px 0;"><strong style="color: #666;">Scheduled Date:</strong> {{scheduledDate}}</p>
    </div>
    <p style="color: #666; font-size: 14px;">Make sure you''re prepared and ready!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/dashboard" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Dashboard</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent as schedule reminder'),

('notification_waitlist_available', 'Waitlist Spot Available', '🎉 A Spot is Available: {{programName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🎉 Great News! A Spot Is Available</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">A spot has opened up in a program you were waitlisted for!</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h2 style="color: #10b981; margin-top: 0;">{{programName}}</h2>
      <p style="color: #666; margin-bottom: 0;">{{programDescription}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/programs" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Enroll Now</a>
    </div>
    <p style="color: #666; font-size: 14px;">This spot won''t last long. Log in now to secure your enrollment!</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when waitlist spot becomes available'),

('notification_registration_followup', 'Registration Follow Up', 'Still Interested in {{programName}}? - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">👋 Following Up on Your Interest</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">We noticed you registered interest in <strong>{{programName}}</strong> {{daysSinceRegistration}} days ago. Are you still interested in enrolling?</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
      <h2 style="color: #6366f1; margin-top: 0;">{{programName}}</h2>
      <p style="color: #666; margin-bottom: 0;">{{programDescription}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Learn More</a>
    </div>
    <p style="color: #666; font-size: 14px;">If you have any questions about the program, feel free to reach out to us.</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent as follow up after registration'),

('notification_account_deactivation', 'Account Deactivation Request', 'Account Deactivation Request - {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">⏸️ Account Deactivation Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;">A user has requested to deactivate their account.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please review this request and take appropriate action from the admin panel.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/users" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Users</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent to admins for deactivation request'),

('notification_account_deletion_admin', 'Account Deletion Request (Admin)', '⚠️ Account Deletion Request - {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🗑️ Account Deletion Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;"><strong style="color: #dc2626;">Important:</strong> A user has requested to permanently delete their account.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #dc2626; font-weight: bold;">⚠️ Deleting an account is permanent and cannot be undone. All user data will be lost.</p>
    <p style="font-size: 14px; color: #666;">Please review this request carefully and take appropriate action from the admin panel.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/users" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Users</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent to admins for deletion request'),

('notification_subscription_plan', 'Subscription Plan Request', '📋 Subscription Plan Request - {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">📋 Subscription Plan Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;">A user has requested to change their subscription plan.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Requested Plan:</strong> {{planName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please review this request and take appropriate action from the admin panel.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/users" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Users</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent for subscription plan change requests'),

('notification_subscription_addon', 'Add-On Request', '🧩 Add-On Request - {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🧩 Add-On Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;">A user has requested to add a new add-on to their account.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Requested Add-On:</strong> {{addOnName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please review this request and take appropriate action from the admin panel.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/admin/user-add-ons" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage User Add-Ons</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent for add-on requests'),

('notification_badge_issued', 'Badge Issued', 'Congratulations! You''ve Earned a Badge - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🏆 Congratulations!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">You''ve earned a badge for completing <strong>{{programName}}</strong>!</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fbbf24; text-align: center;">
      <h2 style="color: #f59e0b; margin-top: 0;">🎖️ {{badgeName}}</h2>
      {{badgeDescription}}
    </div>
    <p style="font-size: 14px; color: #666;"><strong>Issued:</strong> {{timestamp}}</p>
    <p style="font-size: 14px; color: #666;">Your badge has been added to your profile. You can view it in your dashboard and choose to display it on your public profile.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/dashboard" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View My Badges</a>
    </div>
    <p style="color: #666; font-size: 14px;">Keep up the great work on your learning journey!</p>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when badge is issued'),

('notification_circle_connection', 'Community Connection Request', 'Community Connection Request - {{userName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">👥 Community Connection Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hello Administrator,</p>
    <p style="font-size: 16px; color: #333;">A user has requested to be connected to the InnoTrue Community.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
      <p style="margin: 5px 0;"><strong style="color: #666;">User Name:</strong> {{userName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{userEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please review this request and set up the user''s Community account mapping.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Community Users</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent for community connection requests'),

('notification_session_request', 'Session Request', 'Session Request: {{moduleName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">📅 New Session Request</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">A client has requested a session with you.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 5px 0;"><strong style="color: #666;">Client:</strong> {{clientName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Email:</strong> {{clientEmail}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Module:</strong> {{moduleName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Program:</strong> {{programName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Request Time:</strong> {{timestamp}}</p>
    </div>
    <p style="font-size: 14px; color: #666;">Please review this request and schedule a session for the client.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{entityLink}}" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Request</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when session is requested'),

('notification_session_scheduled', 'Session Scheduled', 'Session Scheduled: {{moduleName}} - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">📅 Session Scheduled!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">A session has been scheduled for you.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 5px 0;"><strong style="color: #666;">Session:</strong> {{sessionTitle}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Module:</strong> {{moduleName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Program:</strong> {{programName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Instructor:</strong> {{instructorName}}</p>
      <p style="margin: 5px 0;"><strong style="color: #666;">Date & Time:</strong> {{scheduledDate}}</p>
    </div>
    {{meetingSection}}
    {{schedulingSection}}
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when session is scheduled'),

('notification_org_seat_warning', 'Organization Seat Limit Warning', '⚠️ Approaching Sponsored Seat Limit - {{organizationName}}', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">⚠️ Approaching Seat Limit</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your organization <strong>{{organizationName}}</strong> is approaching its sponsored seat limit.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 10px 0;"><strong style="color: #666;">Used Seats:</strong> {{usedSeats}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Maximum Seats:</strong> {{maxSeats}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Usage:</strong> {{percentUsed}}%</p>
    </div>
    <p style="color: #666; font-size: 14px;">Consider upgrading your plan to add more sponsored seats for your team members.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/org/billing" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Billing & Upgrade</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when org approaches seat limit'),

('notification_org_seat_reached', 'Organization Seat Limit Reached', '🚨 Sponsored Seat Limit Reached - {{organizationName}}', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🚨 Seat Limit Reached</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">Hi {{userName}},</p>
    <p style="font-size: 16px; color: #333;">Your organization <strong>{{organizationName}}</strong> has reached its sponsored seat limit.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 10px 0;"><strong style="color: #666;">Used Seats:</strong> {{usedSeats}}</p>
      <p style="margin: 10px 0;"><strong style="color: #666;">Maximum Seats:</strong> {{maxSeats}}</p>
      <p style="margin: 10px 0;"><strong style="color: #dc2626; font-weight: bold;">You cannot assign sponsored access to more members.</strong></p>
    </div>
    <p style="color: #666; font-size: 14px;">Upgrade your plan to add more sponsored seats, or remove existing sponsored access from members to free up seats.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{siteUrl}}/org/billing" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Upgrade Now</a>
    </div>
  </div>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from InnoTrue Hub.</p>
</div>', 'Sent when org reaches seat limit'),

('notification_default', 'Default Account Activity', 'Account Activity - InnoTrue Hub', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Account Activity</h2>
  <p>Hi {{userName}},</p>
  <p>There was activity on your account at {{timestamp}}.</p>
  <p>If you did not authorize this activity, please contact support immediately.</p>
  <hr style="border: 1px solid #eee; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">This is an automated security notification from InnoTrue Hub.</p>
</div>', 'Default fallback notification template')

ON CONFLICT (template_key) DO NOTHING;