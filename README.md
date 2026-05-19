# Learning Loop

Learning Loop is a reasoning-first CAT preparation platform. Instead of only showing correctness, it captures and diagnoses student thinking patterns with AI.

## Stack
- Next.js 14 + App Router + TypeScript
- Tailwind CSS + custom design tokens
- Supabase (Postgres + Auth)
- Claude API (`claude-sonnet-4-20250514`) for reasoning analysis
- Razorpay scaffolding for upgrades
- PostHog event instrumentation hooks

## Local setup
1. Install dependencies: `npm install`
2. Configure environment variables from `.env.example`
3. Run Supabase migration in your project (`supabase db push`)
4. Seed question bank: `npm run seed`
5. Start app: `npm run dev`

## Included routes
- Auth: `/login`, `/signup`
- App: `/dashboard`, `/practice`, `/practice/[id]`, `/profile`, `/history`, `/institute`
- Pricing: `/pricing`
- APIs: `/api/analyze`, `/api/questions`, `/api/sessions`, `/api/profile`, `/api/payments/razorpay/order`

## Deployment checklist
1. Deploy Next.js app on Vercel
2. Configure all env vars in Vercel
3. Run Supabase migrations and seed script
4. Ensure RLS policies are enabled
5. Configure Razorpay webhook (phase 2 hardening)
6. Configure PostHog project key
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
