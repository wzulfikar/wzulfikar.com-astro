---
title: "Move from Lodash to es-toolkit"
description: "es-toolkit is a modern utility library built for today's JavaScript: tree-shakeable, TypeScript-first, and fast. Lodash solved real problems in 2013. Most of those problems are gone."
date: "Apr 05 2026"
---

JavaScript utility libraries have been around since the language itself was painful to work with. Understanding where we came from makes it clearer why switching now makes sense.

## A brief history: Underscore → Lodash → now

**Underscore.js** (2009) came first. Arrays didn't have `map` or `filter` in IE. Objects were hard to clone reliably. Underscore gave you a consistent functional toolkit across browsers that disagreed on nearly everything.

**Lodash** (2012) forked from Underscore and quickly outgrew it. Better performance, more functions, lazy evaluation chains, and deep object utilities that Underscore didn't bother with. By the time ES6 arrived, Lodash had become the default dependency you added to every project without thinking.

The problem is that the JavaScript ecosystem it was built for no longer exists. Native arrays have `map`, `filter`, `flatMap`, `findIndex`. The spread operator handles shallow clones. Optional chaining removes the need for `_.get`. Modules are standard. TypeScript is everywhere.

Lodash kept adding functions and compatibility shims. The library grew. It became hard to tree-shake properly. Its types lagged behind. It still ships a CommonJS-first build in a world moving toward ESM.

**es-toolkit** is the replacement. It was built after ES6, after TypeScript, after ESM. It doesn't carry Underscore's legacy.

## What's actually different

### Bundle size

Lodash's full bundle is ~72kb minified. Even with tree-shaking, many bundlers struggle to eliminate unused code because of how Lodash was written—functions reference each other internally in ways that pull in more than you intended.

es-toolkit functions are isolated by design. Each one is a standalone ESM module with no internal cross-references. Tree-shaking works completely. A project that only uses `chunk`, `groupBy`, and `debounce` ships only those three.

### TypeScript

Lodash's types are maintained separately in `@types/lodash`. They lag behind, have inconsistencies, and often require manual type assertions to get right. Functions like `_.groupBy` return `Dictionary<T[]>`, not `Record<string, T[]>`, and the inference doesn't always propagate cleanly.

es-toolkit is written in TypeScript. The types are part of the source, not an afterthought. `groupBy` returns `Record<string, T[]>`. `chunk` returns `T[][]`. The types match what actually comes out.

### Performance

es-toolkit benchmarks faster than Lodash across most operations. The library is simpler because it doesn't need to support IE or handle edge cases from a pre-ES6 world. Less code running means less time spent.

### ESM-first

Lodash ships CJS. There are ESM builds (`lodash-es`) but they're a separate package you have to explicitly install and import from. es-toolkit is ESM by default, with CJS as a secondary output. This matters for bundlers and for environments like Deno or edge runtimes that prefer or require ESM.

## The functions you actually use

Most Lodash usage in practice comes down to a small set of functions. Here's how they map:

| Lodash | es-toolkit |
|--------|------------|
| `_.chunk` | `chunk` |
| `_.debounce` | `debounce` |
| `_.throttle` | `throttle` |
| `_.cloneDeep` | `cloneDeep` |
| `_.groupBy` | `groupBy` |
| `_.omit` | `omit` |
| `_.pick` | `pick` |
| `_.uniq` | `uniq` |
| `_.uniqBy` | `uniqBy` |
| `_.merge` | `merge` |
| `_.flatten` | `flatten` |
| `_.flattenDeep` | `flattenDeep` |
| `_.isEqual` | `isEqual` |
| `_.orderBy` | `orderBy` |
| `_.intersection` | `intersection` |
| `_.difference` | `difference` |

The API surface is similar. Most migrations are a find-and-replace on import paths.

## Switching

Install es-toolkit:

```bash
npm install es-toolkit
```

Uninstall Lodash:

```bash
npm uninstall lodash lodash-es @types/lodash @types/lodash-es
```

Update imports. Lodash:

```ts
import { groupBy, uniqBy, cloneDeep } from 'lodash'
```

es-toolkit:

```ts
import { groupBy, uniqBy, cloneDeep } from 'es-toolkit'
```

If you were using the `lodash-es` ESM package, the change is the same—just swap the import path.

For larger codebases, a codemod handles the mechanical part:

```bash
npx codemod lodash/to-es-toolkit
```

## What es-toolkit doesn't have

es-toolkit doesn't implement every Lodash function. A few notable omissions:

- **`_.chain`** — method chaining. This pattern fell out of style and es-toolkit doesn't include it. Use native array methods or plain function composition instead.
- **`_.template`** — string template compilation. Rarely used in modern code; if you need it, keep it as a direct Lodash import.
- **`_.invoke` / `_.invokeMap`** — uncommon in practice.

es-toolkit does include a compatibility layer for the most common Lodash functions if you need a bridge during migration:

```ts
import { groupBy } from 'es-toolkit/compat'
```

The compat build matches Lodash's exact behavior, including edge cases and argument handling. It's a stepping stone, not a destination—migrate to the main package functions when you can.

## What you should still use native for

Before reaching for es-toolkit, check if native JavaScript already covers it:

- `_.map(arr, fn)` → `arr.map(fn)`
- `_.filter(arr, fn)` → `arr.filter(fn)`
- `_.find(arr, fn)` → `arr.find(fn)`
- `_.reduce(arr, fn, init)` → `arr.reduce(fn, init)`
- `_.flatten(arr)` → `arr.flat()`
- `_.flatMap(arr, fn)` → `arr.flatMap(fn)`
- `_.get(obj, 'a.b.c')` → `obj?.a?.b?.c`
- `_.assign({}, a, b)` → `{ ...a, ...b }`

If the native version is readable, use it. es-toolkit fills the gap for things that genuinely don't have clean native equivalents—deep cloning, debounce, deep equality, grouping.

## The bottom line

Lodash was the right tool for a decade. The JavaScript it was designed to paper over is mostly gone. es-toolkit is smaller, faster, TypeScript-native, and ESM-first. There's no reason to start a new project with Lodash, and migrating an existing one is mostly a one-line change per import.
