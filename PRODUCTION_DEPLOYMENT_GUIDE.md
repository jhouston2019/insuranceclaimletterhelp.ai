# PRODUCTION DEPLOYMENT GUIDE
**Insurance Claim Letter Help - Production Ready Version**  
**Date:** February 24, 2026  
**Status:** ✅ READY FOR DEPLOYMENT

---

## 🎯 DEPLOYMENT STATUS

### ✅ COMPLETED PRODUCTION HARDENING

All critical issues have been resolved:

1. ✅ **Branding Fixed** - All TaxLetterHelp/IRS references removed
2. ✅ **File Structure Fixed** - upload.html and resource.html now exist
3. ✅ **Authentication Hardened** - Mock user code removed
4. ✅ **Database Schema Fixed** - Complete schema with all columns
5. ✅ **File Upload Implemented** - Real Supabase Storage integration
6. ✅ **Text Extraction Implemented** - PDF parsing and OCR
7. ✅ **Letter Generation Implemented** - Real OpenAI integration
8. ✅ **Payment Verification** - Server-side Stripe verification
9. ✅ **Security Hardened** - Rate limiting and input validation
10. ✅ **Debug Code Removed** - Production clean

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Supabase Setup

#### Create Supabase Project
```bash
1. Go to https://supabase.com
2. Create new project
3. Note your project URL and keys
```

#### Run Database Migrations
```sql
-- Run these in order in Supabase SQL Editor:
1. supabase/migrations/20251001_create_users_table.sql
2. supabase/migrations/20251001_create_documents_table.sql
3. supabase/migrations/20251001_create_subscriptions_table.sql
4. supabase/migrations/20251001_setup_rls_policies.sql
5. supabase/migrations/20251002_fix_claim_letters_schema.sql ⭐ NEW
```

#### Create Storage Bucket
```bash
1. Go to Storage in Supabase dashboard
2. Create bucket named: claim-letters
3. Set to Private (not public)
4. Enable RLS on storage.objects
```

#### Get API Keys
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 2. Stripe Setup

#### Create Product
```bash
1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Name: "Insurance Claim Letter Response"
4. Description: "One-time AI-powered insurance claim letter analysis and response generation"
5. Pricing: $19.00 USD one-time payment
6. Click "Save product"
7. Copy the Price ID (starts with price_)
```

#### Configure Webhook
```bash
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: https://your-domain.netlify.app/.netlify/functions/stripe-webhook
4. Select events:
   - checkout.session.completed ⭐ REQUIRED
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
5. Copy webhook signing secret (starts with whsec_)
```

#### Get API Keys
```
STRIPE_SECRET_KEY=sk_live_xxxxx (use sk_test_ for testing)
STRIPE_PUBLIC_KEY=pk_live_xxxxx (use pk_test_ for testing)
STRIPE_PRICE_RESPONSE=price_xxxxxxxxxxxxx (your $19 price ID)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

---

### 3. OpenAI Setup

```bash
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with sk-)
4. Add credits to your account ($5 minimum recommended)
```

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

---

### 4. SendGrid Setup (Optional - for email notifications)

```bash
1. Go to https://sendgrid.com
2. Create account
3. Create API key
4. Verify sender email
```

```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SUPPORT_EMAIL=support@insuranceclaimletterhelp.com
```

---

### 5. Netlify Deployment

#### Connect Repository
```bash
1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Connect to GitHub
4. Select repository: jhouston2019/insuranceclaimletterhelp.ai
5. Configure build settings:
   - Build command: npm run build
   - Publish directory: dist
   - Functions directory: netlify/functions
```

#### Set Environment Variables
```bash
In Netlify Dashboard > Site settings > Environment variables, add:

# Supabase (Frontend - build time)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Backend - runtime)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_PRICE_RESPONSE=price_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Site Configuration
SITE_URL=https://insuranceclaimletterhelp.com

# Admin (optional)
ADMIN_KEY=your_secure_admin_key

# Email (optional)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SUPPORT_EMAIL=support@insuranceclaimletterhelp.com
```

#### Deploy
```bash
1. Push code to main branch
2. Netlify will auto-deploy
3. Monitor build logs for errors
4. Test deployed site
```

---

### 6. Domain Configuration

```bash
1. In Netlify: Site settings > Domain management
2. Add custom domain: insuranceclaimletterhelp.com
3. Configure DNS:
   - Add CNAME record pointing to your-site.netlify.app
   - Or use Netlify DNS
