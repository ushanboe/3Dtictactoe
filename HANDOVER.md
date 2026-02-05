# 3D Tic-Tac-Toe - Complete Project Handover Document

## 📋 Project Overview

A 3D Tic-Tac-Toe game built with Next.js 14, featuring:
- **3D game board** rendered with Three.js
- **Multiple game modes**: Local (2 players), AI opponent, Online multiplayer
- **Subscription system**: Stripe payments for premium (online) features
- **Authentication**: Google OAuth via Supabase
- **Real-time multiplayer**: Firebase Realtime Database

**Live URL**: https://tictactoe.oldskool.games  
**Repository**: https://github.com/ushanboe/3Dtictactoe  
**Hosting**: Vercel

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 14 App Router + React + Three.js                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ TicTacToe3D  │  │ Pricing Page │  │ Auth Error Page      │  │
│  │ (Game UI)    │  │ (Subscribe)  │  │ (Error handling)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                                      │
│         ▼                 ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              useSubscription Hook                        │    │
│  │  - User state, subscription status, auth methods         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                         BACKEND (API Routes)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ /api/auth/       │  │ /api/stripe/     │  │ /api/stripe/ │  │
│  │ callback         │  │ create-checkout  │  │ webhook      │  │
│  │ (OAuth flow)     │  │ (Start payment)  │  │ (Sync subs)  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Supabase   │  │    Stripe    │  │      Firebase        │  │
│  │ - Auth       │  │ - Payments   │  │ - Realtime DB        │  │
│  │ - Database   │  │ - Webhooks   │  │ - Online multiplayer │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
/root/3dtictactoe/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with metadata
│   │   ├── page.tsx                # Main page (renders TicTacToe3D)
│   │   ├── pricing/
│   │   │   └── page.tsx            # Subscription pricing page
│   │   ├── auth/
│   │   │   └── auth-code-error/
│   │   │       └── page.tsx        # OAuth error display page
│   │   └── api/
│   │       ├── auth/
│   │       │   └── callback/
│   │       │       └── route.ts    # OAuth callback handler
│   │       └── stripe/
│   │           ├── create-checkout/
│   │           │   └── route.ts    # Creates Stripe checkout session
│   │           └── webhook/
│   │               └── route.ts    # Handles Stripe webhook events
│   ├── components/
│   │   └── TicTacToe3D.tsx         # Main game component (1139 lines)
│   ├── lib/
│   │   ├── stripe.ts               # Stripe client & helpers
│   │   ├── supabase-client.ts      # Browser Supabase client
│   │   ├── supabase-server.ts      # Server Supabase client
│   │   └── useSubscription.ts      # Auth & subscription hook
│   └── middleware.ts               # Session refresh middleware
├── package.json
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🎮 Game Modes

### 1. Local Mode (Free)
- Two players on same device
- Players take turns clicking cells
- No authentication required

### 2. AI Mode (Free)
- Play against computer
- Three difficulty levels: Easy, Medium, Hard
- AI uses strategic move selection

### 3. Online Mode (Premium - Requires Subscription)
- Real-time multiplayer via Firebase
- Create game → Get 6-character code → Share with friend
- Friend joins with code
- Requires Google sign-in + active subscription

---

## 💳 Stripe Payment System

### Flow Overview

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   User      │────▶│ create-checkout │────▶│   Stripe    │
│ clicks sub  │     │   API route     │     │  Checkout   │
└─────────────┘     └─────────────────┘     └──────┬──────┘
                                                    │
                                                    ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Supabase   │◀────│    Webhook      │◀────│   Payment   │
│  Database   │     │   API route     │     │  Complete   │
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Subscription Plans

| Plan    | Price   | Stripe Price ID Env Var      |
|---------|---------|------------------------------|
| Monthly | $1.99   | STRIPE_MONTHLY_PRICE_ID      |
| Annual  | $10.00  | STRIPE_ANNUAL_PRICE_ID       |

### Key Files

#### `/src/lib/stripe.ts`
```typescript
// Lazy-initialized Stripe client
export function getStripe(): Stripe

// Price IDs from environment
export const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID,
}

// Helper functions
export const safeTimestamp = (ts: unknown): string | null  // Convert Stripe timestamp
export const mapStripeStatus = (status: string): string     // Map to DB status
```

