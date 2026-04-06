---
title: "Use bun test instead of Jest"
description: "Bun's built-in test runner is Jest-compatible and dramatically faster. For most TypeScript projects there's no reason to reach for Jest anymore."
date: "Apr 09 2026"
---

Jest is the default test runner for JavaScript projects. It's battle-tested, has a massive ecosystem, and works fine. It's also slow in a way you stop noticing until you switch away from it.

Bun ships a test runner built right into the runtime, with the same API, no configuration required, and startup times that make Jest feel like a different era.

## The speed difference

Jest's slowness comes from two places: startup cost and transform overhead. Every test run spins up Node, loads Jest's module system, and transpiles your TypeScript through Babel or ts-jest or esbuild, so even a single test file can take a second or two before any test code actually runs.

Bun runs TypeScript natively, with no transpile step and no separate transform config. A test file that takes 2.3 seconds to start under Jest starts in under 100ms under Bun, and across a suite of 50 test files that cumulative difference starts to feel like minutes, not seconds.

## It's largely compatible

Bun's test runner implements the full Jest API: `describe`, `it`, `test`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `mock`, `spyOn`. If your tests don't rely on Jest-specific internals, they'll run under `bun test` without any changes.

The main things that don't carry over are Jest's custom runner plugins and some snapshot serializer customizations, but for most application test suites those aren't really factors.

## Switching

Remove Jest:

```bash
npm uninstall jest ts-jest @types/jest babel-jest
```

Remove any `jest.config.ts` or `jest.config.js`, along with the `transform` and `testEnvironment` config if you had them.

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

One thing `bun test` does particularly well is filtering. In a `pre-commit` hook you rarely want to run every test, just the ones related to what you're actually changing:

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

Coverage output works out of the box with no extra packages required. With Jest you needed `--coverage` plus `@jest/coverage-provider` or a separately configured coverage provider. Bun just handles it natively.

## Watch mode

```bash
bun test --watch
```

Re-runs affected tests on file change, and the feedback loop feels noticeably tighter than Jest's watch mode because you're not paying the startup cost on every re-run.

## What to keep in mind

Bun's test runner is stable but younger than Jest, so there are a few things worth knowing before you commit to a migration.

- **Snapshot testing** works, and the format is compatible enough with Jest's that most existing snapshots migrate without issues.
- **jsdom** is not bundled. Tests that need a browser-like DOM environment require `--dom` or a separate setup, which matters for component testing but never comes up for backend or utility code.
- **Module mocking** works for most cases, though complex Jest factory patterns occasionally need minor adjustments.

For a TypeScript backend, CLI tool, or utility library, none of these caveats really apply and you can switch without hesitation. For a React component test suite, expect a short migration session rather than a zero-touch swap.

## The bottom line

Jest made sense when the alternatives were worse. In 2026, `bun test` feels faster, requires no configuration, handles TypeScript natively, and covers 95% of what Jest does. The main reason to stay on Jest is an existing suite with deep Jest-specific dependencies, and even then a migration is usually shorter than you'd expect. For anything new, just start with `bun test`.
