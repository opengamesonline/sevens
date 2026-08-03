import assert from 'node:assert/strict';
import test from 'node:test';

import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import { TurnActionType } from '@opengamesonline/sevens';

import {
  createSevensParticipantMetadata,
  createSevensPolicy,
} from '../src/features/multiplayer/sevens-policy';
import type { SevensParticipantMetadata } from '../src/features/multiplayer/types';

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
  });
  const game = policy.createInitialState([host, alice, bob, carol]);

  assert.deepEqual(
    game.players.map(({ id }) => id),
    ['alice', 'bob', 'carol'],
  );
  assert.equal(game.players.flatMap(({ hand }) => hand).length, 52);
});

test('computes role-aware lobby metadata and enforces lobby policy', () => {
  const policy = createSevensPolicy({
    gameName: 'Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
  });
  const participants = [alice, bob, carol, host];

  assert.deepEqual(policy.getLobbyMetadata(participants), {
    appId: 'com.opengamesonline.sevens',
    gameVersion: 1,
    playerCount: 3,
    spectatorCount: 1,
    minPlayers: 3,
    maxPlayers: 3,
  });
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

test('uses connection-bound actors for the two-step draw flow', () => {
  const policy = createSevensPolicy({
    gameName: 'Table',
    participantName: alice.name,
    role: 'player',
    maxPlayers: 3,
  });
  const participants = [alice, bob, carol];
  const game = policy.createInitialState(participants);
  const requester = participants.find(({ id }) => id === game.currentPlayerId)!;
  const requesterIndex = participants.findIndex(({ id }) => id === requester.id);
  const donor = participants[(requesterIndex - 1 + participants.length) % participants.length]!;

  const pending = policy.reduceEvent(
    game,
    { type: TurnActionType.RequestDraw },
    requester,
  );
  assert.deepEqual(pending.pendingDraw, {
    requesterId: requester.id,
    donorId: donor.id,
  });

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
    { type: TurnActionType.RequestDraw },
    host,
  );
  assert.equal(spectatorAttempt, completed);
});
