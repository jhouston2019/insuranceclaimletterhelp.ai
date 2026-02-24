-- Fix claim_letters table schema to match application code
-- This migration adds missing columns and standardizes the schema

-- Drop the old incomplete table if it exists
DROP TABLE IF EXISTS public.cla_letters CASCADE;

-- Create the complete claim_letters table
CREATE TABLE IF NOT EXISTS public.claim_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  
  -- File information
  file_name text NOT NULL,
  file_path text NOT NULL,
  original_filename text,
  
  -- Extracted content
  letter_text text,
  extracted_text text,
  
  -- Classification data
  claim_type text,
  party_type text,
  claim_context text,
  claim_amount text,
  
  -- Analysis results
  analysis jsonb,
  summary text,
  phase text,
  risk_level text,
  
  -- Generated response
  ai_response text,
  generated_letter text,
  
  -- Payment tracking
  stripe_session_id text,
  stripe_payment_status text DEFAULT 'pending',
  payment_status text DEFAULT 'pending',
  
  -- Status tracking
  status text DEFAULT 'uploaded',
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_letters_user_id ON public.claim_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_claim_letters_user_email ON public.claim_letters(user_email);
CREATE INDEX IF NOT EXISTS idx_claim_letters_status ON public.claim_letters(status);
CREATE INDEX IF NOT EXISTS idx_claim_letters_stripe_session ON public.claim_letters(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_claim_letters_created_at ON public.claim_letters(created_at);

-- Enable Row Level Security
ALTER TABLE public.claim_letters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for claim_letters
CREATE POLICY "Users can view own claim letters" ON public.claim_letters
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.email() = user_email
    );

CREATE POLICY "Users can insert own claim letters" ON public.claim_letters
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        auth.email() = user_email
    );

CREATE POLICY "Users can update own claim letters" ON public.claim_letters
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.email() = user_email
    );

CREATE POLICY "Users can delete own claim letters" ON public.claim_letters
    FOR DELETE USING (
        auth.uid() = user_id OR 
        auth.email() = user_email
    );

-- Service role can do everything (for backend functions)
CREATE POLICY "Service role full access" ON public.claim_letters
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role'
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_claim_letters_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_claim_letters_updated_at
  BEFORE UPDATE ON public.claim_letters
  FOR EACH ROW EXECUTE PROCEDURE public.update_claim_letters_updated_at();

-- Create storage bucket for claim letters if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-letters', 'claim-letters', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for claim-letters bucket
CREATE POLICY "Users can upload own claim files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'claim-letters' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own claim files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'claim-letters' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update own claim files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'claim-letters' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own claim files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'claim-letters' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
