import { JOKER_CARD, Rank, SevensVariant, Suit, type StandardCard } from '@opengamesonline/sevens';
import type { GameHelp } from '../card-room/help-types';

const card = (suit: Suit, rank: Rank): StandardCard => ({ suit, rank });
const spade = (rank: Rank) => card(Suit.Spades, rank);
const heart = (rank: Rank) => card(Suit.Hearts, rank);

export const sevensHelp = {
  summary: 'Get rid of all your cards before the other players.',
  sections: [
    { title: 'Starting the game', paragraphs: [
      'Sevens is played with 3 to 7 players. All the cards are dealt out. The player with the 7 of spades plays it first.',
      'Players then take turns. The first player to get rid of all their cards wins the round.',
    ] },
    { title: 'Where cards go', paragraphs: [
      'Each suit has its own row. Start a row with its 7, then add cards in order to either end: 6, 5, 4 and so on on one side; 8, 9, 10 and so on on the other. The ace goes below the 2.',
      'For hearts, clubs and diamonds, the matching spade must already be on the table. For example, you cannot play the 8 of hearts until the 8 of spades is down.',
    ], examples: [
      { title: 'First card', rows: [{ label: 'Played first', cards: [spade(Rank.Seven)] }], explanation: 'The player with the 7 of spades puts it down to start.' },
      { title: 'Playing a heart', rows: [
        { label: 'Spades on the table', cards: [spade(Rank.Six), spade(Rank.Seven), spade(Rank.Eight)] },
        { label: 'Hearts on the table', cards: [heart(Rank.Seven)] },
        { label: 'You can play', cards: [heart(Rank.Six), heart(Rank.Eight)] },
      ], explanation: 'Play either the 6 or the 8 of hearts. Each fits next to the 7 of hearts, and both matching spades are already down. Play only one card per turn.' },
    ] },
    { title: 'On your turn', paragraphs: [
      'You can select a card while waiting for your turn. On your turn, tap Play selected to play it; selecting a card does not play it automatically.',
      'Instead of playing a card, you can tap Draw. The player to your right chooses a card to give you. Your turn ends when you receive it. A player who gives away their last card wins the round.',
      'Normally, you can draw even when you have a card to play. The host can turn on Prevent illegal draws to allow drawing only when you cannot play.',
      'The host can also turn on Show playable cards to highlight the cards you can play.',
    ] },
    { title: 'Choosing a card', paragraphs: [
      'Look for cards that can help you play another card in your hand later. A spade can let you play a card of the same number in another suit, but it also lets other players do the same.',
      'Drawing adds a card to your hand, so playing a card usually brings you closer to winning. Be careful if the player on your right has one card left: if they give it to you, they win.',
    ], examples: [{ title: 'Think ahead', rows: [
      { label: 'On the table', cards: [spade(Rank.Seven), heart(Rank.Seven)] },
      { label: 'Your cards', cards: [spade(Rank.Eight), heart(Rank.Eight)] },
    ], explanation: 'Play the 8 of spades now. Once it is down, your 8 of hearts can go next to the 7 of hearts on a later turn, if you still have it.' }] },
    { title: 'Scoring', paragraphs: [
      'When the round ends, the cards left in your hand count against you. Cards 2 through 9 are worth 5 points each. A 10, jack, queen or king is worth 10. An ace is worth 15. The Joker is worth 0.',
      'The winner gets 0 points. Scores carry over between rounds; the lower your total, the better.',
    ] },
  ],
  variants: {
    [SevensVariant.Standard]: {
      label: 'Standard', description: 'Play without a Joker.',
      sections: [{ title: 'Standard rules', paragraphs: ['Use the rules above with a 52-card deck.'] }],
    },
    [SevensVariant.Joker]: {
      label: 'Joker', description: 'Add one Joker to the deck.',
      sections: [{ title: 'Using the Joker', paragraphs: [
        'The Joker lets you play a card that needs one card from another player first. It can only be used after the 7 of spades is on the table.',
        'Tap the card you want to play, not the Joker. If another player has a card that can be played first to make yours playable, the game puts both cards down and gives that player your Joker.',
        'You do not need to see the other player’s hand; the game checks it for you. This can help you get rid of a card that is otherwise blocked. The Joker cannot be played on its own. If it is your only card, draw a card.',
      ], examples: [
        { title: 'Using a missing heart', rows: [
          { label: 'On the table', cards: [spade(Rank.Seven), spade(Rank.Eight), spade(Rank.Nine), heart(Rank.Seven)] },
          { label: 'Another player holds', cards: [heart(Rank.Eight)] },
          { label: 'You hold', cards: [JOKER_CARD, heart(Rank.Nine)] },
        ], explanation: 'Play your 9 of hearts. The game puts down the other player’s 8 of hearts first, then your 9. That player gets your Joker.' },
        { title: 'Using a missing spade', rows: [
          { label: 'On the table', cards: [spade(Rank.Seven), spade(Rank.Eight), heart(Rank.Seven), heart(Rank.Eight)] },
          { label: 'Another player holds', cards: [spade(Rank.Nine)] },
          { label: 'You hold', cards: [JOKER_CARD, heart(Rank.Nine)] },
        ], explanation: 'Play your 9 of hearts. The game puts down the other player’s 9 of spades first, then your 9 of hearts. That player gets your Joker.' },
      ] }],
    },
  },
} as const satisfies GameHelp<SevensVariant>;
