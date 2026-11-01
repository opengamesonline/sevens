import { shuffleCards } from "../shared/deck.js";
import { BotPlaystyle, Rank, Suit, type RandomSource, type StandardCard } from "../shared/types.js";
import { getHeartsPlayableCards, heartsRank, penaltyPoints } from "./game.js";
import type { HeartsAction, HeartsGame } from "./types.js";

// Strategies see their own hand and public trick history, never opponents' hands.
export function chooseHeartsBotAction(game: HeartsGame, actorId: string, playstyle: BotPlaystyle, random: RandomSource = Math.random): HeartsAction | null {
  const player = game.players.find(({ id }) => id === actorId);
  if (!player) return null;
  if (game.phase === "passing" && !game.passes[actorId]) {
    const danger = (card: StandardCard) => heartsRank(card) + (card.suit === Suit.Spades && card.rank >= Rank.Queen ? 20 : 0);
    const cards = playstyle === BotPlaystyle.Random ? shuffleCards(player.hand, random)
      : [...player.hand].sort((a, b) => danger(b) - danger(a));
    return { type: "pass", cards: cards.slice(0, 3) };
  }
  const legal = getHeartsPlayableCards(game, actorId);
  if (!legal.length) return null;
  if (playstyle === BotPlaystyle.Random) return { type: "play", card: shuffleCards(legal, random)[0]! };
  const lead = game.trick[0]?.card;
  const following = lead && legal[0]!.suit === lead.suit;
  const highest = Math.max(0, ...game.trick.filter(({ card }) => card.suit === lead?.suit).map(({ card }) => heartsRank(card)));
  const ducking = following ? legal.filter((card) => heartsRank(card) < highest) : [];
  const choices = ducking.length ? ducking : legal;
  const sorted = [...choices].sort((a, b) => {
    if (lead && !following) return penaltyPoints(b) - penaltyPoints(a) || heartsRank(b) - heartsRank(a);
    return ducking.length ? heartsRank(b) - heartsRank(a) : heartsRank(a) - heartsRank(b);
  });
  return { type: "play", card: sorted[0]! };
}
