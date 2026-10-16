# Z83 Auto-Matcher

A free, browser-only prototype for South African public service applicants.
Upload a DPSA vacancy circular and your CV, see how each post matches, then download a
**Z83 + CV** PDF for every post you choose. No server, no AI API, no cost per user.
**Your documents never leave your device.**

## How it works
1. **Upload** the circular and your CV (PDF). Text is read in the browser with pdf.js.
2. **Results**: posts are split out by reference number. Posts whose closing date has passed are marked closed; if every post is closed, the app asks for a newer circular. Each open post gets a rule-based score (direct match / via equivalency / partial / missing) with reasons. The score never blocks you.
3. **Profile**: Z83 answers are pre-filled from the CV (name, ID, race, gender, languages, qualifications, work, references, ...) and flagged "From your CV: please check". Anything missing is asked once (declarations, signature, initials) and saved in `localStorage` only.
4. **Download**: the official Z83 (Gazette 6 Nov 2020) is filled with pdf-lib, merged with the CV (Z83 first), named `<reference> - <post title>.pdf`, and offered individually or as a ZIP. Nothing is emailed for you.

If a CV has no references, the app says so and still lets you build the pack.

## Editing the equivalency list
`src/data/equivalency.json` seeds the groups of qualification fields treated as interchangeable. Users can also add pairs in the app (Results screen); those are stored in their browser.

## Develop
```
npm install
npm run dev      # local dev server
npm test         # parser, matcher and PDF tests
npm run build    # static site in dist/ (works on GitHub Pages)
```

## Notes
- `public/Z83.pdf` is the official form with its editing restrictions removed (it has no password). It is a flat scan with no fields, so values are drawn at measured coordinates in `src/lib/z83.ts`.
- Parsing is heuristic: always check the circular and the generated Z83 yourself.
- UI decisions follow `design-system/z83-auto-matcher/MASTER.md` (UI UX Pro Max skill in `.claude/skills/`).
