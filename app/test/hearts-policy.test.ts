import assert from 'node:assert/strict';
import test from 'node:test';
import type { Participant, SessionRecoveryState } from '@opengamesonline/expo-lan-multiplayer';
import { BotPlaystyle, chooseHeartsBotAction, GameStatus, type HeartsAction } from '@opengamesonline/sevens';
import { createHeartsParticipantMetadata, createHeartsPolicy, type HeartsPolicy } from '../src/features/hearts/hearts-policy';
import { isHeartsAction, isHeartsGameState, isHeartsLobbyMetadata, isHeartsParticipantMetadata } from '../src/features/hearts/validation';
import type { HeartsGameEvent, HeartsGameState, HeartsLobbyMetadata, HeartsParticipantMetadata } from '../src/features/hearts/types';
import { createSevensParticipantMetadata, createSevensPolicy } from '../src/features/sevens/sevens-policy';
import { defineRoomGames, filterRooms, findRoomGame, GAME_INFO, GAME_TYPES, isGameType, roomDetail, roomGameType } from '../src/features/card-room/registry';
import { createRecoveryValidator } from '../src/features/card-room/recovery';

const participant = (id: string, role: 'player' | 'spectator', slot: number): Participant<HeartsParticipantMetadata> =>
  ({ id, name: id, slot, metadata: createHeartsParticipantMetadata(role) });
const host = participant('host', 'spectator', 0);
const players = ['a', 'b', 'c', 'd'].map((id, index) => participant(id, 'player', index + 1));
const roster = [host, ...players];
const makePolicy = () => createHeartsPolicy({ gameName: 'Hearts test', participantName: 'host', role: 'spectator' });
const lobby = (policy: HeartsPolicy) => policy.getLobbyMetadata(roster, new Set(roster.map((p) => p.id)));
function reduce(policy: HeartsPolicy, game: HeartsGameState, event: HeartsGameEvent, actor = host) {
  return policy.reduceEvent(game, event, actor, { authoritativeHost: actor.id === host.id });
}

test('Hearts requires four players, excludes spectators, permits spectators in full lobbies', () => {
  const policy = makePolicy();
  assert.match(policy.validateStart!(roster.slice(0, 4), new Set(roster.map((p) => p.id)))!, /exactly four/);
  assert.equal(policy.validateStart!(roster, new Set(roster.map((p) => p.id))), null);
  assert.match(policy.validateStart!(roster, new Set(['host', 'a', 'b', 'c']))!, /reconnect/);
  assert.match(policy.validateJoin!(participant('extra', 'player', 5), roster)!, /full/);
  assert.equal(policy.validateJoin!(participant('watcher', 'spectator', 5), roster), null);
  assert.match(policy.validateJoin!({ ...host, metadata: createSevensParticipantMetadata('player') as unknown as HeartsParticipantMetadata }, roster)!, /compatible/);
  const game = policy.createInitialState(roster);
  assert.deepEqual(game.players.map((p) => p.id), ['a', 'b', 'c', 'd']);
  assert.ok(isHeartsGameState(game));
  assert.ok(isHeartsLobbyMetadata(lobby(policy)));
});

test('human and bot events are bound to authorized actors', () => {
  const policy = makePolicy();
  const bot = policy.addBot(BotPlaystyle.Cautious, roster.slice(0, 4));
  const game = policy.createInitialState(roster.slice(0, 4));
  const action = chooseHeartsBotAction(game, bot.id, BotPlaystyle.Cautious)!;
  const event: HeartsGameEvent = { type: 'botTurn', botId: bot.id, action };
  assert.equal(reduce(policy, game, event, players[0]!), game);
  assert.equal(reduce(policy, game, action, host), game);
  assert.equal(reduce(policy, game, { ...event, botId: players[0]!.id }), game);
  const next = reduce(policy, game, event);
  assert.ok(next.passes[bot.id]);
  assert.ok(isHeartsGameState(next));
  assert.equal(reduce(policy, next, event), next);
  assert.throws(() => policy.addBot(BotPlaystyle.Random, roster.slice(0, 4)), /full/);
});

