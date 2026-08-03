import type { CreateGameOptions, Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  initializeSevens,
  SevensVariant,
  validateTurn,
  type SevensGameObject,
  type TurnAction,
} from '@opengamesonline/sevens';

import {
  MAX_SEVENS_PLAYERS,
  MIN_SEVENS_PLAYERS,
  SEVENS_APP_ID,
  SEVENS_GAME_VERSION,
  type SevensLobbyMetadata,
  type SevensParticipantMetadata,
  type SevensParticipantRole,
} from './types';
import { isSevensParticipantMetadata, isTurnAction } from './validation';

export type CreateSevensPolicyOptions = {
  gameName: string;
  participantName: string;
  role: SevensParticipantRole;
  maxPlayers: number;
  variant?: SevensVariant;
};

export function createSevensParticipantMetadata(
  role: SevensParticipantRole,
): SevensParticipantMetadata {
  return {
    appId: SEVENS_APP_ID,
    gameVersion: SEVENS_GAME_VERSION,
    role,
  };
}

function players(
  participants: readonly Participant<SevensParticipantMetadata>[],
): Participant<SevensParticipantMetadata>[] {
  return participants.filter(
    (participant) =>
      isSevensParticipantMetadata(participant.metadata) &&
      participant.metadata.role === 'player',
  );
}

function spectators(
  participants: readonly Participant<SevensParticipantMetadata>[],
): Participant<SevensParticipantMetadata>[] {
  return participants.filter(
    (participant) =>
      isSevensParticipantMetadata(participant.metadata) &&
      participant.metadata.role === 'spectator',
  );
}

export function createSevensPolicy({
  gameName,
  participantName,
  role,
  maxPlayers,
  variant = SevensVariant.Standard,
}: CreateSevensPolicyOptions): CreateGameOptions<
  SevensGameObject,
  TurnAction,
  SevensParticipantMetadata,
  SevensLobbyMetadata
> {
  if (
    !Number.isInteger(maxPlayers) ||
    maxPlayers < MIN_SEVENS_PLAYERS ||
    maxPlayers > MAX_SEVENS_PLAYERS
  ) {
    throw new RangeError(
      `Maximum players must be between ${MIN_SEVENS_PLAYERS} and ${MAX_SEVENS_PLAYERS}`,
    );
  }

  return {
    name: gameName,
    participantName,
    participantMetadata: createSevensParticipantMetadata(role),
    createInitialState(participants) {
      const playerIds = players(participants).map(({ id }) => id);
      return initializeSevens(playerIds, variant);
    },
    getLobbyMetadata(participants) {
      return {
        appId: SEVENS_APP_ID,
        gameVersion: SEVENS_GAME_VERSION,
        playerCount: players(participants).length,
        spectatorCount: spectators(participants).length,
        minPlayers: MIN_SEVENS_PLAYERS,
        maxPlayers,
      };
    },
    validateJoin(candidate, participants) {
      if (!isSevensParticipantMetadata(candidate.metadata)) {
        return 'This participant is not compatible with Sevens';
      }

      const candidateName = candidate.name.trim().toLowerCase();
      if (
        participants.some(
          ({ name }) => name.trim().toLowerCase() === candidateName,
        )
      ) {
        return 'That participant name is already in use';
      }

      if (candidate.metadata.role === 'player' && players(participants).length >= maxPlayers) {
        return 'The player roster is full';
      }

      return null;
    },
    validateStart(participants) {
      const playerCount = players(participants).length;
      return playerCount < MIN_SEVENS_PLAYERS
        ? `At least ${MIN_SEVENS_PLAYERS} players are required to start`
        : null;
    },
    reduceEvent(game, event, participant) {
      if (
        !isSevensParticipantMetadata(participant.metadata) ||
        participant.metadata.role !== 'player' ||
        !isTurnAction(event)
      ) {
        return game;
      }

      return validateTurn(game, participant.id, event) ?? game;
    },
  };
}
