---
title: "trigger.dev is the right tool for user-created monitoring"
description: "Comparing Cloudflare Cron, Cloudflare Queue, and trigger.dev — and why trigger.dev wins for monitoring systems created by your users."
date: "Apr 04 2026"
---

When building a monitoring system where users define their own checks — "ping my API every 5 minutes", "alert me if this price drops below $X" — you need infrastructure that can handle dynamic, user-defined schedules at scale. Three tools come up naturally in this space: Cloudflare Cron Triggers, Cloudflare Queues, and trigger.dev. They solve adjacent problems but are not interchangeable.

## Cloudflare Cron Triggers

Cloudflare Cron lets you run a Worker on a fixed schedule, defined at deploy time in `wrangler.toml`.

```toml
[triggers]
crons = ["*/5 * * * *"]
```

**What it's good for:** Infrastructure-level tasks you control — purging caches, sending daily digests, running DB maintenance. The schedule is static and owned by you, the developer.

**Why it breaks for user-created monitoring:** Each user would need their own cron trigger. Cloudflare limits you to a small number of cron schedules per Worker. There's no API to create cron triggers dynamically at runtime. You'd have to re-deploy your Worker every time a user creates or updates a monitor. That's a non-starter.

## Cloudflare Queues

Cloudflare Queues is a message queue — producers push messages, consumers process them. You can simulate scheduled work by having a recurring producer push jobs, and a consumer execute them.

**What it's good for:** Decoupling work, handling bursts, retrying failed jobs. It's a solid primitive for async processing.

**Why it's a poor fit for user monitoring:** Queues don't have a native concept of "run this job every N minutes for user X". You'd need to build a scheduler on top — something that wakes up, looks at a database of user monitors, and enqueues jobs at the right time. Now you're maintaining a scheduler, not using one. You've traded one problem for a bigger one.

## trigger.dev

[trigger.dev](https://trigger.dev) is a background job and workflow platform with first-class support for dynamic, programmatically-created schedules.

```typescript
import { schedules } from "@trigger.dev/sdk/v3";

// Create a schedule for a user's monitor at runtime
await schedules.create({
  task: "check-monitor",
  cron: "*/5 * * * *",
  externalId: `user-${userId}-monitor-${monitorId}`,
  deduplicationKey: `monitor-${monitorId}`,
});
```

When the user deletes or pauses their monitor, you call `schedules.del()`. When they change the frequency, you call `schedules.update()`. It's just an API call.

**Why it wins for user-created monitoring:**

1. **Dynamic schedules at runtime.** No deploys required. Users can create, update, and delete their monitors and the schedule follows immediately.

2. **Per-schedule identity.** Each schedule has an `externalId` you control — you can map it back to the user and monitor in your database trivially.

3. **Built-in deduplication.** The `deduplicationKey` ensures you don't accidentally create duplicate schedules if your user hits "save" twice.

4. **Managed retries and observability.** Failed runs are retried automatically. You get a full run history per task, per schedule — invaluable for debugging "why didn't my alert fire?".

5. **Fan-out ready.** When you have 10,000 users each with 3 monitors, trigger.dev handles the fan-out. You don't think about queues, workers, or concurrency limits.

## The mental model

| | Cloudflare Cron | Cloudflare Queue | trigger.dev |
|---|---|---|---|
| Schedule defined by | Developer at deploy time | You build it yourself | Developer at runtime via API |
| Dynamic user schedules | No | Manual plumbing | Yes, first-class |
| Retry/observability | Basic | Manual | Built-in |
| Scales with user count | No | With effort | Yes |

Cloudflare Cron is for _your_ recurring tasks. Cloudflare Queue is a building block. trigger.dev is the right abstraction when your users are the ones defining what runs and when.

If you're building a monitoring product — uptime checks, price alerts, data sync jobs, anything where users create schedules — invest in trigger.dev early. The alternative is hand-rolling a scheduler, and that's a rabbit hole that swallows sprints.