#### `/src/app/api/stripe/create-checkout/route.ts`
```typescript
// POST /api/stripe/create-checkout
// Body: { plan: 'monthly' | 'annual' }
// Returns: { url: string } - Stripe checkout URL

// Flow:
1. Verify user is authenticated via Supabase
2. Get price ID for selected plan
3. Create Stripe checkout session with:
   - customer_email: user's email
   - metadata: { supabase_user_id, plan }
   - success_url: /pricing?success=true
   - cancel_url: /pricing?canceled=true
4. Return checkout URL
```

#### `/src/app/api/stripe/webhook/route.ts`
```typescript
// POST /api/stripe/webhook
// Handles Stripe webhook events

// Events handled:
- checkout.session.completed  → Create subscription in DB
- customer.subscription.created → Create/update subscription
- customer.subscription.updated → Update subscription status
- customer.subscription.deleted → Mark as canceled
- invoice.payment_succeeded    → Update to active
- invoice.payment_failed       → Mark as inactive

// Uses admin Supabase client (bypasses RLS)
```

### Supabase Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

---

## 🔐 Authentication System

### Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   User      │────▶│    Supabase     │────▶│   Google    │
│ clicks sign │     │  signInWithOAuth│     │   OAuth     │
└─────────────┘     └─────────────────┘     └──────┬──────┘
                                                    │
                                                    ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Session   │◀────│  /api/auth/     │◀────│  Callback   │
│   Created   │     │  callback       │     │  with code  │
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Key Files

#### `/src/lib/supabase-client.ts`
- Browser-side Supabase client
- Singleton pattern to preserve PKCE state
- Returns null if env vars missing (build-time safety)

#### `/src/lib/supabase-server.ts`
- Server-side Supabase client with cookie handling
- Admin client for webhook operations (bypasses RLS)

#### `/src/lib/useSubscription.ts`
```typescript
export function useSubscription() {
  // Returns:
  return {
    user,           // Supabase User object or null
    subscription,   // Subscription data or null
    isSubscribed,   // boolean - has active subscription
    loading,        // boolean - initial load state
    error,          // string or null
    signIn,         // () => Promise<void> - Google OAuth
    signOut,        // () => Promise<void> - Sign out
    checkout,       // (plan) => Promise<void> - Start checkout
  }
}
```

#### `/src/app/api/auth/callback/route.ts`
- Handles OAuth callback from Google
- Exchanges auth code for session
- Falls back to client-side exchange if PKCE fails

#### `/src/middleware.ts`
- Refreshes Supabase session on each request
- Skips /api/auth/callback to avoid consuming auth code

---

## 🌐 Environment Variables

### Required in Vercel

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=https://tictactoe.oldskool.games
```

### Where to Find These

| Variable | Location |
|----------|----------|
| SUPABASE_URL | Supabase → Project Settings → API |
| SUPABASE_ANON_KEY | Supabase → Project Settings → API → anon public |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Project Settings → API → service_role |
| STRIPE_SECRET_KEY | Stripe Dashboard → Developers → API keys |
| STRIPE_WEBHOOK_SECRET | Stripe Dashboard → Developers → Webhooks → Signing secret |
| STRIPE_MONTHLY_PRICE_ID | Stripe Dashboard → Products → Price ID |
| STRIPE_ANNUAL_PRICE_ID | Stripe Dashboard → Products → Price ID |

---

## 🔥 Firebase Configuration

Firebase is used ONLY for real-time online multiplayer (not auth or payments).

### Config Location
Hardcoded in `/src/components/TicTacToe3D.tsx`:

```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "tictactoe-3d.firebaseapp.com",
  databaseURL: "https://tictactoe-3d-default-rtdb.firebaseio.com",
  projectId: "tictactoe-3d",
  // ...
}
```

### Game Data Structure
```typescript
// Firebase path: /games/{gameCode}
interface GameData {
  board: CellValue[][][]      // 3x3x3 array
  currentPlayer: 'X' | 'O'
  player1Name: string
  player2Name: string
  player2Joined: boolean
  winner: string | null
  winningLine: number[][] | null
  lastMove: number[] | null
}
```

---

## 🎯 Game Component Details

### `/src/components/TicTacToe3D.tsx` (1139 lines)

#### State Management
```typescript
// Game state
const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu')
const [gameMode, setGameMode] = useState<'local' | 'ai' | 'online'>('local')
const [board, setBoard] = useState<CellValue[][][]>()  // 3x3x3 array
const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X')
const [winner, setWinner] = useState<string | null>(null)
const [winningLine, setWinningLine] = useState<number[][] | null>(null)

