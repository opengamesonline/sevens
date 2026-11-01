import assert from 'node:assert/strict';
import test from 'node:test';

import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  GameStatus,
  JOKER_CARD,
  Rank,
  SevensVariant,
  Suit,
  TurnActionType,
  createEmptyBoard,
  initializeSevens,
  placeCard,
  validateTurn,
} from '@opengamesonline/sevens';

import {
  selectHostSuccessor,
  selectMissingLeaverId,
  selectOpponents,
  selectOwnHand,
  selectPlayableCards,
  selectSuitRuns,
  selectTablePlayers,
} from '../src/features/sevens/selectors';
import {
  createSevensParticipantMetadata,
} from '../src/features/sevens/sevens-policy';
import {
  canAttemptPlay,
  illegalMoveMessage,
  shouldPresentCardAsPlayable,
  sortFinalScores,
} from '../src/features/sevens/presentation';
import type {
  SevensParticipantMetadata,
  SevensSessionSnapshot,
} from '../src/features/sevens/types';
import {
  canSelectHandCard, createCardSelection, createGiveSelection, reconcileCardSelection, reconcileGiveSelection,
} from '../src/features/sevens/card-selection';

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
  roundNumber: 1,
  latestScores: [],
  cumulativeScores: [],
  moveLog: [],
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
      gameVersion: 4,
      playerCount: 3,
      spectatorCount: 1,
      minPlayers: 3,
      maxPlayers: 4,
      bots: [],
      roundsPlayed: 0,
      latestScores: [],
      cumulativeScores: [],
      showPlayableCards: false,
      preventIllegalDraw: false,
      variant: SevensVariant.Standard,
    },
    error: null,
    tableId: 'table-123456',
    authorityTerm: 1,
    hostParticipantId: participants[0]!.id,
    hostOrder: participants.map(({ id }) => id),
    connectedParticipantIds: participants.map(({ id }) => id),
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

