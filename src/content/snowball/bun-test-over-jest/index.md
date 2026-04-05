---
title: "Use bun test instead of Jest"
description: "Bun's built-in test runner is Jest-compatible and dramatically faster. For most TypeScript projects there's no reason to reach for Jest anymore."
date: "Apr 09 2026"
---

Jest is the default test runner for JavaScript projects. It's battle-tested, has a massive ecosystem, and works fine. It's also slow in a way you stop noticing until you switch away from it.

Bun ships a test runner built into the runtime. Same API, no configuration, and startup times that make Jest feel like a different era.

## The speed difference

Jest's slowness comes from two places: startup cost and transform overhead. Every test run spins up Node, loads Jest's module system, and transpiles your TypeScript through Babel or ts-jest or esbuild. Even a single test file takes a second or two before any test code runs.

Bun runs TypeScript natively. No transpile step, no separate transform config. A test file that takes 2.3 seconds to start in Jest starts in under 100ms in Bun. On a suite of 50 test files the cumulative difference is minutes, not seconds.

## It's largely compatible

Bun's test runner implements the Jest API: `describe`, `it`, `test`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `mock`, `spyOn`. If your tests don't rely on Jest-specific internals, they'll run under `bun test` without changes.

The main things that don't carry over are Jest's custom runner plugins and some snapshot serializer customizations. For most application test suites, those aren't factors.

## Switching

Remove Jest:

```bash
npm uninstall jest ts-jest @types/jest babel-jest
```

Remove any `jest.config.ts` or `jest.config.js`. Remove the `transform` and `testEnvironment` config if you had them.

Add Bun (if not already installed):

```bash
curl -fsSL https://bun.sh/install | bash
```

Update your `package.json` scripts:

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

Run your tests:

```bash
bun test
```

That's it for most projects.

## Running only staged files

One thing `bun test` does well is filtering. In a `pre-commit` hook you don't want to run every test, just the ones related to what you're changing:

```bash
bun test --testPathPattern=src/utils
```

Or with lefthook, pass staged files directly:

```yaml
pre-commit:
  commands:
    test-related:
      glob: "**/*.{ts,tsx}"
      run: bun test {staged_files}
```

This gives you a fast sanity check on commit without waiting for the full suite.

## Coverage

```bash
bun test --coverage
```

Coverage output works out of the box, no extra packages required. Jest needed `--coverage` plus `@jest/coverage-provider` or a specific coverage provider configured. Bun handles it natively.

## Watch mode

```bash
bun test --watch
```

Re-runs affected tests on file change. The feedback loop is noticeably tighter than Jest's watch mode because the startup cost isn't paid on every re-run.

## What to keep in mind

Bun's test runner is stable but younger than Jest. A few things to be aware of:

- **Snapshot testing** works, but if you have an existing Jest snapshot suite, the format is compatible enough that most snapshots migrate without issues.
- **jsdom** is not bundled. For tests that need a browser-like DOM environment, you need to configure `--dom` or use a separate setup. This matters for component testing; for backend or utility code it doesn't come up.
- **Module mocking** works for most cases, but complex Jest factory patterns occasionally need minor adjustments.

For a TypeScript backend, CLI tool, or utility library, none of these caveats apply. Switch immediately. For a React component test suite, expect a short migration session rather than a zero-touch swap.

## The bottom line

Jest made sense when the alternatives were worse. In 2026, `bun test` is faster, requires no configuration, handles TypeScript natively, and covers 95% of what Jest does. The main reason to stay on Jest is an existing suite with deep Jest-specific dependencies. For anything new, start with `bun test`.
