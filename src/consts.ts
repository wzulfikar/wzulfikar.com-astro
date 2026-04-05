import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
	NAME: "wzulfikar",
	EMAIL: "hey@wzulfikar.com",
	NUM_POSTS_ON_HOMEPAGE: 3,
	NUM_SHOWS_ON_HOMEPAGE: 2,
	NUM_SNOWBALLS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
	TITLE: "Home",
	DESCRIPTION: "Software engineer and maker. Writing about things I think about, showing what I build, and documenting patterns worth keeping.",
};

export const POST: Metadata = {
	TITLE: "Post",
	DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const SHOW: Metadata = {
	TITLE: "Show",
	DESCRIPTION: "Things I'm working on and building.",
};

export const SNOWBALL: Metadata = {
	TITLE: "Snowball",
	DESCRIPTION: "Patterns worth investing in. Compounding and transferable.",
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