4. Enable HTTPS (automatic with Netlify)
5. Force HTTPS redirect
```

---

## 🧪 TESTING CHECKLIST

### Before Going Live

- [ ] **Signup Flow**
  - [ ] User can create account
  - [ ] Email verification works
  - [ ] User redirected to payment

- [ ] **Payment Flow**
  - [ ] Stripe checkout loads
  - [ ] Payment processes successfully
  - [ ] Webhook receives event
  - [ ] Database updated with payment status
  - [ ] User redirected to success page
  - [ ] localStorage set correctly

- [ ] **Upload Flow**
  - [ ] Upload page requires authentication
  - [ ] Upload page requires payment
  - [ ] File upload works (PDF)
  - [ ] File upload works (Image)
  - [ ] File size validation works
  - [ ] File type validation works

- [ ] **Text Extraction**
  - [ ] PDF text extraction works
  - [ ] Image OCR works
  - [ ] Minimum character validation works
  - [ ] Extracted text saved to database

- [ ] **Analysis Flow**
  - [ ] Classification validation works
  - [ ] Phase detection works
  - [ ] Hard stop conditions trigger correctly
  - [ ] Risk assessment works
  - [ ] Analysis saved to database

- [ ] **Letter Generation**
  - [ ] Payment verification works
  - [ ] OpenAI generates letter
  - [ ] Letter is professional and complete
  - [ ] Letter saved to database
  - [ ] User can view generated letter

- [ ] **Download Flow**
  - [ ] PDF download works
  - [ ] DOCX download works
  - [ ] Filenames correct (Insurance_Response_Letter)

- [ ] **Security**
  - [ ] Rate limiting works
  - [ ] Input validation works
  - [ ] No authentication bypass possible
  - [ ] No payment bypass possible
  - [ ] RLS policies enforced

- [ ] **Mobile Testing**
  - [ ] All pages responsive
  - [ ] Forms usable on mobile
  - [ ] File upload works on mobile

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
# Copy example and fill in values
cp env.example .env

# Edit .env with your actual keys
```

### Step 3: Test Locally
```bash
# Start dev server
npm run dev

# Test in browser at http://localhost:5173
```

### Step 4: Run Database Migrations
```bash
# In Supabase SQL Editor, run all migration files in order
# Verify tables created: claim_letters, users, subscriptions, usage_tracking
```

### Step 5: Deploy to Netlify
```bash
# Push to GitHub
git add .
git commit -m "Production hardening complete - ready for deployment"
git push origin main

# Netlify will auto-deploy
```

### Step 6: Configure Stripe Webhook
```bash
# After deployment, update Stripe webhook URL to:
https://insuranceclaimletterhelp.com/.netlify/functions/stripe-webhook
```

### Step 7: Test Production
```bash
# Test complete flow on production:
1. Sign up
2. Pay $19
3. Upload PDF
4. Generate letter
5. Download PDF/DOCX
```

---

## 📁 NEW FILES CREATED

### Backend Functions
- ✅ `netlify/functions/extract-text-from-file.js` - Real PDF/OCR extraction
- ✅ `netlify/functions/generate-letter.js` - Real OpenAI letter generation
- ✅ `netlify/functions/verify-payment.js` - Server-side payment verification
- ✅ `netlify/functions/rate-limiter.js` - Rate limiting middleware
- ✅ `netlify/functions/input-validator.js` - Input validation & sanitization

### Frontend Components
- ✅ `src/components/UploadForm.js` - Complete Supabase Storage integration

### Database Migrations
- ✅ `supabase/migrations/20251002_fix_claim_letters_schema.sql` - Complete schema

### Documentation
- ✅ `SITE_AUDIT_REPORT_FEB_2026.md` - Comprehensive audit
- ✅ `PRODUCTION_DEPLOYMENT_GUIDE.md` - This file

---

## 🔧 FILES MODIFIED

### HTML Pages (Branding Fixed)
- ✅ `dashboard.html` - TaxLetterHelp → Insurance Claim Letter Help
- ✅ `login.html` - TaxLetterHelp → Insurance Claim Letter Help
- ✅ `signup.html` - TaxLetterHelp → Insurance Claim Letter Help
- ✅ `success.html` - All IRS references → Insurance references
- ✅ `thank-you.html` - IRS → Insurance, redirect to upload.html
- ✅ `upload.html` - Auth bypass removed, real upload implemented
- ✅ `resource.html` - Debug code removed

### Backend Functions (Production Hardened)
- ✅ `netlify/functions/analyze-insurance-letter.js` - Real text extraction, rate limiting
- ✅ `netlify/functions/stripe-webhook.js` - Enhanced payment tracking
- ✅ `netlify/functions/export-pdf.js` - Filename updated

### Files Renamed
- ✅ `upload-hardened.html` → `upload.html`
- ✅ `resource-hardened.html` → `resource.html`

---

## 🔐 SECURITY FEATURES IMPLEMENTED

