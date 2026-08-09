import assert from 'node:assert/strict';
import test from 'node:test';

import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  GameStatus,
  BotPlaystyle,
  JOKER_CARD,
  Rank,
  SevensVariant,
  Suit,
  TurnActionType,
  createEmptyBoard,
  isJokerCard,
  placeCard,
  type TurnAction,
} from '@opengamesonline/sevens';

import {
  createSevensParticipantMetadata,
  createSevensPolicy,
} from '../src/features/multiplayer/sevens-policy';
import { SEVENS_BOT_TURN_EVENT } from '../src/features/multiplayer/types';
import type {
  SevensGameState,
  SevensParticipantMetadata,
} from '../src/features/multiplayer/types';
import {
  isSevensLobbyMetadata,
  isTurnAction,
} from '../src/features/multiplayer/validation';

function participant(
  id: string,
  name: string,
  role: SevensParticipantMetadata['role'],
  slot: number,
): Participant<SevensParticipantMetadata> {
  return { id, name, slot, metadata: createSevensParticipantMetadata(role) };
}

const host = participant('host', 'Host', 'spectator', 0);
const alice = participant('alice', 'Alice', 'player', 1);
const bob = participant('bob', 'Bob', 'player', 2);
const carol = participant('carol', 'Carol', 'player', 3);

test('initializes from finalized player roles and excludes a spectator host', () => {
  const policy = createSevensPolicy({
    gameName: 'Table',
    participantName: host.name,
    role: 'spectator',
    maxPlayers: 4,
    showPlayableCards: false,
  });
  const game = policy.createInitialState([host, alice, bob, carol]);

  assert.deepEqual(
    game.players.map(({ id }) => id),
    ['alice', 'bob', 'carol'],
  );
  assert.equal(game.players.flatMap(({ hand }) => hand).length, 52);
  assert.equal(game.lastIllegalMovePlayerId, null);
});

test('computes role-aware lobby metadata and enforces lobby policy', () => {
  const policy = createSevensPolicy({
    gameName: 'Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
    showPlayableCards: true,
    variant: SevensVariant.Joker,
  });
  const participants = [alice, bob, carol, host];

  assert.deepEqual(policy.getLobbyMetadata(participants), {
    appId: 'com.opengamesonline.sevens',
    gameVersion: 2,
    playerCount: 3,
    spectatorCount: 1,
    minPlayers: 3,
    maxPlayers: 3,
    bots: [],
    showPlayableCards: true,
    variant: SevensVariant.Joker,
  });
  const jokerGame = policy.createInitialState(participants);
  assert.equal(jokerGame.players.flatMap(({ hand }) => hand).filter(isJokerCard).length, 1);
  assert.equal(jokerGame.players.flatMap(({ hand }) => hand).length, 53);
  assert.equal(
    isTurnAction(
      JSON.parse(JSON.stringify({ type: TurnActionType.GiveCard, card: JOKER_CARD })),
    ),
    true,
  );
  assert.match(
    policy.validateJoin?.(participant('duplicate', 'aLiCe', 'spectator', 4), participants) ?? '',
    /already in use/,
  );
  assert.match(
    policy.validateJoin?.(participant('dave', 'Dave', 'player', 4), participants) ?? '',
    /roster is full/,
  );
  assert.equal(
    policy.validateJoin?.(participant('watcher', 'Watcher', 'spectator', 4), participants),
    null,
  );
  assert.match(policy.validateStart?.([alice, bob]) ?? '', /At least 3/);
  assert.equal(policy.validateStart?.([alice, bob, carol]), null);
});

