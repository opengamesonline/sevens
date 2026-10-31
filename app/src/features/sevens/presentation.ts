import type { Card, FinalScore } from '@opengamesonline/sevens';

export function shouldPresentCardAsPlayable(
  showPlayableCards: boolean,
  isDonor: boolean,
  isPlayable: boolean,
): boolean {
  return isDonor || !showPlayableCards || isPlayable;
}

export function canAttemptPlay(selectedCard: Card | null, actionPending: boolean): boolean {
  return selectedCard !== null && !actionPending;
}

export function illegalMoveMessage(playerName: string): string {
  return `${playerName} tried to play an illegal move.`;
}

export function sortFinalScores(
  scores: readonly FinalScore[],
  winnerId: string | null,
): readonly FinalScore[] {
  return [...scores].sort(
    (left, right) =>
      Number(right.playerId === winnerId) - Number(left.playerId === winnerId) ||
      left.score - right.score,
  );
}

export function sortByLobbyStandings<T>(
  entries: readonly T[],
  getPlayerId: (entry: T) => string,
  latestPoints: ReadonlyMap<string, number>,
  cumulativePoints: ReadonlyMap<string, number>,
): readonly T[] {
  return [...entries].sort((left, right) => {
    const leftTotal = cumulativePoints.get(getPlayerId(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightTotal = cumulativePoints.get(getPlayerId(right)) ?? Number.MAX_SAFE_INTEGER;
    if (leftTotal !== rightTotal) return leftTotal - rightTotal;
    const leftLast = latestPoints.get(getPlayerId(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightLast = latestPoints.get(getPlayerId(right)) ?? Number.MAX_SAFE_INTEGER;
    return leftLast - rightLast;
  });
}