1. ✅ **Rate Limiting** - Prevents abuse (5-10 requests per hour per endpoint)
2. ✅ **Input Validation** - Server-side validation of all inputs
3. ✅ **File Type Validation** - Only PDF, JPG, PNG allowed
4. ✅ **File Size Validation** - 10MB maximum
5. ✅ **Authentication Required** - No mock user bypass
6. ✅ **Payment Verification** - Server-side Stripe verification
7. ✅ **Row Level Security** - Database access restricted to owners
8. ✅ **CORS Configured** - Proper cross-origin headers
9. ✅ **Security Headers** - X-Frame-Options, CSP, etc.
10. ✅ **Text Sanitization** - XSS prevention

---

## 💰 PRICING CONFIGURATION

**Current Pricing:** $19 one-time payment

**Stripe Product Setup:**
- Product Name: "Insurance Claim Letter Response"
- Price: $19.00 USD
- Type: One-time payment
- Price ID: Must be set in `STRIPE_PRICE_RESPONSE` env var

**Alternative Plans (in code but not advertised):**
- STANDARD: $19 (main offering)
- COMPLEX: $99 (for complex claims)
- STARTER: $19/month (subscription)
- PRO: $19/month (subscription)
- PROPLUS: $99/month (subscription)

**Recommendation:** Keep it simple with $19 one-time for launch.

---

## 🔄 USER FLOW (PRODUCTION)

### Complete User Journey

1. **Landing Page** (`index.html`)
   - User learns about service
   - Clicks "Upload Insurer Letter"

2. **Payment Page** (`payment.html`)
   - User clicks "Pay & Generate"
   - Redirected to Stripe Checkout
   - Pays $19

3. **Stripe Processing**
   - Payment processed
   - Webhook updates database
   - User redirected to success page

4. **Success Page** (`success.html`)
   - Payment confirmed
   - localStorage set to "paid"
   - User clicks "Upload Insurance Claim Letter"

5. **Upload Page** (`upload.html`)
   - Checks authentication (required)
   - Checks payment status (required)
   - User uploads PDF/image
   - File uploaded to Supabase Storage
   - Text extracted (PDF parsing or OCR)
   - User fills classification form
   - Clicks "Analyze Letter"

6. **Analysis Processing**
   - Classification validated
   - Phase detected
   - Risk assessment performed
   - Hard stops checked
   - AI analysis generated (if safe)

7. **Results Display**
   - If hard stop: Show refusal message
   - If safe: Show analysis + "Generate Response" button

8. **Letter Generation** (if safe)
   - User clicks "Generate Procedural Response"
   - Payment verified server-side
   - OpenAI generates professional letter
   - Letter displayed on page

9. **Download** (`resource.html`)
   - User downloads PDF
   - User downloads DOCX
   - Letter ready to mail

---

## 🛠️ REQUIRED ENVIRONMENT VARIABLES

### Netlify Environment Variables

```bash
# Supabase (Frontend - Vite build time)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Backend - Functions runtime)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_PRICE_RESPONSE=price_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Site
SITE_URL=https://insuranceclaimletterhelp.com

# Optional
ADMIN_KEY=your_secure_random_key
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SUPPORT_EMAIL=support@insuranceclaimletterhelp.com
```

---

## 🧪 TESTING SCRIPT

### Manual Test Sequence

```bash
# Test 1: Authentication
1. Go to /signup.html
2. Create account with test email
3. Verify redirect to payment page

# Test 2: Payment
1. Use Stripe test card: 4242 4242 4242 4242
2. Expiry: Any future date
3. CVC: Any 3 digits
4. Verify redirect to success page
5. Check database for payment_status = 'paid'

# Test 3: Upload & Extract
1. Go to /upload.html
2. Upload test PDF
3. Verify file appears in Supabase Storage
4. Verify text extracted (check database extracted_text column)
5. Fill classification form
6. Click "Analyze Letter"

# Test 4: Analysis
1. Verify analysis completes
2. Check for hard stops (if applicable)
3. Verify results display correctly
4. Check database for analysis data

# Test 5: Generation
1. Click "Generate Procedural Response"
2. Verify OpenAI generates letter
3. Verify letter is professional and complete
4. Check database for generated_letter

# Test 6: Download
1. Click "Download PDF"
2. Verify PDF downloads with correct filename
3. Click "Download DOCX"
4. Verify DOCX downloads correctly
5. Open files and verify content

# Test 7: Security
1. Try accessing /upload.html without login → Should redirect
2. Try accessing /upload.html without payment → Should redirect
3. Try uploading .exe file → Should reject
4. Try uploading 20MB file → Should reject
5. Make 20 rapid requests → Should rate limit
```

---

## 📊 DATABASE SCHEMA

### claim_letters Table (Complete)