test('full match policy rejects client next-round requests and remains valid after JSON serialization', () => {
  const policy = makePolicy();
  let game = policy.createInitialState(roster);
  let rounds = 0;
  for (let steps = 0; steps < 10000 && game.status !== GameStatus.Finished; steps++) {
    if (game.phase === 'roundEnd') {
      rounds++;
      const before = game;
      assert.equal(reduce(policy, game, { type: 'nextRound' }, players[0]!), before);
      assert.equal(reduce(policy, game, { type: 'botTurn', botId: 'fake', action: { type: 'nextRound' } }), before);
      game = reduce(policy, game, { type: 'nextRound' });
      assert.equal(game.roundNumber, before.roundNumber + 1);
      assert.deepEqual(game.players.map((p) => p.score), before.players.map((p) => p.score));
      continue;
    }
    const id = game.phase === 'passing' ? game.players.find((p) => !game.passes[p.id])!.id : game.currentPlayerId;
    const action = chooseHeartsBotAction(game, id, BotPlaystyle.Cautious)!;
    game = JSON.parse(JSON.stringify(reduce(policy, game, action, players.find((p) => p.id === id)!)));
    assert.ok(isHeartsGameState(game), `invalid state at phase ${game.phase}`);
    assert.ok(isHeartsLobbyMetadata(lobby(policy)));
  }
  assert.ok(rounds > 0);
  assert.equal(game.phase, 'matchEnd');
  assert.deepEqual(lobby(policy).cumulativeScores.map((s) => s.points), game.players.map((p) => p.score));
  assert.equal(lobby(policy).roundsPlayed, game.roundNumber);
});

test('room registry identifies both games and rejects incompatible versions', () => {
  const hearts = lobby(makePolicy());
  const sevens = createSevensPolicy({ gameName: 'Sevens', participantName: 'A', role: 'player', maxPlayers: 4, showPlayableCards: false, preventIllegalDraw: false })
    .getLobbyMetadata([], new Set());
  assert.equal(roomGameType(hearts), 'hearts');
  assert.equal(roomGameType(sevens), 'sevens');
  assert.equal(roomGameType({ ...hearts, gameVersion: 999 }), null);
  assert.equal(roomGameType({ ...sevens, gameVersion: 999 }), null);
  assert.equal(roomGameType({ ...hearts, appId: 'com.example.other' }), null);
  assert.equal(roomGameType(null), null);
  assert.deepEqual(GAME_TYPES, ['sevens', 'hearts']);
  assert.equal(isGameType('hearts'), true);
  assert.equal(isGameType('unknown'), false);
  assert.match(roomDetail(sevens), /SEVENS/);
  assert.match(roomDetail(hearts), /HEARTS/);
  const rooms = [{ name: 'Family Sevens', lobbyMetadata: sevens }, { name: 'Family Hearts', lobbyMetadata: hearts }, { name: 'Other Hearts', lobbyMetadata: hearts }];
  assert.equal(filterRooms(rooms, 'all').length, 3);
  assert.deepEqual(filterRooms(rooms, 'hearts', ' FAMILY ').map((r) => r.name), ['Family Hearts']);
  assert.deepEqual(filterRooms(rooms, 'sevens', 'hearts'), []);
  assert.equal(rooms.length, 3);
});

test('room registry can identify an additional registered game without changing dispatch', () => {
  type OtherLobby = { appId: 'other'; gameVersion: 1 };
  const games = defineRoomGames({ ...GAME_INFO, other: {
    name: 'Other', mark: 'O', description: 'Another game', players: '2 players',
    isLobby: (value: unknown): value is OtherLobby => Boolean(value && typeof value === 'object' && 'appId' in value && value.appId === 'other' && 'gameVersion' in value && value.gameVersion === 1),
    roomDetail: (_lobby: OtherLobby) => 'OTHER',
    help: { summary: 'Test game', sections: [{ title: 'Rules', paragraphs: ['Play the game.'] }], variants: null },
  } });
  assert.equal(findRoomGame(games, { appId: 'other', gameVersion: 1 }), 'other');
  assert.equal(findRoomGame(games, { appId: 'other', gameVersion: 2 }), null);
});

