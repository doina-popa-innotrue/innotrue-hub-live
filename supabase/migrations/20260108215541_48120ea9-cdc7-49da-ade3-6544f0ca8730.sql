-- Insert AI cost control system settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('ai_monthly_credit_limit', '1000', 'Maximum AI credits allowed per month for the entire platform'),
  ('ai_alert_threshold_percent', '70', 'Percentage of AI credit limit at which to send admin alert'),
  ('ai_alert_email', 'hubadmin@innotrue.com', 'Email address to receive AI usage alerts'),
  ('ai_alert_sent_this_month', 'false', 'Flag to track if alert was already sent this month')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;