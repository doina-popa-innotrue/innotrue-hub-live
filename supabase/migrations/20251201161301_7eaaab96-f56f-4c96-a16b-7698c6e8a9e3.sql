CREATE TABLE email_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  verification_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_change_requests ENABLE ROW LEVEL SECURITY;