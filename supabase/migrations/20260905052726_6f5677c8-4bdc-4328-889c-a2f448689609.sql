CREATE TABLE public.recovery_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_ref TEXT NOT NULL,
  customer TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'Overdue Receivable',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  failure_reason TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  opt_out BOOLEAN NOT NULL DEFAULT false,
  preferred_lang TEXT NOT NULL DEFAULT 'English',
  recovered_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_action TEXT,
  last_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_cases TO authenticated;
GRANT ALL ON public.recovery_cases TO service_role;

ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recovery cases" ON public.recovery_cases FOR SELECT USING (true);
CREATE POLICY "Anyone can add recovery cases" ON public.recovery_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update recovery cases" ON public.recovery_cases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete recovery cases" ON public.recovery_cases FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recovery_cases_updated_at BEFORE UPDATE ON public.recovery_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.recovery_cases (case_ref, customer, case_type, amount, failure_reason, attempts, opt_out, preferred_lang, status) VALUES
('INV-1001', 'Acme Corp (B2B)', 'Overdue Receivable', 12500.00, 'Invoice Overdue 45 Days', 2, false, 'English', 'Pending'),
('SUB-2042', 'Rahul Sharma', 'Failed Subscription', 49.00, 'Card Declined (Insufficient Funds)', 1, false, 'Hinglish', 'Pending'),
('CHK-9081', 'Priya Verma', 'Checkout Abandonment', 320.00, 'Payment Gateway Timeout', 0, false, 'Hinglish', 'Pending'),
('SUB-3099', 'TechStart Inc', 'Failed Subscription', 1200.00, 'Expired Credit Card', 3, false, 'English', 'Pending'),
('INV-1088', 'Global Logistics LLC', 'Overdue Receivable', 8500.00, 'Disputed Invoice / Legal Notice Requested', 1, true, 'English', 'Pending');