# Game help API

Each game registered with `defineRoomGame` supplies a `help` document. The shared
help UI renders the same document from the creation sheet, lobby and game table;
opening it does not pause a running multiplayer game. See
`app/src/features/sevens/help.ts` and `app/src/features/hearts/help.ts` for
complete examples.

A `GameHelp<Variant>` document contains an introductory summary, non-empty
sections, optional illustrated examples, and a `variants` record. Each example
contains labelled rows of actual `Card` objects and an explanation; the shared
UI renders the cards, so games do not need to implement their own help screen.
Games without a selectable `variant` in their creation options use
`GameHelp` with `variants: null`.

For games with selectable variants, `defineRoomGame` derives the variant keys
from the creation options' `variant` type and requires a `VariantHelp` entry for
every key. Variant descriptions and sections are mandatory. Sevens also derives
its creation picker directly from this record: adding a `SevensVariant` without
documenting it fails TypeScript checking instead of silently omitting help.

```ts
const help = {
  summary: 'How to win.',
  sections: [{ title: 'The basics', paragraphs: ['How to play.'] }],
  variants: {
    standard: {
      label: 'Standard',
      description: 'The usual rules.',
      sections: [{ title: 'Standard rules', paragraphs: ['Details.'] }],
    },
  },
} as const satisfies GameHelp<'standard'>;
```

When adding a game, pass its help document to `defineRoomGame` in
`app/src/features/card-room/registry.ts` along with the game's lobby metadata and
typed creation options. Keep the example card arrangements consistent with the
engine rules and add tests like those in `app/test/help.test.ts`.

## Device checks

- Open help for both games in the creation sheet, change the selected game and
  Sevens variant, and confirm the correct guide and current variant are shown.
- Close help with the button, backdrop, and Android back; confirm lobby name,
  role, variant and options remain unchanged.
- Open help in a lobby and during an active game as player and spectator. Verify
  the game continues, the sheet scrolls, and closing it returns to the table.
- Check examples, long text and large accessibility text on iOS and Android.
