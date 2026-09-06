import assert from 'node:assert/strict';
import test from 'node:test';

import { JOKER_CARD, Rank, Suit, createEmptyBoard, placeCard } from '@opengamesonline/sevens';

import { gainedCards, placedCards } from '../src/components/cards/card-text';
import { sortByLobbyStandings } from '../src/features/multiplayer/presentation';

function points(entries: readonly (readonly [string, number])[]): Map<string, number> {
  return new Map(entries);
}

test('sorts lobby standings by total points, lowest on top', () => {
  const rows = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];
  const latest = points([['alice', 10], ['bob', 30], ['carol', 20]]);
  const cumulative = points([['alice', 50], ['bob', 20], ['carol', 40]]);

  const sorted = sortByLobbyStandings(rows, (row) => row.id, latest, cumulative);

  assert.deepEqual(sorted.map((row) => row.id), ['bob', 'carol', 'alice']);
});

test('breaks total ties by latest-round points', () => {
  const rows = [{ id: 'alice' }, { id: 'bob' }];
  const latest = points([['alice', 25], ['bob', 5]]);
  const cumulative = points([['alice', 40], ['bob', 40]]);

  const sorted = sortByLobbyStandings(rows, (row) => row.id, latest, cumulative);

  assert.deepEqual(sorted.map((row) => row.id), ['bob', 'alice']);
});

test('sinks entries without scores below ranked players', () => {
  const rows = [{ id: 'alice' }, { id: 'newcomer' }, { id: 'bob' }];
  const latest = points([['alice', 10], ['bob', 30]]);
  const cumulative = points([['alice', 50], ['bob', 20]]);

  const sorted = sortByLobbyStandings(rows, (row) => row.id, latest, cumulative);

  assert.deepEqual(sorted.map((row) => row.id), ['bob', 'alice', 'newcomer']);
});

test('keeps join order for full ties and does not mutate the input', () => {
  const rows = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];
  const latest = points([]);
  const cumulative = points([
    ['alice', 10],
    ['bob', 10],
    ['carol', 10],
  ]);

  const sorted = sortByLobbyStandings(rows, (row) => row.id, latest, cumulative);

  assert.deepEqual(sorted.map((row) => row.id), ['alice', 'bob', 'carol']);
  assert.deepEqual(rows.map((row) => row.id), ['alice', 'bob', 'carol']);
});

test('gainedCards reports only newly arrived cards', () => {
  const sevenSpades = { suit: Suit.Spades, rank: Rank.Seven };
  const eightSpades = { suit: Suit.Spades, rank: Rank.Eight };
  const nineHearts = { suit: Suit.Hearts, rank: Rank.Nine };

  assert.deepEqual(
    gainedCards([sevenSpades, eightSpades], [sevenSpades, eightSpades, nineHearts]),
    [nineHearts],
  );
  assert.deepEqual(gainedCards([sevenSpades], [sevenSpades]), []);
  assert.deepEqual(gainedCards([JOKER_CARD], [JOKER_CARD]), []);
  assert.deepEqual(gainedCards([], [sevenSpades]), [sevenSpades]);
});

test('gainedCards in reverse reports lost cards', () => {
  const sevenSpades = { suit: Suit.Spades, rank: Rank.Seven };
  const eightSpades = { suit: Suit.Spades, rank: Rank.Eight };

  assert.deepEqual(
    gainedCards([sevenSpades], [sevenSpades, eightSpades]),
    [eightSpades],
  );
});

test('placedCards only reports lost cards that landed on the board', () => {
  const sevenSpades = { suit: Suit.Spades, rank: Rank.Seven };
  const eightSpades = { suit: Suit.Spades, rank: Rank.Eight };
  const nineHearts = { suit: Suit.Hearts, rank: Rank.Nine };
  const prevBoard = placeCard(createEmptyBoard(), sevenSpades);
  const board = placeCard(prevBoard, eightSpades);

  assert.deepEqual(placedCards(prevBoard, board, [eightSpades]), [eightSpades]);
  assert.deepEqual(placedCards(prevBoard, board, [nineHearts]), []);
  assert.deepEqual(placedCards(prevBoard, board, [JOKER_CARD]), []);
});
