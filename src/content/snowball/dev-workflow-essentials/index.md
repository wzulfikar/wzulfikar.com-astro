---
title: "My Workflow Essentials for Web and Mobile (Expo) Dev"
description: "The tools I keep coming back to: openlogs, agent-browser, agent-device, gh mcp, and context7. Start here, then layer in skills for specific use cases."
date: "Apr 14 2026"
---

After enough projects, you start noticing which tools actually survive contact with real work and which ones get quietly swapped out after a week. This is my current essential stack for web and Expo (React Native) development. Not everything I've tried, just what stayed.

## The essentials

### openlogs

Logging sounds boring until you're debugging a production issue at midnight and realize you can't see anything. openlogs makes your app's logs actually accessible: structured, searchable, and real-time, without needing to stand up a full observability platform first.

It's the kind of tool that earns its place the first time something breaks in an environment you can't attach a debugger to.

### agent-browser (web) and agent-device (mobile)

These two cover different sides of the same idea, which is letting an agent interact directly with your running app.

agent-browser connects to your web app so you can ask things like "click the login button and tell me what network request fires," or have it walk through a flow and report what broke. It feels less like automation and more like having someone sit next to you and poke at the app while you watch.

agent-device does the same for mobile, connecting to your Expo app on a simulator or physical device. Especially useful when you're building something UI-heavy and want to validate interactions without writing formal E2E tests for every case.

If you're already invested in MCP, both have drop-in replacements: agent-browser maps to chrome mcp (or any browser-focused MCP server), and agent-device maps to XcodeBuildMCP for iOS and simulator workflows. Try both and use whichever fits better into your existing setup. The underlying capability is the same; the integration path is what differs.

### gh mcp

GitHub's official MCP server. Once this is wired in, you can manage issues, review PRs, check CI status, and trigger workflows from inside your agent session, without switching to the browser or juggling the `gh` CLI separately.

For any project that lives on GitHub, this feels like table stakes. The friction of context-switching to check a PR status adds up faster than it seems, and gh mcp just removes that cost entirely.

### context7

context7 keeps your agent's context accurate by resolving library documentation and API references on demand. So when you're asking the agent to write code using a specific SDK or framework, it's working from the real current docs rather than training data that may be months out of date.

This matters more than it sounds. A lot of "why is the agent writing deprecated syntax" frustration disappears once context7 is in the loop.

## Beyond the essentials: skills for specific use cases

The five above cover most of the base. For more specific scenarios, [skills.sh](https://skills.sh) has a library of composable skills you can layer in, things like a frontend skill for component and layout work, a backend skill for APIs and server-side logic, or an animation skill for motion and interaction design.

The pattern that works: start with the essentials, then pull in a skill when you hit something specialized. Installing everything upfront just creates noise.

## The principle behind the list

Every tool here addresses a real failure mode I've run into. openlogs for when you can't see what's happening. agent-browser and agent-device for when you want to validate behavior without committing to full E2E test suites. gh mcp for when context-switching starts breaking your flow. context7 for when the agent's knowledge is quietly stale.

That's the filter: does this tool solve a problem I'm actually running into, or does it just sound useful? Start with these five and most problems you'll hit are already covered.
