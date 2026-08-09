import type { CreateGameOptions, Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  GameStatus,
  createFinalScores,
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
  type SevensScore,
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
  recovery?: {
    lobbyMetadata: SevensLobbyMetadata;
    participants: readonly Participant<SevensParticipantMetadata>[];
  };
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
  recovery,
}: CreateSevensPolicyOptions): SevensPolicy {
  const restoredLobby = recovery?.lobbyMetadata;
  const policyMaxPlayers = restoredLobby?.maxPlayers ?? maxPlayers;
  const policyShowPlayableCards = restoredLobby?.showPlayableCards ?? showPlayableCards;
  const policyVariant = restoredLobby?.variant ?? variant;
  if (
    !Number.isInteger(policyMaxPlayers) ||
    policyMaxPlayers < MIN_SEVENS_PLAYERS ||
    policyMaxPlayers > MAX_SEVENS_PLAYERS
  ) {
    throw new RangeError(
      `Maximum players must be between ${MIN_SEVENS_PLAYERS} and ${MAX_SEVENS_PLAYERS}`,
    );
  }

  let bots: SevensBot[] = restoredLobby?.bots.map((bot) => ({ ...bot })) ?? [];
  let nextBotNumber =
    Math.max(
      0,
      ...bots.map(({ id }) => Number.parseInt(id.replace('sevens-bot-', ''), 10) || 0),
    ) + 1;
  let roundsPlayed = restoredLobby?.roundsPlayed ?? 0;
  let latestScores: SevensScore[] =
    restoredLobby?.latestScores.map((score) => ({ ...score })) ?? [];
  let cumulativeScores: SevensScore[] =
    restoredLobby?.cumulativeScores.map((score) => ({ ...score })) ?? [];
  let roundPlayerNames = new Map<string, string>([
    ...(recovery?.participants.map(({ id, name }) => [id, name] as const) ?? []),
    ...bots.map(({ id, name }) => [id, name] as const),
  ]);

  return {
    name: gameName,
    participantName,
    participantMetadata: createSevensParticipantMetadata(role),
    addBot(playstyle, participants) {
      if (!Object.values(BotPlaystyle).includes(playstyle)) {
        throw new RangeError(`Unsupported bot playstyle: ${String(playstyle)}`);
      }
      if (players(participants).length + bots.length >= policyMaxPlayers) {
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
      const humanPlayers = players(participants);
      const playerIds = [...humanPlayers.map(({ id }) => id), ...bots.map(({ id }) => id)];
      roundPlayerNames = new Map([
        ...humanPlayers.map(({ id, name }) => [id, name] as const),
        ...bots.map(({ id, name }) => [id, name] as const),
      ]);
      return {
        ...initializeSevens(playerIds, policyVariant),
        lastIllegalMovePlayerId: null,
        bots: bots.map((bot) => ({ ...bot })),
        roundNumber: roundsPlayed + 1,
        latestScores: latestScores.map((score) => ({ ...score })),
        cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
      };
    },
    getLobbyMetadata(participants) {
      return {
        appId: SEVENS_APP_ID,
        gameVersion: SEVENS_GAME_VERSION,
        playerCount: players(participants).length + bots.length,
        spectatorCount: spectators(participants).length,
        minPlayers: MIN_SEVENS_PLAYERS,
        maxPlayers: policyMaxPlayers,
        bots: bots.map((bot) => ({ ...bot })),
        roundsPlayed,
        latestScores: latestScores.map((score) => ({ ...score })),
        cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
        showPlayableCards: policyShowPlayableCards,
        variant: policyVariant,
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
        players(participants).length + bots.length >= policyMaxPlayers
      ) {
        return 'The player roster is full';
      }

      return null;
    },
    validateStart(participants, connectedParticipantIds) {
      const playerCount = players(participants).length + bots.length;
      if (
        connectedParticipantIds &&
        players(participants).some(({ id }) => !connectedParticipantIds.has(id))
      ) {
        return 'All players must reconnect before starting';
      }
      return playerCount < MIN_SEVENS_PLAYERS
        ? `At least ${MIN_SEVENS_PLAYERS} players are required to start`
        : null;
    },
    reduceEvent(game, event, participant, context) {
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
        context.authoritativeHost &&
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
        if (game.status === GameStatus.Active && nextGame.status === GameStatus.Finished) {
          latestScores = createFinalScores(nextGame).map(({ playerId, score }) => ({
            playerId,
            playerName: roundPlayerNames.get(playerId) ?? playerId,
            points: score,
          }));
          const totals = new Map(
            cumulativeScores.map((score) => [score.playerId, { ...score }] as const),
          );
          latestScores.forEach((score) => {
            const previous = totals.get(score.playerId);
            totals.set(score.playerId, {
              playerId: score.playerId,
              playerName: score.playerName,
              points: (previous?.points ?? 0) + score.points,
            });
          });
          cumulativeScores = [...totals.values()];
          roundsPlayed += 1;
        }

        return {
          ...nextGame,
          bots: game.bots,
          roundNumber: game.roundNumber,
          latestScores: latestScores.map((score) => ({ ...score })),
          cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
          lastIllegalMovePlayerId: null,
        };
      }

      return game.status === GameStatus.Active && action.type === TurnActionType.Play
        ? { ...game, lastIllegalMovePlayerId: actorId }
        : game;
    },
  };
}