test('adds strategy-configured bots to lobby capacity and the initialized roster', () => {
  const policy = createSevensPolicy({
    gameName: 'Bot Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
    showPlayableCards: false,
  });

  const cautious = policy.addBot(BotPlaystyle.Cautious, [alice]);
  const random = policy.addBot(BotPlaystyle.Random, [alice]);
  const lobby = policy.getLobbyMetadata([alice]);

  assert.equal(lobby.playerCount, 3);
  assert.deepEqual(lobby.bots, [cautious, random]);
  assert.equal(isSevensLobbyMetadata(JSON.parse(JSON.stringify(lobby))), true);
  assert.equal(isSevensLobbyMetadata({ ...lobby, gameVersion: 1 }), false);
  assert.equal(
    isSevensLobbyMetadata({
      ...lobby,
      bots: [{ ...cautious, playstyle: 'unsupported' }],
    }),
    false,
  );
  assert.equal(policy.validateStart?.([alice]), null);
  assert.match(
    policy.validateJoin?.(participant('bob-2', 'Another player', 'player', 1), [alice]) ?? '',
    /roster is full/,
  );

  const game = policy.createInitialState([alice]);
  assert.deepEqual(game.bots, [cautious, random]);
  assert.deepEqual(game.players.map(({ id }) => id), [alice.id, cautious.id, random.id]);
  assert.equal(game.players.flatMap(({ hand }) => hand).length, 52);

  assert.equal(policy.removeBot(cautious.id), true);
  assert.equal(policy.getLobbyMetadata([alice]).playerCount, 2);
  assert.equal(policy.removeBot(cautious.id), false);
});

test('only accepts bot actions attributed to the host', () => {
  const policy = createSevensPolicy({
    gameName: 'Bot Table',
    participantName: host.name,
    role: 'spectator',
    maxPlayers: 3,
    showPlayableCards: false,
  });
  const bot = {
    id: 'sevens-bot-1',
    name: 'Bot 1',
    playstyle: BotPlaystyle.Random,
  };
  const openingCard = { suit: Suit.Spades, rank: Rank.Seven } as const;
  const game: SevensGameState = {
    variant: SevensVariant.Standard,
    status: GameStatus.Active,
    board: createEmptyBoard(),
    players: [
      { id: bot.id, hand: [openingCard, { suit: Suit.Clubs, rank: Rank.Two }] },
      { id: alice.id, hand: [{ suit: Suit.Hearts, rank: Rank.Seven }] },
      { id: bob.id, hand: [{ suit: Suit.Diamonds, rank: Rank.Seven }] },
    ],
    currentPlayerId: bot.id,
    pendingDraw: null,
    winnerId: null,
    lastIllegalMovePlayerId: null,
    bots: [bot],
  };
  const event = {
    type: SEVENS_BOT_TURN_EVENT,
    botId: bot.id,
    action: { type: TurnActionType.Play, card: openingCard },
  } as const;

  assert.equal(policy.reduceEvent(game, event, alice), game);
  const result = policy.reduceEvent(game, event, host);
  assert.deepEqual(result.board[Suit.Spades], { min: Rank.Seven, max: Rank.Seven });
  assert.deepEqual(result.bots, [bot]);
});

