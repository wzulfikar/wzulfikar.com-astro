---
title: "Full Stack TypeScript Starter for Solo Builders in 2026"
description: "A battle-tested TypeScript stack for solo builders shipping web, mobile, and desktop apps in 2026 — from Cloudflare-deployed backends to Expo native apps, in one repo."
date: "Apr 05 2026"
draft: true
---

Building a full stack product alone used to mean choosing between moving fast and doing it right. In 2026, the tooling has matured enough that you no longer have to choose. This is the stack I use — not a wishlist, not a benchmark comparison, but what I actually reach for when shipping from zero to production.

This guide targets solo builders and small teams who want to cover web, mobile, and desktop without fragmenting into five different codebases.

---

## The Big Picture

One repo. TypeScript everywhere. Deploy to the edge.

| Layer | Tool |
|---|---|
| Backend | OpenNext on Cloudflare |
| Frontend | React |
| Mobile | Expo (iOS + Android) |
| Desktop | Electron |
| Scheduler | Trigger.dev |

---

## Backend: OpenNext on Cloudflare

The backend runs on [OpenNext](https://opennext.js.org/) deployed to Cloudflare Workers. This gives you a Next.js-compatible server that runs at the edge globally, without a cold start tax.

Why Cloudflare over Vercel or AWS Lambda? The free tier is genuinely generous, the latency is predictably low, and the developer experience has caught up considerably. For a solo builder, the operational burden is near zero.

<!-- TODO: Add your thoughts on what tipped you toward Cloudflare over other edge providers -->

### Auth, Database, and Realtime: Supabase

[Supabase](https://supabase.com/) handles auth, PostgreSQL database, and realtime subscriptions. It's the one backend service I'd be reluctant to replace — the combination of a proper relational database, row-level security, and a well-designed client SDK removes a substantial amount of boilerplate.

Row-level security means your API routes stay thin. The database enforces access control, not your application layer.

<!-- TODO: Any specific Supabase patterns you've found useful — RLS policies, edge functions, realtime use cases? -->

### Billing: Autumn

[Autumn](https://useautumn.com/) handles billing and usage tracking for web. It sits between your app and Stripe, giving you a clean API for checking entitlements, tracking usage, and managing plans without writing a billing engine from scratch.

<!-- TODO: How did you find Autumn vs rolling your own Stripe integration? -->

---

## Frontend: React + Tailwind + shadcn

The frontend is React with [Tailwind CSS](https://tailwindcss.com/) for styling and [shadcn/ui](https://ui.shadcn.com/) for components. shadcn is not a component library you install — it's a collection of copy-paste components built on Radix primitives that you own and modify. That distinction matters when you need to deviate from defaults.

### Data Fetching: React Query

[TanStack Query](https://tanstack.com/query) (React Query) manages server state. For anything beyond a simple fetch — caching, background refetching, optimistic updates, pagination — it pays for itself immediately. Pair it with `ky` for the actual HTTP calls.

### HTTP: ky

[ky](https://github.com/sindresorhus/ky) is a fetch wrapper with sane defaults: automatic JSON parsing, timeout support, retry logic, and hooks for request/response interception. It's what `fetch` should have been.

### Toast: Sonner

[Sonner](https://sonner.emilkowal.ski/) is the toast component. It's opinionated, looks good out of the box, and requires no configuration to use well.

<!-- TODO: Anything specific you'd add about your frontend setup or component conventions? -->

---

## Mobile: Expo

[Expo](https://expo.dev/) is the right choice for iOS and Android in 2026. The managed workflow has matured, EAS Build handles the CI/CD for app store releases, and the SDK covers enough native APIs that you rarely need to drop to bare React Native.

### Tailwind in Expo: NativeWind

For styling in Expo, use [NativeWind](https://www.nativewind.dev/) (the `mcrgea/tailwind` fork) which brings Tailwind classes to React Native components. The same mental model as the web, translated to native.

### Bottom Sheet: Gorhom Bottom Sheet

[@gorhom/bottom-sheet](https://gorhom.github.io/react-native-bottom-sheet/) is the standard for bottom sheets in Expo. It handles gesture interactions, keyboard avoidance, and snap points reliably.

### Billing: RevenueCat

[RevenueCat](https://www.revenuecat.com/) manages in-app purchases and subscriptions on iOS and Android. It abstracts StoreKit and Play Billing into a single SDK and gives you a dashboard to track MRR, trials, and churn without building your own analytics.

### EAS Build Scripts

EAS (Expo Application Services) builds your app in CI. The DX gap between managing your own Xcode/Android Studio pipeline and EAS is substantial — EAS wins. Custom build scripts in `eas.json` let you handle environment-specific configurations cleanly.

<!-- TODO: Worth sharing any EAS config or build script snippets that saved you time? -->

---

## Desktop: Electron

[Electron](https://www.electronjs.org/) for desktop. Yes, it's heavy. But for a solo builder shipping across platforms, the ability to reuse your React components and npm packages outweighs the bundle size concern. Pair it with proper lazy loading and the startup experience is acceptable.

<!-- TODO: What made you include desktop in your stack — internal tooling, a specific product, or customer demand? -->

---

## Scheduler: Trigger.dev

[Trigger.dev](https://trigger.dev/) handles background jobs and scheduled tasks. It's TypeScript-native, runs on your infrastructure or their cloud, and gives you observability into job runs without setting up your own queue infrastructure.

Use it for: sending emails after a delay, processing uploads, syncing data on a schedule, or anything that shouldn't block a request handler.

<!-- TODO: Any specific Trigger.dev patterns or job types you rely on heavily? -->

---

## Essential Tools

### Biome

[Biome](https://biomejs.dev/) replaces ESLint and Prettier in one fast binary. No plugin ecosystem to maintain, no version conflicts between lint and format configs. It's significantly faster than the combination it replaces.

### TypeScript Go (`tsc`)

[TypeScript Go](https://github.com/microsoft/typescript-go) is the rewrite of the TypeScript compiler in Go. As of 2026, it's the type-checker to use — the speed improvement over the original `tsc` is dramatic on large codebases. Type checking that used to take 30 seconds now takes 3.

<!-- TODO: How much did the speedup actually matter in practice for your projects? -->

### Lefthook

[Lefthook](https://github.com/evilmartians/lefthook) manages git hooks. It's faster than Husky, requires no Node.js runtime to run, and the config is a single YAML file. Run Biome and your type checker on pre-commit without slowing down every commit.

### Zed

[Zed](https://zed.dev/) as the editor. It's fast in a way that VS Code no longer is, and the AI integration is built into the core rather than bolted on. For TypeScript work specifically, the language server performance is noticeably better.

<!-- TODO: Anything specific about your Zed config or extensions worth mentioning? -->

---

## Essential Libraries

### es-toolkit

[es-toolkit](https://es-toolkit.slash.page/) is the lodash replacement. Tree-shakeable, TypeScript-first, and smaller. If you're still importing lodash in 2026, stop.

### type-fest

[type-fest](https://github.com/sindresorhus/type-fest) is a collection of TypeScript utility types that fill gaps in the standard library. `Simplify`, `RequireAtLeastOne`, `SetRequired`, `JsonValue` — reach for these before writing your own.

---

## Supporting Software

These are the apps that sit outside the codebase but shape the quality of what ships.

**[Iconcraft](https://iconcraft.app/)** — AI-generated app icons. Gets you to a polished icon faster than working with a designer for an early-stage app.

**[Claude Desktop / Mobile](https://claude.ai/)** — Primary research tool. For understanding unfamiliar APIs, drafting documentation, debugging obscure errors, or talking through architecture decisions.

**[Databorder MCP](https://databorder.com/)** — An MCP server that connects Claude to live social data. Useful for researching what developers are actually talking about, not just what the docs say.

**[RocketSim](https://www.rocketsim.app/)** — Screen recording for the iOS simulator that looks good enough to ship as marketing material.

**[TinyShots](https://tinyshots.app/)** — Screenshot mockups. Drop in a screenshot, get a device frame around it.

**[Matte.app](https://matte.app/)** — Screen recording with good export options.

**[ButterKit](https://butterkit.io/)** — App Store screenshot creator. Handles the sizing, templates, and text overlays for App Store listings.

<!-- TODO: Any of these tools have a story behind why you added them to the list? -->

---

## Folder Structure

One repo when possible. A monorepo with workspaces keeps shared types, utilities, and config in sync without publishing private packages.

```
/
├── apps/
│   ├── web/          # Next.js (OpenNext → Cloudflare)
│   ├── mobile/       # Expo
│   └── desktop/      # Electron
├── packages/
│   ├── ui/           # Shared React components
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared config (Biome, Tailwind, tsconfig)
├── biome.json
├── lefthook.yml
└── package.json
```

The packages aren't published — they're local workspace packages referenced by path. This keeps the iteration loop fast: change a shared type and every app picks it up immediately.

<!-- TODO: Do you use Turborepo or another build orchestrator, or do you keep it simpler? -->

---

## Why This Stack in 2026

The theme across every choice above is: reduce the number of decisions you have to make repeatedly. Biome removes the lint/format bikeshedding. Supabase removes the auth and database boilerplate. EAS removes the mobile CI setup. RevenueCat removes the billing edge cases.

Each tool on this list has been through a production cycle. The goal isn't to be on the bleeding edge — it's to ship.

<!-- TODO: Any final thoughts on the philosophy behind these choices — things you deliberately left out, or tools you considered and rejected? -->

---

*This stack is what I'm using in April 2026. Some of these tools will evolve, be replaced, or get acquired. I'll update this post when my defaults change.*
