import assert from 'node:assert/strict';
import test from 'node:test';

import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import { initializeSevens, SevensVariant } from '@opengamesonline/sevens';

import {
  selectOpponents,
  selectOwnHand,
  selectSuitRuns,
} from '../src/features/multiplayer/selectors';
import {
  createSevensParticipantMetadata,
} from '../src/features/multiplayer/sevens-policy';
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
const game = initializeSevens(['alice', 'bob', 'carol'], SevensVariant.Standard, {
  random: () => 0.2,
});

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
      gameVersion: 1,
      playerCount: 3,
      spectatorCount: 1,
      minPlayers: 3,
      maxPlayers: 4,
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
  assert.equal(selectSuitRuns(spectatorSnapshot).every(({ cards }) => cards.length === 0), true);
});