// Online mode
const [gameCode, setGameCode] = useState('')
const [waitingForPlayer, setWaitingForPlayer] = useState(false)
const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O'>('X')
```

#### Three.js Setup
- Scene with gradient background
- Three horizontal layers (boards) stacked vertically
- Each layer has 3x3 clickable cells
- X markers: Two crossed bars (purple)
- O markers: Torus/ring shape (pink)
- Winning line highlighted in yellow
- Mouse drag rotation of entire grid

#### Winning Logic
- 49 possible winning lines in 3D tic-tac-toe
- Includes: rows, columns, diagonals on each layer
- Plus: vertical columns, 3D diagonals through layers
- Space diagonals (corner to corner through center)

#### AI Logic
```typescript
// Priority order:
1. Win if possible (find line with 2 AI + 1 empty)
2. Block opponent win (find line with 2 opponent + 1 empty)
3. Take center if available
4. Random empty cell
```

---

## ⚠️ Known Issues & Current Status

### CRITICAL: Google OAuth Not Working

**Error**: "Error getting user identity from external provider"

**Root Cause**: Google OAuth configuration issue (NOT code issue)

**Required Fixes in Google Cloud Console**:
1. OAuth consent screen must be published OR user added as tester
2. Authorized JavaScript origins: `https://tictactoe.oldskool.games`
3. Authorized redirect URI: `https://[PROJECT-REF].supabase.co/auth/v1/callback`

**Required Fixes in Supabase**:
1. Authentication → Providers → Google → Enable
2. Add Client ID and Client Secret from Google Console
3. Authentication → URL Configuration:
   - Site URL: `https://tictactoe.oldskool.games`
   - Redirect URLs: `https://tictactoe.oldskool.games/**`

### Subscription Already Paid But Not Linked

If a user paid via Stripe but can't access premium:
1. Check Supabase `subscriptions` table for their user_id
2. Verify webhook received the event (check Stripe webhook logs)
3. May need to manually link subscription to user

---

## 🚀 Deployment

### Vercel Settings
- Framework Preset: **Next.js** (CRITICAL - not "Other")
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`

### Domain Setup
- Custom domain: `tictactoe.oldskool.games`
- Configured in Vercel → Project → Settings → Domains

### Stripe Webhook
- Endpoint: `https://tictactoe.oldskool.games/api/stripe/webhook`
- Events to subscribe:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed

---

## 📝 Quick Reference Commands

```bash
# Local development
cd /root/3dtictactoe
npm run dev

# Build
npm run build

# Push to GitHub (triggers Vercel deploy)
git add -A
git commit -m "message"
git push origin main
```

---

## 🔧 Troubleshooting Guide

| Issue | Solution |
|-------|----------|
| 404 on all pages | Vercel Framework Preset must be "Next.js" |
| OAuth "unexpected_failure" | Check Google Console OAuth config |
| PKCE code verifier error | Clear cookies, hard refresh, retry |
| Webhook not updating DB | Check STRIPE_WEBHOOK_SECRET, verify RLS policies |
| Game markers not appearing | Check Three.js scene initialization |
| Online mode not connecting | Verify Firebase config and rules |

---

## 📞 External Service Dashboards

| Service | URL |
|---------|-----|
| Vercel | https://vercel.com/dashboard |
| Supabase | https://supabase.com/dashboard |
| Stripe | https://dashboard.stripe.com |
| Firebase | https://console.firebase.google.com |
| Google Cloud | https://console.cloud.google.com |

---

*Document created: 2026-02-05*
*Last updated: 2026-02-05*
