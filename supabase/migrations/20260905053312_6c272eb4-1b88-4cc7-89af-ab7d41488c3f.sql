ALTER TABLE public.recovery_cases
  ADD COLUMN IF NOT EXISTS pay_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkout_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS escalation_note text,
  ADD COLUMN IF NOT EXISTS stopping_rule text;

CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  failure_reason text NOT NULL UNIQUE,
  strategy text NOT NULL DEFAULT '',
  english_template text NOT NULL DEFAULT '',
  hinglish_template text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO anon, authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view message templates" ON public.message_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can add message templates" ON public.message_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update message templates" ON public.message_templates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete message templates" ON public.message_templates FOR DELETE USING (true);

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.message_templates (failure_reason, strategy, english_template, hinglish_template) VALUES
  ('Card Declined (Insufficient Funds)', 'Smart Retries + Soft SMS',
   'Hi {customer}, your payment of {amount} did not go through. You can update payment here: {pay_url}',
   'Hey {first_name}! Aapka payment {amount} fail ho gaya. Thodi der baad try karein? {pay_url}'),
  ('Expired Credit Card', '1-Click Card Update Link',
   'Dear {customer}, your card on file has expired. Update it in one click: {pay_url}',
   'Hi {first_name}, aapka card expire ho gaya hai. Ek click mein update karein: {pay_url}'),
  ('Payment Gateway Timeout', 'Immediate Auto-Retry Sequencer',
   'Hi {customer}, your checkout failed due to a temporary glitch. Finish it here: {checkout_url}',
   'Hi {first_name}, checkout ek chhoti glitch ki wajah se fail hua. Yahan complete karein: {checkout_url}'),
  ('Invoice Overdue 45 Days', 'Compliant Payment Plan Offer',
   'Dear {customer}, invoice {reference} for {amount} is overdue. Pay here {pay_url} or reply to arrange a split payment plan.',
   'Dear {first_name}, invoice {reference} ({amount}) pending hai. Yahan pay karein {pay_url} ya reply karein instalment plan ke liye.'),
  ('Disputed Invoice / Legal Notice Requested', 'Compliant Payment Plan Offer',
   'Dear {customer}, invoice {reference} for {amount} is under dispute. Our team will contact you directly.',
   'Dear {first_name}, invoice {reference} ({amount}) dispute mein hai. Hamari team aapse direct baat karegi.');
