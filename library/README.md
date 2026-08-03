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

const nextGame = validateTurn(game, game.currentPlayerId, {
  type: TurnActionType.Play,
  card: playableCards[0]!,
});
```

`validateTurn` receives the acting player ID separately from the action. It returns a new game object for a valid action and `null` for an invalid action. A play is valid only when the actor is the current player, the card is in that player's hand, and the variant marks it as playable.

## Validate a draw

A draw has two actor-aware steps. The current player requests a draw, then the player on their right chooses and gives a card from their own hand. In seating order, the player on the right is the previous player with wraparound.

```ts
const pendingGame = validateTurn(game, game.currentPlayerId, {
  type: TurnActionType.RequestDraw,
});

const nextGame = validateTurn(pendingGame!, pendingGame!.pendingDraw!.donorId, {
  type: TurnActionType.GiveCard,
  card: selectedCard,
});
```

A draw request is allowed even if the current player has a playable card. While it is pending, plays and new draw requests are rejected. Only the derived donor can give a card, and that card must be in the donor's hand. Giving transfers the card to the requester, clears the pending draw, and advances from the requester to the next seat.

## State model

`SevensGameObject` contains:

- The selected `variant`.
- An `active` or `finished` status.
- Per-suit board bounds with `min` and `max` ranks.
- Players in seating order and every player's current hand.
- The current player ID.
- A pending draw with requester and donor IDs, or `null`.
- The winner ID after completion.

Cards use the `Suit` and `Rank` enums. Rank is numeric from `Rank.Ace` (`1`) through `Rank.King` (`13`), making board adjacency explicit while retaining enum names in TypeScript.

The first player whose hand becomes empty wins. This includes a donor who gives their final card. Finished games reject all subsequent actions.

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
