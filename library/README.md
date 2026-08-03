# @opengamesonline/sevens

A dependency-free, functional TypeScript game engine for the card game Sevens.

The package exposes serializable game state and pure state transitions. It does not mutate game objects, hands, boards, or actions supplied by the caller.

## Install

```bash
bun add @opengamesonline/sevens
```

## Initialize a game

```ts
import {
  initializeSevens,
  SevensVariant,
} from "@opengamesonline/sevens";

const game = initializeSevens(
  ["alice", "bob", "carol"],
  SevensVariant.Standard,
);
```

`initializeSevens` accepts three to seven unique, non-empty player IDs. It creates and shuffles a standard 52-card deck, deals every card round-robin, and assigns the first turn to the player holding the seven of diamonds.

Inject a random source for deterministic simulations and tests:

```ts
const game = initializeSevens(
  ["alice", "bob", "carol"],
  SevensVariant.Standard,
  { random: () => 0.25 },
);
```

## Find playable cards

```ts
import { getPlayableCards } from "@opengamesonline/sevens";

const player = game.players.find(({ id }) => id === game.currentPlayerId)!;
const playableCards = getPlayableCards(game.board, player.hand, game.variant);
```

The standard variant requires the seven of diamonds as the opening card. After that play, a seven opens any other suit and cards can be placed immediately below the current minimum or above the current maximum for their suit.

## Validate a play

```ts
import { TurnActionType, validateTurn } from "@opengamesonline/sevens";

const nextGame = validateTurn(game, {
  type: TurnActionType.Play,
  playerId: game.currentPlayerId,
  card: playableCards[0]!,
});
```

`validateTurn` returns a new game object for a valid action and `null` for an invalid action. A play is valid only when it comes from the current player, the card is in that player's hand, and the variant marks it as playable.

## Validate a draw

When drawing, the player on the current player's right chooses a card from their own hand. In seating order, the player on the right is the previous player with wraparound. Selection and authorization of that choice happen outside this package; the selected card is included in the action.

```ts
const nextGame = validateTurn(game, {
  type: TurnActionType.Draw,
  playerId: game.currentPlayerId,
  fromPlayerId: "carol",
  card: selectedCard,
});
```

A draw is allowed even if the current player has a playable card. The package still verifies that the donor is the player on the right and owns the selected card. Drawing ends the current turn.

## State model

`SevensGameObject` contains:

- The selected `variant`.
- An `active` or `finished` status.
- Per-suit board bounds with `min` and `max` ranks.
- Players in seating order and every player's current hand.
- The current player ID.
- The winner ID after completion.

Cards use the `Suit` and `Rank` enums. Rank is numeric from `Rank.Ace` (`1`) through `Rank.King` (`13`), making board adjacency explicit while retaining enum names in TypeScript.

The first player whose hand becomes empty wins. This includes a player whose final card is taken by a draw. Finished games reject all subsequent actions.

## Variants

Game state stores a serializable `SevensVariant` value. `getVariantRules` resolves that value to a playable-card calculator. The MVP includes `SevensVariant.Standard`; future named variants can provide a different calculator without changing game state or turn orchestration.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
bun pm pack
```

## License

AGPL-3.0-only
