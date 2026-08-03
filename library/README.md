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

`initializeSevens` accepts three to seven unique, non-empty player IDs. It creates the selected variant's deck, shuffles and deals every card round-robin, and assigns the first turn to the player holding the seven of spades. `SevensVariant.Standard` uses the standard 52-card deck. `SevensVariant.Joker` adds one Joker for 53 cards total.

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

The standard variant requires the seven of spades as the opening card. Spades then extend normally by placing a card immediately below the current minimum or above the current maximum. Once the seven of spades is down, rank-seven cards can open the other suits. Every other non-spade card requires both normal adjacency in its own suit and the spade of the same rank to be on the board. For example, the six of hearts requires the six of spades to be within the current contiguous spade run and the six to be adjacent to the current hearts run.

For the Joker variant, pass player context to include assisted plays that depend on cards in other hands:

```ts
const playableCards = getPlayableCards(game.board, player.hand, game.variant, {
  playerId: player.id,
  players: game.players,
});
```

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

`Card` is a `StandardCard | JokerCard` union. Standard cards retain the serializable `{ suit, rank }` shape and use the `Suit` and `Rank` enums. Rank is numeric from `Rank.Ace` (`1`) through `Rank.King` (`13`). The canonical frozen `JOKER_CARD` has the shape `{ kind: "joker" }`; use `isJokerCard(card)` to narrow the union. `cardEquals` supports both card types. The exported `createDeck()` continues to create only the standard 52-card deck.

The first player whose hand becomes empty wins. This includes a donor who gives their final card. Finished games reject all subsequent actions.

## Final scores

```ts
import { createFinalScores } from "@opengamesonline/sevens";

const scores = createFinalScores(finishedGame);
```

`createFinalScores` returns one score for every player in seating order and rejects games that are still active. Each remaining card from two through nine is worth 5 points, tens and face cards are worth 10 points, aces are worth 15 points, and the Joker is worth 0 points. The winner therefore scores 0.

## Variants

Game state stores a serializable `SevensVariant` value: `standard` or `joker`. `getVariantRules` resolves it through the variant factory registry to frozen rules that own deck construction, playable-card calculation, and play resolution. Unsupported values throw `RangeError`.

The Joker variant follows all standard rules, including the mandatory seven-of-spades opening and matching-spade gate. The Joker itself can never be played onto the board. A player holding only the Joker has no playable cards and can request a draw normally.

After the opening, the Joker can assist one atomic play. The actor must hold the Joker and a selected standard card exactly one rank beyond a bridge card of the same suit. The bridge must be currently playable under standard rules and held by another player; the selected card must be standard-playable after hypothetically placing the bridge. Playing the selected card removes it and the Joker from the actor, removes the bridge from its holder, places the bridge and selected card in that order, and gives the Joker to the bridge holder. If the actor holds the bridge, or either card fails the matching-spade gate, assistance is invalid. Normal plays never consume or transfer the Joker.

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
