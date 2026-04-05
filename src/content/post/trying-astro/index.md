---
title: "Trying Astro"
description: "Markdown-driven blogging, framework-agnostic components, GitHub Pages deployment, and writing posts from Claude on iOS."
date: "Apr 05 2026"
---

Astro kept showing up in my timeline. Not in the hyped, everyone's-rewriting-everything way, but consistently, from people who seemed to be actually using it. That was enough reason to try it.

The use case I had in mind was specific: a site I could write posts for from my AI IDE or from Claude on iOS. No CMS dashboard, no login, no pipeline to manage beyond a git push. Just markdown files and a deploy.

---

## Why Astro

Astro is optimized for static content. That fits. A personal site doesn't need server-side rendering, a database, or edge functions. It needs fast pages and a simple authoring workflow.

What surprised me was the framework-agnostic approach. You can use React, Vue, Svelte, or nothing at all. The "nothing at all" option turned out to be exactly right for this project. Plain HTML with Astro's component syntax is enough. You get the composition model of React, the ability to break the UI into reusable pieces, without pulling in a framework and its runtime.

For a site that's mostly text and a few layout concerns, this is the correct tradeoff.

---

## The Template: Astro Nano

I started with [Astro Nano](https://github.com/markhorn-dev/astro-nano), a minimal template that does very little by design. No bloat, no dark mode toggle, no comment system. Just a layout, a content collection, and a handful of pages.

That minimal surface area is what I wanted. The template gives you the structure, and you add only what the project actually needs. Tailwind is included and works as expected.

---

## Deployment: GitHub Pages with a Custom Domain

The site is deployed to GitHub Pages. The GitHub Actions workflow builds on push to main and publishes the output. Custom domain is configured in the repo settings.

Everything is self-contained: the content lives in the repo, the distribution runs on GitHub. There's no hosting bill, no third-party service to stay logged into, and nothing to migrate if requirements change. The whole thing is a git repository.

---

## Content Authoring with Claude on iOS

This is the part I didn't anticipate being interesting.

The posts are markdown files in `src/content/post/`. Each post is a folder with an `index.md` inside. Writing a post means creating that file with the right frontmatter and putting content in it.

What I found is that the Claude iOS app fits naturally into this workflow. I can open it anywhere, talk through an idea, give it an outline, and ask it to draft the post. Then review, adjust, commit, and push to main. The post is live.

That's a meaningfully different way to write. The friction isn't in the writing; it's in having something to say. Lowering the cost of getting from "I have an idea" to "there's a post about it" makes the writing part less of a bottleneck. The conversation itself becomes the drafting process.

The workflow:
1. Talk through the topic, get the shape of it clear
2. Give Claude the outline and the key points
3. Ask it to fill in the structure
4. Review and edit in the IDE or directly on mobile
5. Commit and push to publish

No content management system needed. The AI is the editor interface.

---

## What Works

The build is fast. Pages are static HTML, so load times are predictable. Tailwind works without configuration. The content collection schema in `config.ts` catches missing or malformed frontmatter before anything ships.

The authoring experience from both desktop and mobile is smooth enough that the limiting factor is ideas, not tooling.

---

## What to Watch

The template is minimal by intent. Adding features (search, RSS, tag pages) means doing it yourself. That's a reasonable tradeoff at this stage, but it's worth knowing the template isn't a full-featured CMS replacement.

Astro's component model also has a learning curve if you're used to React's reactivity model. Astro components are server-rendered by default. Client-side interactivity requires explicit opt-in with `client:load` or similar directives. For a static blog this barely matters, but it's a different mental model than React.

---

*Astro Nano, GitHub Pages, Tailwind, and Claude on iOS. That's the stack for this site. It does what I need and nothing more.*
