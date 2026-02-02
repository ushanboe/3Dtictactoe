# 3D Tic-Tac-Toe 🎮

> **⚠️ Next.js Version** - This version has been converted from static HTML/JS to Next.js 14 with Stripe subscription payments and Supabase authentication.

A beautiful 3D Tic-Tac-Toe game with online multiplayer, AI opponents, and subscription-based premium features.

## Features

- 🎯 **3D Gameplay** - Play tic-tac-toe in a 3x3x3 cube
- 🤖 **AI Opponents** - Three difficulty levels (Easy, Medium, Hard)
- 🌐 **Online Multiplayer** - Play with friends (Premium feature)
- 🔐 **User Authentication** - Sign in with Google via Supabase
- 💳 **Subscription Payments** - Stripe integration for premium access
- 📱 **PWA Support** - Install as a mobile app

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Multiplayer**: Firebase Realtime Database
- **Deployment**: Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/ushanboe/3Dtictactoe.git
cd 3Dtictactoe
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

3. Run this SQL in the Supabase SQL Editor:

```sql
-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('monthly', 'annual', 'free')),
  status TEXT CHECK (status IN ('active', 'canceled', 'inactive', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for webhooks)
CREATE POLICY "Service role full access"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

4. Enable Google OAuth:
   - Go to **Authentication → Providers → Google**
   - Enable and configure with your Google OAuth credentials
   - Add your domain to **URL Configuration → Site URL**
   - Add callback URL: `https://your-domain.com/api/auth/callback`

### 3. Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Go to **Developers → API Keys** and copy:
   - Secret key → `STRIPE_SECRET_KEY`
   - Publishable key → `STRIPE_PUBLISHABLE_KEY`

3. Create subscription products:
   - Go to **Products → Add Product**
   - Create "Monthly Remote Play" - $1.99/month recurring
   - Create "Annual Remote Play" - $10/year recurring
   - Copy the Price IDs (start with `price_`):
     - Monthly → `STRIPE_MONTHLY_PRICE_ID`
     - Annual → `STRIPE_ANNUAL_PRICE_ID`

4. Set up webhooks:
   - Go to **Developers → Webhooks → Add endpoint**
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to select:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the Signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. Environment Variables

Create `.env.local` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 5. Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

**Important**: After deployment, update:
- `NEXT_PUBLIC_APP_URL` to your actual Vercel domain
- Stripe webhook URL to your actual domain
- Supabase redirect URLs to your actual domain

## Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0025 0000 3155 | Requires authentication |

Use any future expiry date, any 3-digit CVC, any 5-digit ZIP.

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Troubleshooting

### 404 on API routes
Force redeploy: `vercel --prod --force`

### Webhook 500 errors
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

### User signed out after checkout
- Ensure `NEXT_PUBLIC_APP_URL` exactly matches your domain

### Database errors
- Verify subscriptions table exists with correct schema
- Check RLS policies are configured

## License

MIT