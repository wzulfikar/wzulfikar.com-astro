---
title: "Replace husky with lefthook"
description: "Lefthook is faster, zero-dependency, and fits modern monorepo tooling better than husky. Here's why and how to switch."
date: "Apr 05 2026"
---

Husky is the default choice for Git hooks in JavaScript projects. It works, but it carries assumptions that start to chafe in modern setups — Node.js as a runtime requirement, a shell script per hook, and a sequential execution model that can make pre-commit feel slow. Lefthook fixes all of that.

## What's wrong with husky

Husky works by writing shell scripts into `.husky/`. Each hook is a file like `.husky/pre-commit` that you edit by hand. That's fine for a single repo, but:

- **Node.js dependency.** `husky` is an npm package. In a polyglot monorepo — or any project that isn't primarily JavaScript — pulling in Node just to run Git hooks is overhead.
- **Sequential by default.** Your pre-commit hook runs linting, then type-checking, then tests, one after another. On a large codebase this is slow.
- **No parallelism primitives.** You can hack parallel execution with `&` and `wait` in shell, but it's manual and fragile.
- **Per-hook files.** Managing multiple hooks means multiple files, with no central view of what runs where.

## What lefthook does differently

[Lefthook](https://github.com/evilmartians/lefthook) is a single binary written in Go. No Node, no npm install in CI just to get hooks. Drop it anywhere — macOS, Linux, Windows, Docker — and it works.

Configuration lives in a single `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts}"
      run: npx eslint {staged_files}
    typecheck:
      run: tsc --noEmit
    format:
      glob: "*.{js,ts,css}"
      run: npx prettier --check {staged_files}
```

`parallel: true` runs all commands concurrently. On a project where lint + typecheck + format used to take 12 seconds sequentially, they finish in 4 seconds in parallel.

## Migration from husky

1. **Remove husky:**

   ```bash
   npm uninstall husky
   rm -rf .husky
   ```

   Remove the `prepare` script from `package.json` if you added one for husky.

2. **Install lefthook:**

   ```bash
   # npm
   npm install --save-dev lefthook

   # or install the binary directly (no Node required)
   brew install lefthook
   ```

3. **Create `lefthook.yml`** at the repo root and migrate your hooks. A typical husky `pre-commit` that runs lint-staged becomes:

   ```yaml
   pre-commit:
     parallel: true
     commands:
       lint-staged:
         run: npx lint-staged
   ```

   Or skip lint-staged entirely — lefthook has `glob` and `{staged_files}` built in, so you can pass only changed files to each command natively.

4. **Install the Git hooks:**

   ```bash
   npx lefthook install
   ```

   This writes the actual hook files into `.git/hooks/`. Commit `lefthook.yml`; the hook files themselves don't need to be committed.

## Monorepo and polyglot projects

Lefthook's binary model shines in monorepos. You can scope commands to subdirectories:

```yaml
pre-commit:
  parallel: true
  commands:
    api-lint:
      root: "packages/api/"
      glob: "**/*.go"
      run: golangci-lint run {staged_files}
    web-lint:
      root: "packages/web/"
      glob: "**/*.ts"
      run: npx eslint {staged_files}
```

Each command only runs if files matching its glob are staged. The Go linter doesn't fire when you only touch TypeScript files.

## CI considerations

In CI you usually don't want Git hooks to run. Lefthook respects the `CI` environment variable — if it's set, `lefthook install` is a no-op. No configuration needed.

If you want to run the same checks in CI that lefthook runs locally, you can invoke them directly:

```bash
npx lefthook run pre-commit
```

This executes the hook commands without needing a Git event, so your CI pipeline and local hooks stay in sync from the same config file.

## The result

One config file. Parallel execution by default. No Node dependency if you install the binary. Scoped globs so commands only run when relevant files change. For most projects this is a straight upgrade — faster hooks with less configuration sprawl.

If you're starting a new project, skip husky entirely. If you're maintaining an existing one, the migration takes 20 minutes.
