import assert from 'node:assert/strict';
import test from 'node:test';
import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import { BotPlaystyle, initializeHearts } from '@opengamesonline/sevens';
import { createHeartsParticipantMetadata, createHeartsPolicy } from '../src/features/hearts/hearts-policy';
import { selectHeartsPlayers } from '../src/features/hearts/selectors';
import type { HeartsParticipantMetadata, HeartsSessionSnapshot } from '../src/features/hearts/types';

const participants: Participant<HeartsParticipantMetadata>[] = [
  { id: 'alice', name: 'Alice', slot: 0, metadata: createHeartsParticipantMetadata('player') },
  { id: 'bob', name: 'Bob', slot: 1, metadata: createHeartsParticipantMetadata('player') },
  { id: 'carol', name: 'Carol', slot: 2, metadata: createHeartsParticipantMetadata('player') },
  { id: 'watcher', name: 'Watcher', slot: 3, metadata: createHeartsParticipantMetadata('spectator') },
];
const bot = { id: 'bot', name: 'Bot', playstyle: BotPlaystyle.Cautious };
const game = { ...initializeHearts(['alice', 'bob', 'carol', 'bot'], { random: () => 0.2 }), bots: [bot] };
const policy = createHeartsPolicy({ gameName: 'Hearts', participantName: 'Alice', role: 'player' });
const snapshot: HeartsSessionSnapshot = {
  role: 'host', status: 'connected', phase: 'started', state: game, revision: 1,
  self: participants[0]!, participants,
  lobbyMetadata: policy.getLobbyMetadata(participants, new Set(participants.map((p) => p.id))),
  error: null, tableId: 'table-123456', authorityTerm: 1, hostParticipantId: 'alice',
  hostOrder: participants.map((p) => p.id), connectedParticipantIds: participants.map((p) => p.id),
};

test('passing strip shows readiness, never an active turn or private cards', () => {
  const state = { ...game, passes: { alice: game.players[0]!.hand.slice(0, 3) } };
  const seats = selectHeartsPlayers({ ...snapshot, state });
  assert.equal(seats.length, 4);
  assert.equal(seats[0]!.detail, 'Submitted · 0 pts');
  assert.equal(seats[1]!.detail, 'Waiting · 0 pts');
  assert.ok(seats.every((seat) => !seat.isCurrentPlayer && seat.cardCount === 13 && !('hand' in seat)));
  assert.equal(seats[0]!.isSelf, true);
  assert.equal(seats[3]!.name, 'Bot');
  assert.equal(seats[3]!.offline, false);
});

test('playing and spectator views show the actual turn, scores and disconnected seats', () => {
  const state = { ...game, phase: 'playing' as const, currentPlayerId: 'bob',
    players: game.players.map((player) => player.id === 'alice' ? { ...player, hand: player.hand.slice(1), score: 4 } : player) };
  const seats = selectHeartsPlayers({ ...snapshot, state, self: participants[3]!,
    connectedParticipantIds: ['alice', 'carol', 'watcher'] });
  assert.equal(seats.find((seat) => seat.id === 'alice')!.cardCount, 12);
  assert.equal(seats.find((seat) => seat.id === 'alice')!.detail, '4 pts');
  assert.equal(seats.find((seat) => seat.id === 'bob')!.isCurrentPlayer, true);
  assert.equal(seats.find((seat) => seat.id === 'bob')!.offline, true);
  assert.ok(seats.every((seat) => !seat.isSelf));
  assert.equal(seats.find((seat) => seat.id === 'bot')!.offline, false);
  assert.ok(selectHeartsPlayers({ ...snapshot, state: { ...state, phase: 'roundEnd' } }).every((seat) => !seat.isCurrentPlayer));
});