test('malformed actions, duplicate cards, and invalid game snapshots are rejected', () => {
  for (const value of [null, {}, { type: 'pass', cards: [] }, { type: 'play', card: { kind: 'joker' } }, { type: 'play', card: { suit: 'spades', rank: 99 } }]) assert.equal(isHeartsAction(value), false);
  const game = makePolicy().createInitialState(roster);
  assert.equal(isHeartsGameState({ ...game, players: [game.players[0], ...game.players.slice(0, 3)] }), false);
  assert.equal(isHeartsGameState({ ...game, players: game.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, p.hand[0]] } : p) }), false);
  assert.equal(isHeartsGameState({ ...game, roundNumber: 2 }), false);
  assert.equal(isHeartsGameState({ ...game, phase: 'matchEnd', status: GameStatus.Finished }), false);
});

const validSaved = createRecoveryValidator({ isParticipant: isHeartsParticipantMetadata, isLobby: isHeartsLobbyMetadata, isState: isHeartsGameState,
  stateMatchesLobby: () => true });
function savedTable(policy: HeartsPolicy, game: HeartsGameState) {
  const recovery: SessionRecoveryState<HeartsGameState, HeartsParticipantMetadata, HeartsLobbyMetadata> = {
    name: 'Hearts test', tableId: 'table-1', authorityTerm: 1, hostParticipantId: host.id, hostOrder: roster.map((p) => p.id),
    resumeTokens: Object.fromEntries(roster.map((p) => [p.id, `${p.id}-resume-token-long-enough`])),
    participants: roster, connectedParticipantIds: roster.map((p) => p.id), state: game, revision: 1, phase: 'started', lobbyMetadata: lobby(policy),
  };
  return { selfParticipantId: 'a', recovery };
}
test('recovery validates game identity, roster, tokens, seats, and game state', () => {
  const policy = makePolicy();
  const saved = savedTable(policy, policy.createInitialState(roster));
  assert.ok(validSaved(saved));
  assert.equal(validSaved({ ...saved, selfParticipantId: 'unknown' }), false);
  assert.equal(validSaved({ ...saved, recovery: { ...saved.recovery, resumeTokens: {} } }), false);
  assert.equal(validSaved({ ...saved, recovery: { ...saved.recovery, hostOrder: ['a', 'a', 'b', 'c', 'd'] } }), false);
  assert.equal(validSaved({ ...saved, recovery: { ...saved.recovery, lobbyMetadata: { ...saved.recovery.lobbyMetadata, gameVersion: 999 } } }), false);
  assert.equal(validSaved({ ...saved, recovery: { ...saved.recovery, state: { ...saved.recovery.state, players: [] } } }), false);
  assert.equal(validSaved({ ...saved, recovery: { ...saved.recovery, participants: roster.map((p, i) => i === 0 ? { ...p, metadata: createSevensParticipantMetadata('spectator') } : p) } }), false);
});

test('a promoted Hearts host continues in-progress passing and scoring without resetting the match', () => {
  const original = makePolicy();
  let game = original.createInitialState(roster);
  const action = chooseHeartsBotAction(game, 'a', BotPlaystyle.Cautious) as HeartsAction;
  game = reduce(original, game, action, players[0]!);
  const saved = savedTable(original, game);
  const promoted = createHeartsPolicy({ gameName: saved.recovery.name, participantName: 'a', role: 'player',
    recovery: { lobbyMetadata: saved.recovery.lobbyMetadata, participants: saved.recovery.participants } });
  assert.ok(validSaved(JSON.parse(JSON.stringify(saved))));
  for (let i = 0; i < 100 && game.phase !== 'roundEnd'; i++) {
    const id = game.phase === 'passing' ? game.players.find((p) => !game.passes[p.id])!.id : game.currentPlayerId;
    const event = chooseHeartsBotAction(game, id, BotPlaystyle.Cautious)!;
    game = promoted.reduceEvent(game, event, players.find((p) => p.id === id)!, { authoritativeHost: id === 'a' });
  }
  assert.equal(game.phase, 'roundEnd');
  assert.ok(isHeartsGameState(game));
  const metadata = promoted.getLobbyMetadata(roster, new Set(roster.map((p) => p.id)));
  assert.deepEqual(metadata.cumulativeScores.map((s) => s.playerName), ['a', 'b', 'c', 'd']);
  assert.deepEqual(metadata.cumulativeScores.map((s) => s.points), game.players.map((p) => p.score));
});
