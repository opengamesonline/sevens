# Hearts in Card Room

## Verified rules and chosen conventions

Sources checked during implementation:
- [Pagat: Hearts (American rules and variations)](https://www.pagat.com/reverse/hearts.html)
- [Bicycle: Hearts](https://bicyclecards.com/how-to-play/hearts/)

Hearts has common house-rule differences; this implementation fixes the following
rules rather than exposing variants in the first release:

- Exactly four players, including bots. Standard 52-card deck, 13 cards each;
  ace high, no trump. Seat order, dealing, and play are clockwise.
- Pass three cards left, right, across, then no passing, repeating each four
  hands. Selections commit simultaneously: nobody receives cards until all
  four players submit. Submitted selections cannot be changed.
- After passing, the holder of the two of clubs must lead it.
- Follow the led suit when possible. Otherwise discard any card, except no
  hearts or queen of spades on the first trick unless the hand contains only
  penalty cards. This is a common first-trick restriction listed by Pagat and
  described by Bicycle.
- The highest card of the led suit wins the trick; its winner leads next.
- Hearts cannot be led until a heart has been discarded, unless the leader has
  only hearts. **The queen of spades does not break hearts.** This follows
  Pagat's base American rules; Bicycle describes the alternative in which the
  queen also breaks hearts.
- Each heart costs one point, the queen of spades costs 13, all other cards zero.
  Score at the end of all 13 tricks, not partway through a hand.
- Taking all 26 penalty points shoots the moon: shooter receives zero; every
  opponent receives 26. No subtraction option, shooting-the-sun bonus, or
  jack-of-diamonds bonus is included.
- When anyone reaches or exceeds 100 after scoring a hand, the match ends.
  Lowest total wins. **Tied lowest scores share victory**, rather than playing
  a tie-breaking hand. This is an explicit app convention.
- The host deals the next hand after the results screen. After match completion,
  returning to the lobby and starting again begins a fresh match at zero.

## Architecture and compatibility

Both engines live in `library/src/{sevens,hearts}`; card primitives live in
`library/src/shared`. The existing package name and Sevens root API remain valid.

`app/src/features/card-room` supplies common rooms, discovery coordination,
participant naming, lobby controls, session lifecycle, and recovery validation.
Each game supplies a typed adapter for its policy, bot events, and state schema.
Only the selected game's session provider starts a transport/recovery process;
inactive contexts remain mounted to avoid resetting navigation. A separate shared browser
discovers both games; a game is fixed when its room is created.

Room creation is shared. The game picker changes only the draft; the selected
provider is activated when creation is submitted, after the current provider has
finished checking recovery. A pending creation suppresses recovery of the newly
selected game's old table while its provider initializes.

To add a game, register its metadata, typed creation options, lobby validator,
and browser summary with `defineRoomGame` / `defineRoomGames` in
`app/src/features/card-room/registry.ts`. Add its provider, creation-options
component, and session screen to `GAME_ADAPTERS` in `game-adapters.tsx`; the
shared picker, browser, provider mounting, and session route iterate those
registrations. Each game must also provide a help document, with a typed entry
for every selectable variant; see [the help API](game-help.md). Use
`createSessionProvider` with the game's own protocol policy,
recovery validators, and bot adapter. The settings component can render no
additional options, as Hearts does.

Sevens retains protocol ID `com.opengamesonline.sevens` / version 4 and its
`sevens.active-table.v1` recovery key. Hearts uses
`com.drasolabs.cardroom.hearts` / version 1 and `hearts.active-table.v1`.
These identify game protocols, not native app bundle identifiers. Join validation
and recovery checks reject mismatched games/versions. Host-only bot envelopes
cannot be submitted by clients; next-round deals are host-only too.

Spectators join before the game starts and receive no hand controls. As with the
existing Sevens transport, full authoritative state is replicated to clients to
support host migration. Hidden cards are hidden by the UI, **not cryptographically
hidden from a modified client**. This is intended for trusted local-network play,
not adversarial online competitive play.

## Automated checks

```sh
cd library
bun run typecheck
bun test
bun run build
cd ../app
npm run check
npm run lint
npm run test:policy
npm run test:bridge
npm run test:config
npx expo export --platform ios --platform android
```

Tests include first-trick restrictions, follow-suit rules, ace-high trick winners,
forced hearts leads, passing rotation/atomicity, moon scoring, 100-point thresholds,
ties, immutable/serialized states, bot-only full-match simulations, policy
authorization, room filters, and recovery/host-policy reconstruction.

## Device acceptance checklist

These need real iOS/Android development clients or release builds; bundle export
and engine tests do not exercise native networking or touch interactions.

1. Use the same create-room sheet for both games. Switch the draft selection and
   verify only Sevens shows its variant, seat and hint settings; verify switching
   the draft does not restore a saved table for the other game. Create one Sevens
   and one Hearts room on different devices. Verify the shared browser sees both,
   filters/search work, and joining selects the correct game.
2. Fill a Hearts room with four humans, then with a mix of humans and both bot
   strategies. Confirm a fifth player is rejected but spectators can join the lobby.
3. Select/pass three cards, confirm the player strip shows submission readiness
   (not a turn) until all players pass, then check the highlighted turn, 2♣ lead,
   card counts, legal-play highlighting, trick display and scoring.
4. Test a spectator host with four bots, hand transitions, moon scoring, and a
   full match. Check the fresh-match reset after returning to the lobby.
5. Background/relaunch during passing and mid-trick. Disconnect a player and
   reconnect: their seat, pass submissions, cards and scores must remain intact.
6. Kill the host during passing and play. Verify host migration, resumed bot turns,
   and the next hand without duplicate cards, lost scores, or duplicate passes.
7. Leave explicitly: the old table must not recover later. Verify no switching
   games within an active room and no accidental restoration of the other game.
8. Regression-test Sevens (standard and Joker), draw/give flow, bots, cumulative
   scores, spectators, and recovery on both platforms.
