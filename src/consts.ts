import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "wzulfikar",
  EMAIL: "hey@wzulfikar.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_SHOWS_ON_HOMEPAGE: 2,
  NUM_SNOWBALLS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Astro Nano is a minimal and lightweight blog and portfolio.",
};

export const POST: Metadata = {
  TITLE: "Post",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const SHOW: Metadata = {
  TITLE: "Show",
  DESCRIPTION: "Where I have worked and what I have done.",
};

export const SNOWBALL: Metadata = {
  TITLE: "Snowball",
  DESCRIPTION:
    "A collection of my projects, with links to repositories and demos.",
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
  // {
  //   NAME: "linkedin",
  //   HREF: "https://fi.linkedin.com/in/wildan-zulfikar-30a30a100",
  // },
];