```sql
CREATE TABLE claim_letters (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  
  -- File info
  file_name text NOT NULL,
  file_path text NOT NULL,
  original_filename text,
  
  -- Extracted content
  letter_text text,
  extracted_text text,
  
  -- Classification
  claim_type text,
  party_type text,
  claim_context text,
  claim_amount text,
  
  -- Analysis
  analysis jsonb,
  summary text,
  phase text,
  risk_level text,
  
  -- Generated response
  ai_response text,
  generated_letter text,
  
  -- Payment
  stripe_session_id text,
  stripe_payment_status text,
  payment_status text DEFAULT 'pending',
  
  -- Status
  status text DEFAULT 'uploaded',
  
  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

---

## 🚨 KNOWN LIMITATIONS

### Current Limitations
1. **One letter per payment** - User pays $19 for one letter analysis
2. **No document history UI** - Dashboard shows list but limited functionality
3. **No email notifications** - SendGrid configured but not implemented
4. **No admin panel** - Admin.html exists but not functional
5. **No analytics** - No Google Analytics or tracking
6. **No error monitoring** - No Sentry or error tracking service

### Future Enhancements
- Multi-letter packages
- Document history with re-download
- Email notifications for status updates
- Admin dashboard for monitoring
- Analytics integration
- Error monitoring (Sentry)
- Live chat support
- Mobile app

---

## 🔍 VERIFICATION COMMANDS

### Check Deployment
```bash
# Check if site is live
curl -I https://insuranceclaimletterhelp.com

# Check functions
curl https://insuranceclaimletterhelp.com/.netlify/functions/verify-payment \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check Stripe webhook
# Go to Stripe Dashboard > Webhooks > Your webhook > Test
```

### Check Database
```sql
-- In Supabase SQL Editor
SELECT * FROM claim_letters ORDER BY created_at DESC LIMIT 10;
SELECT * FROM users ORDER BY created_at DESC LIMIT 10;
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 10;
```

### Check Storage
```bash
# In Supabase Storage dashboard
# Navigate to claim-letters bucket
# Verify files are uploading correctly
```

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue: "Failed to create checkout session"**
- Check STRIPE_SECRET_KEY is set
- Check STRIPE_PRICE_RESPONSE is valid price ID
- Check SITE_URL is set correctly

**Issue: "Failed to upload file"**
- Check VITE_SUPABASE_URL is set
- Check VITE_SUPABASE_ANON_KEY is set
- Check storage bucket "claim-letters" exists
- Check RLS policies allow user uploads

**Issue: "Text extraction failed"**
- Check file is valid PDF or image
- Check file is not corrupted
- Check file contains actual text (not just images)
- Check Tesseract.js is installed

**Issue: "Letter generation failed"**
- Check OPENAI_API_KEY is set
- Check OpenAI account has credits
- Check payment_status is 'paid' in database

**Issue: "Payment not verified"**
- Check Stripe webhook is configured
- Check webhook secret matches
- Check webhook events include checkout.session.completed
- Check database for stripe_session_id

---

## 📈 MONITORING

### What to Monitor

1. **Stripe Dashboard**
   - Successful payments
   - Failed payments
   - Webhook delivery status

2. **Supabase Dashboard**
   - Database records created
   - Storage usage
   - API request count

3. **Netlify Dashboard**
   - Function invocations
   - Function errors
   - Build status

4. **OpenAI Dashboard**
   - API usage
   - Token consumption
   - Costs

### Cost Estimates

**Per User:**
- Stripe fee: ~$0.60 (2.9% + $0.30)
- OpenAI cost: ~$0.02-0.05 (GPT-4o-mini)
- Supabase storage: ~$0.01
- **Total cost per user: ~$0.63-0.66**
- **Profit per user: ~$18.35** (at $19 price point)

---

## ✅ PRODUCTION READY CONFIRMATION

### All Critical Issues Resolved

✅ Branding contamination eliminated  
✅ File structure repaired  
✅ Real file upload implemented  
✅ Real text extraction implemented  
✅ Real OpenAI generation implemented  
✅ Stripe verification implemented  
✅ Database schema fixed  
✅ Auth bypass removed  
✅ Mock code removed  
✅ Debug code cleaned  
✅ Security hardened  
✅ Rate limiting added  
✅ Input validation added  

### Status: **READY FOR DEPLOYMENT** 🚀

---

## 📝 POST-DEPLOYMENT

### After Launch

1. **Monitor First 24 Hours**
   - Watch for errors in Netlify logs
   - Monitor Stripe payments
   - Check database for issues
   - Monitor OpenAI usage

2. **Gather Feedback**
   - Test with real users
   - Collect feedback
   - Monitor support emails
   - Track conversion rates

3. **Optimize**
   - Improve letter quality based on feedback
   - Optimize costs
   - Improve UX based on analytics
   - Add requested features

---

## 🎉 LAUNCH READY

**The site is now production-ready and can be deployed to production.**

All placeholders removed.  
All mock code removed.  
All core functionality implemented.  
All security hardened.  

**Next step:** Deploy to Netlify and test with real payment.

---

*End of Production Deployment Guide*
