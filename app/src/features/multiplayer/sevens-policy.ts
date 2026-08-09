import type { CreateGameOptions, Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  GameStatus,
  initializeSevens,
  SevensVariant,
  TurnActionType,
  validateTurn,
  type TurnAction,
} from '@opengamesonline/sevens';

import {
  MAX_SEVENS_PLAYERS,
  MIN_SEVENS_PLAYERS,
  SEVENS_APP_ID,
  SEVENS_GAME_VERSION,
  type SevensBot,
  type SevensGameEvent,
  type SevensGameState,
  type SevensLobbyMetadata,
  type SevensParticipantMetadata,
  type SevensParticipantRole,
} from './types';
import {
  isSevensBotTurnEvent,
  isSevensParticipantMetadata,
  isTurnAction,
} from './validation';

export type CreateSevensPolicyOptions = {
  gameName: string;
  participantName: string;
  role: SevensParticipantRole;
  maxPlayers: number;
  showPlayableCards: boolean;
  variant?: SevensVariant;
};

export type SevensPolicy = CreateGameOptions<
  SevensGameState,
  SevensGameEvent,
  SevensParticipantMetadata,
  SevensLobbyMetadata
> & {
  addBot(
    playstyle: BotPlaystyle,
    participants: readonly Participant<SevensParticipantMetadata>[],
  ): SevensBot;
  removeBot(botId: string): boolean;
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
  showPlayableCards,
  variant = SevensVariant.Standard,
}: CreateSevensPolicyOptions): SevensPolicy {
  if (
    !Number.isInteger(maxPlayers) ||
    maxPlayers < MIN_SEVENS_PLAYERS ||
    maxPlayers > MAX_SEVENS_PLAYERS
  ) {
    throw new RangeError(
      `Maximum players must be between ${MIN_SEVENS_PLAYERS} and ${MAX_SEVENS_PLAYERS}`,
    );
  }

  let bots: SevensBot[] = [];
  let nextBotNumber = 1;

  return {
    name: gameName,
    participantName,
    participantMetadata: createSevensParticipantMetadata(role),
    addBot(playstyle, participants) {
      if (!Object.values(BotPlaystyle).includes(playstyle)) {
        throw new RangeError(`Unsupported bot playstyle: ${String(playstyle)}`);
      }
      if (players(participants).length + bots.length >= maxPlayers) {
        throw new Error('The player roster is full');
      }

      const usedNames = new Set(participants.map(({ name }) => name.trim().toLowerCase()));
      let name = `Bot ${nextBotNumber}`;
      while (usedNames.has(name.toLowerCase()) || bots.some((bot) => bot.name === name)) {
        nextBotNumber += 1;
        name = `Bot ${nextBotNumber}`;
      }
      const bot = {
        id: `sevens-bot-${nextBotNumber}`,
        name,
        playstyle,
      };
      nextBotNumber += 1;
      bots = [...bots, bot];
      return bot;
    },
    removeBot(botId) {
      const nextBots = bots.filter(({ id }) => id !== botId);
      if (nextBots.length === bots.length) return false;
      bots = nextBots;
      return true;
    },
    createInitialState(participants) {
      const playerIds = [...players(participants).map(({ id }) => id), ...bots.map(({ id }) => id)];
      return {
        ...initializeSevens(playerIds, variant),
        lastIllegalMovePlayerId: null,
        bots: bots.map((bot) => ({ ...bot })),
      };
    },
    getLobbyMetadata(participants) {
      return {
        appId: SEVENS_APP_ID,
        gameVersion: SEVENS_GAME_VERSION,
        playerCount: players(participants).length + bots.length,
        spectatorCount: spectators(participants).length,
        minPlayers: MIN_SEVENS_PLAYERS,
        maxPlayers,
        bots: bots.map((bot) => ({ ...bot })),
        showPlayableCards,
        variant,
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
        ) || bots.some(({ name }) => name.trim().toLowerCase() === candidateName)
      ) {
        return 'That participant name is already in use';
      }

      if (
        candidate.metadata.role === 'player' &&
        players(participants).length + bots.length >= maxPlayers
      ) {
        return 'The player roster is full';
      }

      return null;
    },
    validateStart(participants) {
      const playerCount = players(participants).length + bots.length;
      return playerCount < MIN_SEVENS_PLAYERS
        ? `At least ${MIN_SEVENS_PLAYERS} players are required to start`
        : null;
    },
    reduceEvent(game, event, participant) {
      let actorId: string;
      let action: TurnAction;
      if (
        isSevensParticipantMetadata(participant.metadata) &&
        participant.metadata.role === 'player' &&
        isTurnAction(event)
      ) {
        actorId = participant.id;
        action = event;
      } else if (
        participant.slot === 0 &&
        isSevensBotTurnEvent(event) &&
        game.bots.some(({ id }) => id === event.botId)
      ) {
        actorId = event.botId;
        action = event.action;
      } else {
        return game;
      }

      const nextGame = validateTurn(game, actorId, action);
      if (nextGame) {
        return { ...nextGame, bots: game.bots, lastIllegalMovePlayerId: null };
      }

      return game.status === GameStatus.Active && action.type === TurnActionType.Play
        ? { ...game, lastIllegalMovePlayerId: actorId }
        : game;
    },
  };
}
