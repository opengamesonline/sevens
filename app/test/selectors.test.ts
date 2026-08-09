import assert from 'node:assert/strict';
import test from 'node:test';

import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  JOKER_CARD,
  Rank,
  SevensVariant,
  Suit,
  createEmptyBoard,
  initializeSevens,
  placeCard,
} from '@opengamesonline/sevens';

import {
  selectOpponents,
  selectOwnHand,
  selectPlayableCards,
  selectSuitRuns,
} from '../src/features/multiplayer/selectors';
import {
  createSevensParticipantMetadata,
} from '../src/features/multiplayer/sevens-policy';
import {
  canAttemptPlay,
  illegalMoveMessage,
  shouldPresentCardAsPlayable,
  sortFinalScores,
} from '../src/features/multiplayer/presentation';
import type {
  SevensParticipantMetadata,
  SevensSessionSnapshot,
} from '../src/features/multiplayer/types';

const participants: Participant<SevensParticipantMetadata>[] = [
  { id: 'alice', name: 'Alice', slot: 0, metadata: createSevensParticipantMetadata('player') },
  { id: 'bob', name: 'Bob', slot: 1, metadata: createSevensParticipantMetadata('player') },
  { id: 'carol', name: 'Carol', slot: 2, metadata: createSevensParticipantMetadata('player') },
  { id: 'watcher', name: 'Watcher', slot: 3, metadata: createSevensParticipantMetadata('spectator') },
];
const game = {
  ...initializeSevens(['alice', 'bob', 'carol'], SevensVariant.Standard, {
    random: () => 0.2,
  }),
  lastIllegalMovePlayerId: null,
  bots: [],
};

function snapshot(selfIndex: number): SevensSessionSnapshot {
  return {
    role: selfIndex === 0 ? 'host' : 'client',
    status: 'connected',
    phase: 'started',
    state: game,
    revision: 1,
    self: participants[selfIndex]!,
    participants,
    lobbyMetadata: {
      appId: 'com.opengamesonline.sevens',
      gameVersion: 2,
      playerCount: 3,
      spectatorCount: 1,
      minPlayers: 3,
      maxPlayers: 4,
      bots: [],
      showPlayableCards: false,
      variant: SevensVariant.Standard,
    },
    error: null,
  };
}

test('player selector exposes only the local hand and opponent counts', () => {
  const playerSnapshot = snapshot(0);
  const ownHand = selectOwnHand(playerSnapshot);
  const opponents = selectOpponents(playerSnapshot);

  assert.equal(ownHand?.length, game.players[0]!.hand.length);
  assert.deepEqual(
    opponents.map(({ name, cardCount }) => ({ name, cardCount })),
    game.players.slice(1).map(({ id, hand }) => ({
      name: participants.find((participant) => participant.id === id)!.name,
      cardCount: hand.length,
    })),
  );
});

test('spectator selector exposes no hand and counts every seated player', () => {
  const spectatorSnapshot = snapshot(3);

  assert.equal(selectOwnHand(spectatorSnapshot), null);
  assert.equal(selectOpponents(spectatorSnapshot).length, 3);
  const suitRuns = selectSuitRuns(spectatorSnapshot);
  assert.deepEqual(
    suitRuns.map(({ suit }) => suit),
    ['spades', 'diamonds', 'clubs', 'hearts'],
  );
  assert.equal(suitRuns.every(({ cards }) => cards.length === 0), true);
});

test('selectors include bot names without exposing a bot as the local hand', () => {
  const bot = {
    id: 'sevens-bot-1',
    name: 'Bot 1',
    playstyle: BotPlaystyle.Cautious,
  };
  const botSnapshot: SevensSessionSnapshot = {
    ...snapshot(0),
    state: {
      ...game,
      players: [game.players[0]!, game.players[1]!, { id: bot.id, hand: game.players[2]!.hand }],
      bots: [bot],
    },
    lobbyMetadata: {
      ...snapshot(0).lobbyMetadata!,
      bots: [bot],
    },
  };

  assert.equal(selectOwnHand(botSnapshot)?.length, game.players[0]!.hand.length);
  assert.equal(selectOpponents(botSnapshot).find(({ id }) => id === bot.id)?.name, 'Bot 1');
});

test('hidden hints allow an illegal play attempt without revealing the card', () => {
  const card = game.players[0]!.hand[0]!;

  assert.equal(shouldPresentCardAsPlayable(false, false, false), true);
  assert.equal(shouldPresentCardAsPlayable(true, false, false), false);
  assert.equal(canAttemptPlay(card, false), true);
  assert.equal(illegalMoveMessage('Alice'), 'Alice tried to play an illegal move.');
});

test('Joker selector includes a bridge play held by another player', () => {
  const cards = [
    { suit: Suit.Spades, rank: Rank.Seven },
    { suit: Suit.Spades, rank: Rank.Eight },
    { suit: Suit.Spades, rank: Rank.Nine },
    { suit: Suit.Spades, rank: Rank.Ten },
    { suit: Suit.Hearts, rank: Rank.Seven },
    { suit: Suit.Hearts, rank: Rank.Eight },
  ] as const;
  const board = cards.reduce(placeCard, createEmptyBoard());
  const tenOfHearts = { suit: Suit.Hearts, rank: Rank.Ten } as const;
  const jokerSnapshot: SevensSessionSnapshot = {
    ...snapshot(0),
    state: {
      ...game,
      variant: SevensVariant.Joker,
      board,
      currentPlayerId: 'alice',
      players: [
        { id: 'alice', hand: [JOKER_CARD, tenOfHearts] },
        { id: 'bob', hand: [{ suit: Suit.Hearts, rank: Rank.Nine }] },
        { id: 'carol', hand: [{ suit: Suit.Clubs, rank: Rank.Two }] },
      ],
    },
    lobbyMetadata: {
      ...snapshot(0).lobbyMetadata!,
      variant: SevensVariant.Joker,
    },
  };

  assert.deepEqual(selectPlayableCards(jokerSnapshot), [tenOfHearts]);
});

test('results rank the winner first when a remaining Joker creates a zero-point tie', () => {
  const scores = [
    { playerId: 'bob', score: 0 },
    { playerId: 'alice', score: 0 },
    { playerId: 'carol', score: 10 },
  ];

  assert.deepEqual(sortFinalScores(scores, 'alice'), [
    { playerId: 'alice', score: 0 },
    { playerId: 'bob', score: 0 },
    { playerId: 'carol', score: 10 },
  ]);
});
