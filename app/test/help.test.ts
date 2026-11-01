import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GameStatus, JOKER_CARD, Rank, SevensVariant, Suit, TurnActionType, cardEquals, createEmptyBoard, createFinalScores,
  getHeartsPlayableCards, getPlayableCards, heartsTrickWinner, initializeHearts, initializeSevens, isJokerCard, passDirection,
  penaltyPoints, placeCard, playHeartsCard, validateTurn,
  type Card,
} from '@opengamesonline/sevens';
import { defineRoomGame, GAME_INFO, GAME_TYPES } from '../src/features/card-room/registry';
import type { HelpSection } from '../src/features/card-room/help-types';
import { heartsHelp } from '../src/features/hearts/help';
import { sevensHelp } from '../src/features/sevens/help';

function exampleIn(sections: readonly HelpSection[], sectionTitle: string, exampleTitle: string) {
  const example = sections.find((section) => section.title === sectionTitle)?.examples?.find((item) => item.title === exampleTitle);
  assert.ok(example, `Missing example: ${sectionTitle} / ${exampleTitle}`);
  return example;
}

function heartsCards(cards: readonly Card[]) {
  return cards.map((card) => {
    if (isJokerCard(card)) assert.fail('Hearts examples must not contain a Joker');
    return card;
  });
}

test('every registered game has help and every Sevens variant has its own guide', () => {
  for (const id of GAME_TYPES) {
    const help = GAME_INFO[id].help;
    assert.ok(help.summary.trim());
    assert.ok(help.sections.length > 0);
    assert.ok(help.sections.every((section) => section.title.trim() && section.paragraphs.length > 0));
    assert.ok(help.sections.some((section) => section.examples?.length));
  }
  assert.deepEqual(Object.keys(sevensHelp.variants).sort(), Object.values(SevensVariant).sort());
  assert.ok(Object.values(sevensHelp.variants).every((variant) => variant.sections.length > 0));
  assert.equal(heartsHelp.variants, null);
});

test('illustrated Sevens standard moves obey both suit adjacency and the spade gate', () => {
  const example = exampleIn(sevensHelp.sections, 'Where cards go', 'Playing a heart');
  const board = [...example.rows[0]!.cards, ...example.rows[1]!.cards].reduce(placeCard, createEmptyBoard());
  const candidates = example.rows[2]!.cards;
  assert.deepEqual(getPlayableCards(board, candidates, SevensVariant.Standard), candidates);
  assert.deepEqual(getPlayableCards(board, [{ suit: Suit.Hearts, rank: Rank.Nine }], SevensVariant.Standard), []);
});

test('the Sevens think-ahead example makes the heart playable after the spade', () => {
  const example = exampleIn(sevensHelp.sections, 'Choosing a card', 'Think ahead');
  const board = example.rows[0]!.cards.reduce(placeCard, createEmptyBoard());
  const [spade, heart] = example.rows[1]!.cards;
  assert.ok(spade && heart);
  assert.deepEqual(getPlayableCards(board, [spade, heart], SevensVariant.Standard), [spade]);
  assert.deepEqual(getPlayableCards(placeCard(board, spade), [heart], SevensVariant.Standard), [heart]);
});

test('drawing from a player with one card lets that player win', () => {
  const game = initializeSevens(['you', 'next', 'right'], SevensVariant.Standard, { random: () => 0.3 });
  const yourCard = { suit: Suit.Spades, rank: Rank.Seven } as const;
  const lastCard = { suit: Suit.Clubs, rank: Rank.Ace } as const;
  const positioned = { ...game, currentPlayerId: 'you', players: [
    { id: 'you', hand: [yourCard] }, { id: 'next', hand: [{ suit: Suit.Clubs, rank: Rank.Two }] }, { id: 'right', hand: [lastCard] },
  ] };
  const requested = validateTurn(positioned, 'you', { type: TurnActionType.RequestDraw });
  assert.ok(requested);
  const result = validateTurn(requested, 'right', { type: TurnActionType.GiveCard, card: lastCard });
  assert.equal(result?.status, GameStatus.Finished);
  assert.equal(result?.winnerId, 'right');
});

