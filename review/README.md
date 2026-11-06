# Dhikër text review

Internal review page for all 40 app entries. The page is hosted on GitHub Pages; shared corrections are stored in the authenticated review service.

Reviewer and owner links use separate random access keys in the URL fragment. Keys are removed from the address bar after being loaded into session storage. Keep the owner link private. No access keys belong in this repository.

The reviewer edits the four original text fields; proposals save automatically after a short pause. Arabic starts read-only and requires an explicit edit action. While editing or when the proposal differs, the source Arabic is visible for comparison. Arabic spellcheck/autocorrect are disabled; a comparison notice distinguishes letter/spacing changes from marks/punctuation. A confirmed restore action resets only Arabic and autosaves it. The indicator confirms when saving succeeds. The owner accepts or returns each proposal. These actions update review records; they do not modify the released app.

`content.json` contains the exact current Arabic override, transliteration, Albanian text and full references, including the composite bedtime entry. Missing fields are preserved. The Arabic font is bundled under its OFL license.

To export a future coordinated review snapshot:

```sh
node scripts/export-review.mjs /path/to/dhikr-app
```

Keep the backend's `lib/content.json` synchronized and resolve existing suggestions before changing a review snapshot. The API rejects saves against a different content revision. The page does not claim that texts have already been verified.
