import { Rank, Suit, type StandardCard } from '@opengamesonline/sevens';
import type { GameHelp } from '../card-room/help-types';

const card = (suit: Suit, rank: Rank): StandardCard => ({ suit, rank });

export const heartsHelp = {
  summary: 'Avoid taking hearts and the queen of spades. The player with the fewest points wins.',
  sections: [
    { title: 'Starting the game', paragraphs: [
      'Hearts is played with 4 players. Each player gets 13 cards. The aim is to finish the game with the fewest points.',
    ] },
    { title: 'Pass three cards', paragraphs: [
      'At the start of the first round, choose 3 cards and pass them to the player on your left. Tap the cards, then tap Pass left.',
      'In the next round, pass to the right. In the third round, pass across. In the fourth, keep your cards. Then repeat this pattern.',
      'Cards are exchanged after everyone has chosen. You cannot change your selection after you pass.',
    ] },
    { title: 'Choosing cards to pass', paragraphs: [
      'Passing is a chance to get rid of cards you do not want. The queen of spades is worth 13 points if you take it, so you might pass it to avoid having to play it yourself. You could still take it later if you win the trick it is played in.',
      'The ace and king of spades can be risky too: they can win a trick containing the queen. High hearts can also win tricks when hearts are played.',
      'If you have only one or two clubs or diamonds, passing them might leave you with none of that suit, unless you receive some back. On a later trick started with that suit, you could then play a heart or the queen of spades instead.',
      'These are suggestions, not rules. If you plan to take every heart and the queen, keeping high cards may help. See Scoring and winning for the risk.',
    ], examples: [{ title: 'Cards you might pass', rows: [{ label: 'Your cards', cards: [
      card(Suit.Spades, Rank.Queen), card(Suit.Spades, Rank.King), card(Suit.Hearts, Rank.Ace),
    ] }], explanation: 'Passing the queen gets it out of your hand. Passing the king reduces the chance of winning the queen from someone else. The ace of hearts is also likely to win a heart trick.' }] },
    { title: 'Playing your cards', paragraphs: [
      'The player with the 2 of clubs plays it first. Each player then plays one card. These four cards are called a trick.',
      'On your turn, tap a card to play it. You must play the same suit as the first card if you have one. For example, if the first card is a club, play a club. If you have no clubs, you can play a different suit. The first trick has one extra restriction, explained below.',
      'The highest card of the first suit wins the trick. The winner takes all four cards and plays the first card of the next trick. Card order is ace, king, queen, jack, then 10 down to 2.',
    ], examples: [{ title: 'Who takes these cards?', rows: [{ label: 'Cards played', cards: [
      card(Suit.Clubs, Rank.Four), card(Suit.Clubs, Rank.Ace), card(Suit.Clubs, Rank.King), card(Suit.Hearts, Rank.Two),
    ] }], explanation: 'Later in the round, the 4 of clubs is played first. The highest club wins: the ace. Its player takes all four cards, including the heart. The last player could play a heart only because they had no clubs.' }] },
    { title: 'When you can play hearts', paragraphs: [
      'On the first trick, you cannot play a heart or the queen of spades unless every card in your hand is a heart or the queen of spades.',
      'You cannot start a trick with a heart until a heart has been played on an earlier trick. The exception is when you have only hearts left. Playing the queen of spades does not allow players to start with hearts.',
    ] },
    { title: 'Tips for avoiding points', paragraphs: [
      'When hearts or the queen of spades are in a trick, playing a low card of the first suit may help you avoid winning it. A low card can still win if the other cards of that suit are lower.',
      'After the first trick, if you have no cards of the suit played first, you can play a heart or the queen of spades. Whoever wins that trick takes its points.',
      'Not every trick is worth points: a trick with no hearts or queen of spades costs nothing.',
    ] },
    { title: 'Scoring and winning', paragraphs: [
      'After all 13 tricks, count the cards you took. Each heart is worth 1 point and the queen of spades is worth 13. All other cards are worth 0.',
      'If you take every heart and the queen of spades in one round, you get 0 points and each other player gets 26. This is called shooting the moon.',
      'Trying to take all of them is risky: if you take some but another player takes even one heart or the queen, you score the points for the cards you took instead.',
      'The game ends when someone reaches 100 points or more at the end of a round. The player with the lowest total wins. If players tie for lowest, they share the win.',
    ], examples: [{ title: 'Counting points', rows: [{ label: 'Cards you took', cards: [
      card(Suit.Spades, Rank.Queen), card(Suit.Hearts, Rank.Ace), card(Suit.Hearts, Rank.Three),
    ] }], explanation: 'The queen of spades is 13 points. The two hearts are 1 point each. Your total is 15 points.' }] },
    { title: 'Other versions', paragraphs: [
      'This is the only version of Hearts available in Card Room.',
    ] },
  ],
  variants: null,
} as const satisfies GameHelp;