test('applies a serialized Joker bridge play through the host policy', () => {
  const policy = createSevensPolicy({
    gameName: 'Joker Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
    showPlayableCards: false,
    variant: SevensVariant.Joker,
  });
  const boardCards = [
    { suit: Suit.Spades, rank: Rank.Seven },
    { suit: Suit.Spades, rank: Rank.Eight },
    { suit: Suit.Spades, rank: Rank.Nine },
    { suit: Suit.Spades, rank: Rank.Ten },
    { suit: Suit.Hearts, rank: Rank.Seven },
    { suit: Suit.Hearts, rank: Rank.Eight },
  ] as const;
  const game: SevensGameState = {
    variant: SevensVariant.Joker,
    status: GameStatus.Active,
    board: boardCards.reduce(placeCard, createEmptyBoard()),
    players: [
      {
        id: alice.id,
        hand: [JOKER_CARD, { suit: Suit.Hearts, rank: Rank.Ten }],
      },
      {
        id: bob.id,
        hand: [
          { suit: Suit.Hearts, rank: Rank.Nine },
          { suit: Suit.Clubs, rank: Rank.Two },
        ],
      },
      { id: carol.id, hand: [{ suit: Suit.Diamonds, rank: Rank.Seven }] },
    ],
    currentPlayerId: alice.id,
    pendingDraw: null,
    winnerId: null,
    lastIllegalMovePlayerId: null,
    bots: [],
  };
  const serializedGame = JSON.parse(JSON.stringify(game)) as SevensGameState;
  const serializedAction = JSON.parse(
    JSON.stringify({
      type: TurnActionType.Play,
      card: { suit: Suit.Hearts, rank: Rank.Ten },
    }),
  ) as TurnAction;

  const result = policy.reduceEvent(serializedGame, serializedAction, alice);

  assert.deepEqual(result.board[Suit.Hearts], { min: Rank.Seven, max: Rank.Ten });
  assert.equal(result.players[0]!.hand.length, 0);
  assert.equal(result.players[1]!.hand.some(isJokerCard), true);
  assert.equal(result.winnerId, alice.id);
});

test('uses connection-bound actors for the two-step draw flow', () => {
  const policy = createSevensPolicy({
    gameName: 'Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
    showPlayableCards: false,
  });
  const participants = [alice, bob, carol];
  const game = policy.createInitialState(participants);
  const requester = participants.find(({ id }) => id === game.currentPlayerId)!;
  const requesterIndex = participants.findIndex(({ id }) => id === requester.id);
  const donor = participants[(requesterIndex - 1 + participants.length) % participants.length]!;
  const currentHand = game.players.find(({ id }) => id === requester.id)!.hand;
  const illegalOpeningCard = currentHand.find(
    (card) => !isJokerCard(card) && (card.suit !== 'spades' || card.rank !== 7),
  )!;

  const illegalAttempt = policy.reduceEvent(
    game,
    { type: TurnActionType.Play, card: illegalOpeningCard },
    requester,
  );
  assert.notEqual(illegalAttempt, game);
  assert.equal(illegalAttempt.lastIllegalMovePlayerId, requester.id);
  assert.equal(illegalAttempt.currentPlayerId, game.currentPlayerId);
  assert.deepEqual(illegalAttempt.board, game.board);
  assert.deepEqual(illegalAttempt.players, game.players);

  const pending = policy.reduceEvent(
    illegalAttempt,
    { type: TurnActionType.RequestDraw },
    requester,
  );
  assert.deepEqual(pending.pendingDraw, {
    requesterId: requester.id,
    donorId: donor.id,
  });
  assert.equal(pending.lastIllegalMovePlayerId, null);

  const donorCard = pending.players.find(({ id }) => id === donor.id)!.hand[0]!;
  const completed = policy.reduceEvent(
    pending,
    { type: TurnActionType.GiveCard, card: donorCard },
    donor,
  );
  assert.equal(completed.pendingDraw, null);
  assert.equal(
    completed.players.find(({ id }) => id === requester.id)!.hand.length,
    game.players.find(({ id }) => id === requester.id)!.hand.length + 1,
  );

  const spectatorAttempt = policy.reduceEvent(
    completed,
    { type: TurnActionType.Play, card: completed.players[0]!.hand[0]! },
    host,
  );
  assert.equal(spectatorAttempt, completed);

  const malformedAttempt = policy.reduceEvent(
    completed,
    { type: TurnActionType.Play } as TurnAction,
    requester,
  );
  assert.equal(malformedAttempt, completed);

  const finished = {
    ...completed,
    status: GameStatus.Finished,
    winnerId: completed.players[0]!.id,
  };
  const stalePlay = policy.reduceEvent(
    finished,
    { type: TurnActionType.Play, card: finished.players[0]!.hand[0]! },
    participants[0]!,
  );
  assert.equal(stalePlay, finished);
});
