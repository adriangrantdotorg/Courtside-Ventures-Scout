# Share Preview

What LinkedIn, Slack, iMessage and X show when someone shares Scout's link: the picture (`src/app/opengraph-image.jpg`), then the title and description below. Edit the two sections; `npm run check` fails if one is too long.

- **Title:** 60 characters or less.
- **Description:** 125 characters or less. LinkedIn shows it on one line and cut the old one at 129 characters (10-30-26).
- After an edit: deploy, then refresh LinkedIn in Post Inspector. Posts and messages already sent keep their old card.

## Title

Courtside Ventures Scout

## Description

Deal sourcing for Courtside Ventures: startups, trends, sponsors and funds, every fact linked to its source.
