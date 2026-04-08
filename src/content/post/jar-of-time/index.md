---
title: "Jar of Time"
description: "A prioritization approach that helped me understand why I feel busy instead of productive."
date: "Apr 13 2026"
---

For a while, the simplest thing I found for sorting my work was splitting tasks into two buckets: value work and maintenance work. It came from somewhere on X, I don't remember exactly where, but the idea stuck because it felt clean and easy to apply. Is this moving something forward, or am I just keeping the lights on?

It worked, until it didn't.

Not everything fits cleanly into two buckets. Some work feels strategic but pays off slowly, some feels urgent but isn't really important, and some is definitely maintenance but still matters a lot. Over time the line between value and maintenance started to blur, and eventually I was just guessing instead of thinking clearly about what actually deserved my attention.

Then I came across [Rocks, Pebbles, Sand](https://longform.asmartbear.com/rocks-pebbles-sand/) from asmartbear, and something clicked.

The idea is simple: if you're filling a jar, put the rocks in first, then the pebbles, and the sand fills the gaps. Each component is different in size but they work together. Flip the order and you won't fit everything, because the sand takes up too much space and the rocks won't go in.

Applied to work, it breaks down roughly like this.

**Rocks** are your strategic priorities, the things that if you pulled them off would actually change where you're headed. They carry a long time horizon, think in terms of years, and there aren't many of them. There shouldn't be. The whole point is that they're heavy and worth carrying deliberately.

**Pebbles** are the tactical work that supports the rocks, things that matter on a scale of months and move you through the middle layer between strategy and day-to-day. Projects, milestones, the meaningful chunks of work that accumulate into something bigger over time.

**Sand** is everything else: admin, tweaks, small fixes, the low-lift stuff that always seems to fill up the day. It's not useless and sand genuinely matters, but it's not what you should be optimizing around.

What hit me hardest reading the post was finally understanding why I'd been feeling busy without feeling productive. I was doing pebbles constantly without ever deliberately deciding which rock I was working toward. Pebbles feel real and concrete and completable in ways that rocks don't, so I'd reach for them naturally. And sand never runs out. There's always something small to do, always something to tweak or respond to or tick off.

But if you only do pebbles and sand, the rock never moves. The jar looks full because it is full, just not with what you meant to fill it with.

What I like about the Rock, Pebble, Sand framing is that it stays simple while handling the complexity that the value/maintenance split couldn't. A rock can be value work. A pebble can be value work too, just at a different level. Maintenance can exist at all three layers. The categories aren't about the type of work but about scope and time horizon, which feels like a more useful axis entirely.

It also makes the question easier to ask. When I'm deciding what to focus on, I'm no longer asking "is this valuable?" which can spiral into endless justification. I'm asking what my rock is right now, and whether what I'm about to do helps me get it in the jar first.

***

To make it concrete, here's how it maps if you're building a mobile app with a backend.

Rocks are the bets you're making at the product level, the year-scale decisions that shape what everything else is in service of:

- Get to a working app users can actually pay for
- Validate core retention before expanding features
- Migrate off a third-party dependency that's becoming a ceiling

Pebbles are the projects that push a rock forward over the course of weeks or months. Each one feels like real work with real scope, and finishing it moves you visibly closer to the rock:

- Build the auth flow end to end
- Ship push notifications with backend support
- Add offline mode with sync
- Integrate a payment provider
- Set up a staging environment with CI

Sand is what fills the rest. None of it is wasted, but it's the kind of thing that expands to fill whatever time you give it if you're not careful:

- Fix a layout bug on one screen
- Bump a dependency
- Tweak copy
- Add a missing loading state
- Respond to a crash report
- Clean up an endpoint that's been bothering you

The trap, at least for me, is that pebbles and sand feel satisfying in a way rocks don't. Rocks feel uncomfortable because they're vague and slow and uncertain, while a pebble has a clear start and end, and sand has an even clearer one. So you do those instead, and then wonder why the product doesn't feel like it's moving.

Not a perfect system, and no system is. But it feels like the right kind of simple.