test('table strip includes the local player, current turn and disconnected seats', () => {
  const current = snapshot(0);
  const players = selectTablePlayers({ ...current, connectedParticipantIds: ['alice', 'carol', 'watcher'] });
  assert.equal(players.length, 3);
  assert.equal(players.find((player) => player.id === 'alice')!.isSelf, true);
  assert.equal(players.find((player) => player.id === game.currentPlayerId)!.isCurrentPlayer, true);
  assert.equal(players.find((player) => player.id === 'bob')!.offline, true);
  assert.ok(selectTablePlayers(snapshot(3)).every((player) => !player.isSelf));
  assert.ok(players.every((player) => !('hand' in player)));
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

test('playable-card hints stay visible when it is not your turn', () => {
  const tenOfHearts = { suit: Suit.Hearts, rank: Rank.Ten } as const;
  const cards = [
    { suit: Suit.Spades, rank: Rank.Seven },
    { suit: Suit.Spades, rank: Rank.Eight },
    { suit: Suit.Spades, rank: Rank.Nine },
    { suit: Suit.Spades, rank: Rank.Ten },
    { suit: Suit.Hearts, rank: Rank.Seven },
    { suit: Suit.Hearts, rank: Rank.Eight },
  ] as const;
  const board = cards.reduce(placeCard, createEmptyBoard());
  const waitingSnapshot: SevensSessionSnapshot = {
    ...snapshot(0),
    state: {
      ...game,
      variant: SevensVariant.Joker,
      board,
      currentPlayerId: 'bob',
      pendingDraw: null,
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

  assert.deepEqual(selectPlayableCards(waitingSnapshot), [tenOfHearts]);

  const drawingSnapshot: SevensSessionSnapshot = {
    ...waitingSnapshot,
    state: {
      ...waitingSnapshot.state!,
      pendingDraw: { requesterId: 'bob', donorId: 'carol' },
    },
  };

  assert.deepEqual(selectPlayableCards(drawingSnapshot), [tenOfHearts]);
});

test('a card can be preselected before it is playable and remains selected when the turn changes', () => {
  const sevenSpades = { suit: Suit.Spades, rank: Rank.Seven } as const;
  const eightSpades = { suit: Suit.Spades, rank: Rank.Eight } as const;
  const sevenHearts = { suit: Suit.Hearts, rank: Rank.Seven } as const;
  const eightHearts = { suit: Suit.Hearts, rank: Rank.Eight } as const;
  const board = [sevenSpades, sevenHearts].reduce(placeCard, createEmptyBoard());
  const waiting: SevensSessionSnapshot = { ...snapshot(0), state: { ...game, board, currentPlayerId: 'bob', players: [
    { id: 'bob', hand: [eightSpades, { suit: Suit.Clubs, rank: Rank.Two }] },
    { id: 'alice', hand: [eightHearts] },
    { id: 'carol', hand: [{ suit: Suit.Diamonds, rank: Rank.Two }] },
  ] } };
  assert.equal(canSelectHandCard(waiting, false), true);
  assert.equal(canSelectHandCard(waiting, true), false);
  assert.deepEqual(selectPlayableCards(waiting), []);
  const selection = createCardSelection(waiting, eightHearts);
  assert.ok(selection);
  assert.equal(validateTurn(waiting.state!, 'alice', { type: TurnActionType.Play, card: eightHearts }), null);

  const nextGame = validateTurn(waiting.state!, 'bob', { type: TurnActionType.Play, card: eightSpades });
  assert.ok(nextGame);
  const yourTurn: SevensSessionSnapshot = { ...waiting, revision: waiting.revision + 1, state: { ...waiting.state!, ...nextGame } };
  assert.equal(yourTurn.state?.currentPlayerId, 'alice');
  assert.deepEqual(selectPlayableCards(yourTurn), [eightHearts]);
  assert.equal(reconcileCardSelection(selection, yourTurn), selection);
  assert.ok(validateTurn(yourTurn.state!, 'alice', { type: TurnActionType.Play, card: eightHearts }));
});

test('preselection is cleared when the card, player, table or round changes', () => {
  const current = snapshot(0);
  const card = current.state!.players[0]!.hand[0]!;
  const selection = createCardSelection(current, card);
  assert.ok(selection);
  assert.equal(createCardSelection(snapshot(3), card), null);
  assert.equal(canSelectHandCard(snapshot(3), false), false);
  assert.equal(createCardSelection(current, current.state!.players[1]!.hand[0]!), null);

  const withoutCard = { ...current, revision: current.revision + 1, state: { ...current.state!, players: current.state!.players.map((player) =>
    player.id === 'alice' ? { ...player, hand: player.hand.slice(1) } : player) } };
  const cleared = reconcileCardSelection(selection, withoutCard);
  assert.equal(cleared, null);
  assert.equal(reconcileCardSelection(cleared, current), null);
  assert.equal(reconcileCardSelection(selection, { ...current, tableId: 'another-table' }), null);
  assert.equal(reconcileCardSelection(selection, { ...current, state: { ...current.state!, roundNumber: 2 } }), null);
  assert.equal(reconcileCardSelection(selection, { ...current, state: { ...current.state!, status: GameStatus.Finished } }), null);
  assert.equal(reconcileCardSelection(selection, { ...current, self: participants[3]! }), null);
});

test('a preselected play does not choose a card to give during a draw', () => {
  const current = snapshot(0);
  const [first, second] = current.state!.players[0]!.hand;
  assert.ok(first && second);
  const playSelection = createCardSelection(current, first);
  assert.ok(playSelection);
  assert.equal(createGiveSelection(current, first), null);
  const draw: SevensSessionSnapshot = { ...current, revision: current.revision + 1,
    state: { ...current.state!, pendingDraw: { requesterId: 'bob', donorId: 'alice' } } };
  assert.equal(reconcileCardSelection(playSelection, draw), playSelection);
  assert.equal(reconcileGiveSelection(null, draw), null);
  assert.equal(canSelectHandCard(draw, false), true);
  const giveSelection = createGiveSelection(draw, second);
  assert.ok(giveSelection);
  assert.equal(reconcileGiveSelection(giveSelection, { ...draw, revision: draw.revision + 1 }), giveSelection);
  assert.equal(reconcileGiveSelection(giveSelection, current), null);
  assert.equal(reconcileGiveSelection(giveSelection, { ...draw, state: { ...draw.state!,
    pendingDraw: { requesterId: 'carol', donorId: 'alice' } } }), null);
  assert.equal(reconcileCardSelection(playSelection, current), playSelection);
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

test('opponents show a label instead of a session id for departed players', () => {
  const departedSnapshot: SevensSessionSnapshot = {
    ...snapshot(0),
    participants: participants.filter(({ id }) => id !== 'carol'),
    connectedParticipantIds: ['alice', 'bob', 'watcher'],
  };

  assert.deepEqual(
    selectOpponents(departedSnapshot).map(({ name }) => name),
    ['Bob', 'Left table'],
  );
});

test('missing leaver is reported only for departed roster players mid-game', () => {
  assert.equal(selectMissingLeaverId(snapshot(0)), null);

  const departed = {
    ...snapshot(0),
    participants: participants.filter(({ id }) => id !== 'carol'),
  };
  assert.equal(selectMissingLeaverId(departed), 'carol');

  const disconnected = {
    ...snapshot(0),
    connectedParticipantIds: ['alice', 'bob', 'watcher'],
  };
  assert.equal(selectMissingLeaverId(disconnected), null);

  const finished = {
    ...departed,
    state: { ...departed.state!, status: GameStatus.Finished },
  };
  assert.equal(selectMissingLeaverId(finished), null);

  const withBot = {
    ...snapshot(0),
    state: {
      ...game,
      players: [game.players[0]!, game.players[1]!, { id: 'sevens-bot-1', hand: [] }],
      bots: [{ id: 'sevens-bot-1', name: 'Bot 1', playstyle: BotPlaystyle.Cautious }],
    },
  };
  assert.equal(selectMissingLeaverId(withBot), null);
  assert.equal(selectMissingLeaverId(null), null);
});

test('host successor follows rotation order after the current host', () => {
  assert.deepEqual(selectHostSuccessor(snapshot(0)), { id: 'bob', name: 'Bob' });

  const skipped = {
    ...snapshot(0),
    connectedParticipantIds: ['alice', 'carol', 'watcher'],
  };
  assert.deepEqual(selectHostSuccessor(skipped), { id: 'carol', name: 'Carol' });

  const wrapped = {
    ...snapshot(0),
    hostParticipantId: 'watcher',
  };
  assert.deepEqual(selectHostSuccessor(wrapped), { id: 'alice', name: 'Alice' });

  const alone = {
    ...snapshot(0),
    connectedParticipantIds: ['alice'],
  };
  assert.equal(selectHostSuccessor(alone), null);
  assert.equal(selectHostSuccessor(null), null);
});