test('both illustrated Joker bridges are legal and transfer the Joker to the bridge holder', () => {
  const examples = sevensHelp.variants[SevensVariant.Joker].sections[0].examples;
  for (const example of examples) {
    const board = example.rows[0]!.cards.reduce(placeCard, createEmptyBoard());
    const otherHand = example.rows[1]!.cards;
    const ownHand = example.rows[2]!.cards;
    const target = ownHand.find((card) => cardEquals(card, { suit: Suit.Hearts, rank: Rank.Nine }))!;
    const game = { ...initializeSevens(['you', 'other', 'third'], SevensVariant.Joker, { random: () => 0.3 }), board,
      currentPlayerId: 'you', players: [{ id: 'you', hand: ownHand }, { id: 'other', hand: otherHand }, { id: 'third', hand: [] as Card[] }] };
    assert.ok(getPlayableCards(board, ownHand, SevensVariant.Joker, { playerId: 'you', players: game.players }).some((card) => cardEquals(card, target)));
    const next = validateTurn(game, 'you', { type: TurnActionType.Play, card: target });
    assert.ok(next, example.title);
    assert.ok(next.players.find((player) => player.id === 'other')!.hand.some((card) => cardEquals(card, JOKER_CARD)));
    assert.equal(next.board[Suit.Hearts].max, Rank.Nine);
  }
});

test('illustrated Hearts trick and penalty score match the engine', () => {
  const trickCards = heartsCards(exampleIn(heartsHelp.sections, 'Playing your cards', 'Who takes these cards?').rows[0]!.cards);
  assert.equal(heartsTrickWinner(trickCards.map((card, index) => ({ playerId: String(index), card }))), '1');
  const scoringCards = heartsCards(exampleIn(heartsHelp.sections, 'Scoring and winning', 'Counting points').rows[0]!.cards);
  assert.equal(scoringCards.reduce((sum, card) => sum + penaltyPoints(card), 0), 15);
});

test('the Hearts passing example shows why the queen and high cards can be risky', () => {
  const cards = heartsCards(exampleIn(heartsHelp.sections, 'Choosing cards to pass', 'Cards you might pass').rows[0]!.cards);
  const [queen, king, ace] = cards;
  assert.ok(queen && king && ace);
  assert.equal(penaltyPoints(queen), 13);
  assert.equal(heartsTrickWinner([{ playerId: 'queen', card: queen }, { playerId: 'king', card: king }]), 'king');
  assert.equal(heartsTrickWinner([{ playerId: 'low', card: { suit: Suit.Hearts, rank: Rank.Two } }, { playerId: 'ace', card: ace }]), 'ace');
});

test('Hearts passing and first-trick restrictions match the guide', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(passDirection), ['left', 'right', 'across', 'hold', 'left']);
  const hearts = { suit: Suit.Hearts, rank: Rank.Three } as const;
  const queen = { suit: Suit.Spades, rank: Rank.Queen } as const;
  const diamond = { suit: Suit.Diamonds, rank: Rank.Four } as const;
  const base = initializeHearts(['a', 'b', 'c', 'd'], { random: () => 0.3 });
  const game = { ...base, phase: 'playing' as const, currentPlayerId: 'a',
    trick: [{ playerId: 'd', card: { suit: Suit.Clubs, rank: Rank.Two } }],
    players: base.players.map((player) => player.id === 'a' ? { ...player, hand: [hearts, queen, diamond] } : player) };
  assert.deepEqual(getHeartsPlayableCards(game, 'a'), [diamond]);
  const forced = { ...game, players: game.players.map((player) => player.id === 'a' ? { ...player, hand: [hearts, queen] } : player) };
  assert.deepEqual(getHeartsPlayableCards(forced, 'a'), [hearts, queen]);
  const later = { ...forced, tricksPlayed: 1 };
  assert.equal(playHeartsCard(later, 'a', queen)?.heartsBroken, false);
  assert.equal(playHeartsCard(later, 'a', hearts)?.heartsBroken, true);
});

test('Sevens card values match the guide', () => {
  const game = initializeSevens(['winner', 'other', 'third'], SevensVariant.Joker, { random: () => 0.3 });
  const cards = [Rank.Two, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace]
    .map((rank) => ({ suit: Suit.Clubs, rank }));
  const finished = { ...game, status: GameStatus.Finished, winnerId: 'winner',
    players: [{ id: 'winner', hand: [] }, { id: 'other', hand: [...cards, JOKER_CARD] }, { id: 'third', hand: [] }] };
  assert.deepEqual(createFinalScores(finished).map((entry) => entry.score), [0, 65, 0]);
});

// Compile-time contract: adding a creation variant without its help must fail.
if (false) {
  const incomplete = {
    name: 'Test', mark: 'T', description: 'Test', players: '2',
    isLobby: (value: unknown): value is { id: string } => typeof value === 'object' && value !== null && 'id' in value,
    roomDetail: () => 'Test', help: { summary: 'Test', sections: [{ title: 'Rules', paragraphs: ['Play.'] }] as const,
      variants: { standard: { label: 'Standard', description: 'Standard', sections: [{ title: 'Standard', paragraphs: ['Play.'] }] as const } } },
  };
  // @ts-expect-error The new variant is missing its required help entry.
  defineRoomGame<{ id: string }, { variant: 'standard' | 'new' }>(incomplete);
}
