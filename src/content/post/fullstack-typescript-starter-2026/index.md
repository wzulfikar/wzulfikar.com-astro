---
title: "Full Stack TypeScript Starter for Solo Builders in 2026"
description: "A battle-tested TypeScript stack for solo builders shipping web, mobile, and desktop apps in 2026, from Cloudflare-deployed backends to Expo native apps, in one codebase."
date: "Apr 05 2026"
---

Building a full stack product alone used to mean choosing between moving fast and doing it right. In 2026, the tooling has matured enough that you no longer have to choose. This is the stack I use, not a wishlist, not a benchmark comparison, but what I actually reach for when starting a new project.

The intent is also practical: when I start something new and feed this post to an AI, I want it to immediately understand my defaults and make suggestions that fit, not generic boilerplate.

This covers web, mobile (iOS and Android), desktop, background jobs, and the tools around them. All from a single codebase.

---

## The Big Picture

One codebase. TypeScript everywhere. Deploy to the edge.

| Layer | Tool |
|---|---|
| Backend | OpenNext on Cloudflare |
| Frontend | React |
| Mobile | Expo (iOS + Android) |
| Desktop | Electron |
| Scheduler | Trigger.dev |

---

## Backend: OpenNext on Cloudflare

The backend runs on [OpenNext](https://opennext.js.org/) deployed to Cloudflare Workers. This gives you a Next.js-compatible server at the edge globally, with no cold starts.

I've used Vercel and Netlify before. Cloudflare is better on the free tier and it stays better as you scale; the pricing doesn't suddenly become punishing when you grow. But the bigger reason is the ecosystem. Cloudflare isn't just hosting: it's CDN, Workers, Cron Triggers, Queues, R2 (object storage), KV, D1 (SQLite at the edge), and more, all under one roof. You can replace several third-party services just by going deeper into the platform you're already on.

### Auth, Database, and Realtime: Supabase

[Supabase](https://supabase.com/) handles auth, PostgreSQL, and realtime subscriptions. It's the one backend service I'd be most reluctant to replace.

The key is row-level security (RLS). When you get the naming convention consistent, RLS becomes readable and maintainable:

- `allow select for own records`
- `allow insert for own records`
- `allow update for own records`
- `allow delete for own records`

Each policy name tells you exactly what it does. SQL migrations are tracked in git like any other code change.

For local development: running a local Supabase instance is always possible, but I don't always bother. Starting with a single production Supabase project is simpler, and for early-stage work the added complexity of a local instance rarely pays off. Add it when you need it.

### Billing: Autumn

[Autumn](https://useautumn.com/) handles billing and usage tracking for web. Stripe alone is possible. But when your product involves usage-based pricing, Autumn earns its place. It gives you a dashboard for monitoring usage across customers, which you'd otherwise have to build yourself on top of Stripe's data model.

Think of it as Stripe plus a usage layer plus the admin visibility to go with it.

---

## Frontend: React + Tailwind + shadcn

The frontend is React with [Tailwind CSS](https://tailwindcss.com/) for styling and [shadcn/ui](https://ui.shadcn.com/) for components. shadcn is not a component library you install. It's a collection of copy-paste components built on Radix primitives that you own and modify. That distinction matters when you need to deviate from defaults.

### Data Fetching: React Query

[TanStack Query](https://tanstack.com/query) manages server state. Caching, background refetching, optimistic updates, pagination; it handles the parts of data fetching that are tedious to write correctly from scratch. Pair it with `ky` for the actual HTTP calls.

### HTTP: ky

[ky](https://github.com/sindresorhus/ky) is a fetch wrapper with sane defaults: automatic JSON parsing, timeout support, retry logic, and hooks for interception. It's what `fetch` should have been.

### Toast: Sonner

[Sonner](https://sonner.emilkowal.ski/) for toasts. Opinionated, looks good, no configuration required.

---

## Mobile: Expo

[Expo](https://expo.dev/) is the right choice for iOS and Android in 2026. The managed workflow has matured, EAS handles CI/CD for app store releases, and the SDK covers enough native APIs that dropping to bare React Native is rarely necessary.

### Tailwind in Expo: NativeWind

For styling, use [NativeWind](https://www.nativewind.dev/), specifically the `mcrgea/tailwind` fork, which brings Tailwind classes to React Native components. Same mental model as the web, translated to native.

### Bottom Sheet: Gorhom Bottom Sheet

[@gorhom/bottom-sheet](https://gorhom.github.io/react-native-bottom-sheet/) is the standard for bottom sheets in Expo. Gesture handling, keyboard avoidance, snap points; it handles all of it reliably.

### Billing: RevenueCat

[RevenueCat](https://www.revenuecat.com/) manages in-app purchases and subscriptions on iOS and Android. It abstracts StoreKit and Play Billing into a single SDK with a dashboard for MRR, trials, and churn. The equivalent of Autumn, but for mobile stores.

### EAS Build Scripts

EAS (Expo Application Services) builds your app in CI. Managing your own Xcode/Android Studio pipeline is the alternative. It isn't worth it. Custom build scripts in `eas.json` handle environment-specific configurations cleanly and the DX improvement over a manual setup is significant.

---

## Desktop: Electron

[Electron](https://www.electronjs.org/) for desktop. It's heavy, but for a solo builder the ability to reuse React components and the entire npm ecosystem across web and desktop is worth the tradeoff. The use case here is customer demand: when a web app also needs a desktop version, Electron lets you ship it without starting from scratch.

---

## Scheduler: Trigger.dev

[Trigger.dev](https://trigger.dev/) handles background jobs and scheduled tasks. It's TypeScript-native, and gives you observability into job runs without building your own queue infrastructure.

Use it for: sending emails after a delay, processing uploads, syncing data on a schedule, or anything that shouldn't block a request handler.

---

## Essential Tools

### Biome

[Biome](https://biomejs.dev/) replaces both ESLint and Prettier in one fast binary. No plugin ecosystem to manage, no version conflicts between lint and format configs. ESLint and Prettier are not in this stack. Biome handles everything they did, faster.

### TypeScript Go

[TypeScript Go](https://github.com/microsoft/typescript-go) is the Go rewrite of the TypeScript compiler. The speed difference is dramatic: 2 to 3× faster than the original `tsc`. Use it whenever possible. It's still in preview as of early 2026, so not every repo can adopt it yet, but it's the direction things are heading and worth enabling early when the project supports it.

### Bun Test

`bun test` is the test runner. It implements the Jest API so existing tests migrate without changes, but startup time is dramatically faster because Bun runs TypeScript natively with no transpile step. A test file that takes 2+ seconds to start in Jest starts in under 100ms in Bun.

For pre-commit hooks, pass staged files directly to keep the feedback loop tight. For pre-push, run the full suite.

One caveat with Expo: React Native ships Flow types, and Bun can't process them. Any test that imports from React Native must still run under Jest. The approach I use is a file suffix split:

- `.test.ts` / `.test.tsx`: runs with `bun test`
- `.jest.ts` / `.jest.tsx`: runs with Jest

This keeps the fast runner as the default and isolates Jest to only the tests that genuinely need it. Business logic, utilities, and anything that doesn't touch React Native internals goes in `.test.ts`. Component tests that render native elements go in `.jest.tsx`.

### Lefthook

[Lefthook](https://github.com/evilmartians/lefthook) manages git hooks. It replaces Husky: no Node.js runtime dependency, single YAML config, faster execution. Run Biome and the type checker on pre-commit without noticeably slowing down commits.

### Zed

[Zed](https://zed.dev/) as the editor. It's fast in a way VS Code no longer is, and the AI features are built into the core rather than added via extension. For TypeScript work, the language server performance is noticeably better.

---

## Essential Libraries

### es-toolkit

[es-toolkit](https://es-toolkit.slash.page/) replaces lodash. Tree-shakeable, TypeScript-first, smaller. Lodash is not in this stack.

### type-fest

[type-fest](https://github.com/sindresorhus/type-fest) fills gaps in TypeScript's standard utility types. `Simplify`, `RequireAtLeastOne`, `SetRequired`, `JsonValue`. Reach for these before writing your own.

### React Query, ky, Tailwind, shadcn, Sonner

Covered above in the frontend section. These apply across web and desktop.

---

## Supporting Software

These live outside the codebase but shape the quality of what ships.

**[Iconcraft](https://iconcraft.app/):** AI-generated app icons. Gets you to something polished faster than a designer handoff for an early-stage app.

**[Claude Desktop / Mobile](https://claude.ai/):** Primary research tool. Useful for understanding unfamiliar APIs, debugging obscure errors, and talking through architecture decisions. The mobile version means it's available anywhere.

**[Databorder MCP](https://databorder.com/):** MCP server that connects Claude to live social data. Useful for researching what developers are actually talking about, as opposed to what the official docs say.

**[RocketSim](https://www.rocketsim.app/):** Screen recording for the iOS simulator. The output is polished enough to use directly in marketing.

**[TinyShots](https://tinyshots.app/):** Drop in a screenshot, get a clean device mockup out.

**[Matte.app](https://matte.app/):** Screen recording with clean export options.

**[ButterKit](https://butterkit.io/):** App Store screenshot creator. Handles sizing, templates, and text overlays for App Store listings.

---

## Folder Structure

One codebase, but not a monorepo in the Turborepo sense. The goal is simplicity; all apps in one place, shared code extracted into local packages, no build orchestration overhead until it's actually needed.

```
/
├── apps/
│   ├── web/          # Next.js (OpenNext → Cloudflare)
│   ├── mobile/       # Expo
│   └── desktop/      # Electron
├── packages/
│   ├── ui/           # Shared React components
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared Biome, Tailwind, tsconfig
├── docs/
│   └── agents/       # Instructions for AI agents
│       └── fix-types.md
├── biome.json
├── lefthook.yml
└── package.json
```

The `docs/` folder holds markdown that both humans and agents can read. `docs/agents/` is specifically for agent instructions: reusable prompts that encode how to handle common tasks in this codebase. `fix-types.md` is a good example, it tells the agent exactly how type errors should be approached and resolved in this project, rather than relying on generic AI behaviour.

The packages are local workspace references, not published to npm. Change a shared type and every app picks it up immediately. No build pipeline, no version bumps, no publication step.

---

## What's Deliberately Not Here

A few things conspicuously absent:

- **ESLint + Prettier**, replaced by Biome
- **Husky**, replaced by Lefthook
- **Jest**, replaced by `bun test`
- **Lodash**, replaced by es-toolkit
- **Turborepo or Nx**, not needed until the complexity justifies it

Each of these was a deliberate removal, not an oversight. The replacements do the same job with less surface area to maintain.

---

## Why This Stack

The theme across every choice is: reduce the number of decisions you have to make repeatedly. Biome removes the lint/format debate. Supabase removes the auth boilerplate. EAS removes the mobile CI setup. Autumn and RevenueCat remove the billing edge cases.

Every tool on this list has been through a production cycle. The goal isn't to be on the bleeding edge. Ship without getting slowed down by infrastructure.

---

*This is what I'm using in April 2026. Some of these tools will evolve, be replaced, or get acquired. I'll update this post when my defaults change.*
