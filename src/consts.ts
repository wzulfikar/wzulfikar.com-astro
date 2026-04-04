import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "wzulfikar",
  EMAIL: "hey@wzulfikar.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_SHOWS_ON_HOMEPAGE: 3,
  NUM_SNOWBALLS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Wildan's personal site — blog, show, and snowball.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Essays and bursts of thought.",
};

export const SHOW: Metadata = {
  TITLE: "Show",
  DESCRIPTION: "Recent things I've built and shipped.",
};

export const SNOWBALL: Metadata = {
  TITLE: "Snowball",
  DESCRIPTION: "Patterns, techniques, and tools worth investing in — transferable, compounding knowledge.",
};

export const SOCIALS: Socials = [
  {
    NAME: "x",
    HREF: "https://x.com/wzulfikar",
  },
  {
    NAME: "github",
    HREF: "https://github.com/wzulfikar",
  },
];
