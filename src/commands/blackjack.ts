import Discord from "discord.js";

import { Command } from "../index.js";
import { randInt, range, safeDelete, sleep, toEnglishList, trimNewlines } from "../utils.js";
import Time from "../time.js";

import config from "../config/config.json";
import BotError from "../bot-error.js";

enum Suit {
    CLUBS,
    DIAMONDS,
    HEARTS,
    SPADES,
    length,
}
const suitToString = [
    "♣",
    "♦",
    "♥",
    "♠",
];

enum Rank {
    ACE,
    _2,
    _3,
    _4,
    _5,
    _6,
    _7,
    _8,
    _9,
    _10,
    JACK,
    QUEEN,
    KING,
    length,
}
const rankToString = [
    "A",
    ...range(2, 11),
    "J",
    "Q",
    "K",
];

const PERFECT = 21;

enum Move {
    INVALID,
    HIT,
    STAND,
    DOUBLE,
    SPLIT,
    SURRENDER,
}

function getMove(content: string): Move {
    switch (content) {
    case "h":
    case "hit": {
        return Move.HIT;
    }
    case "s":
    case "stand": {
        return Move.STAND;
    }
    case "d":
    case "double":
    case "double down": {
        return Move.DOUBLE;
    }
    case "p":
    case "split": {
        return Move.SPLIT;
    }
    case "r":
    case "surrender": {
        return Move.SURRENDER;
    }
    default: {
        return Move.INVALID;
    }
    }
}

enum Result {
    LOSE,
    TIE,
    WIN,
}

enum Status {
    BLACKJACK,
    WAIT,
    CURRENT,
    SURRENDER,
    BUST,
    STAND,
    DOUBLE,
}
const statusToEmoji = [
    "✨",
    "⬛",
    "➡️",
    "🏳️",
    "💥",
    "🔒",
    "💵",
];

class Card {
    constructor(
        public suit: Suit,
        public rank: Rank,
        public down: boolean = false,
    ) {}

    static fromId(id: number, down?: boolean): Card {
        return new Card(Math.floor(id / Rank.length), id % Rank.length, down);
    }

    static fromRandom(down?: boolean): Card {
        return Card.fromId(randInt(Suit.length * Rank.length), down);
    }

    toString(): string {
        return this.down ? "??" : `${suitToString[this.suit]}${rankToString[this.rank]}`;
    }

    value(): number {
        if (this.rank >= Rank._10) {
            return 10;
        } else {
            return this.rank + 1;
        }
    }
}

class HandSum {
    constructor(
        public sum: number,
        public soft: boolean,
    ) {}

    static fromCards(cards: Array<Card>): HandSum {
        const rawSum = cards.reduce((sum, card) => sum + card.value(), 0);
        if (cards.some(card => card.rank === Rank.ACE)) {
            const soft = rawSum+10 <= PERFECT;
            return new HandSum(soft ? rawSum+10 : rawSum, soft);
        } else {
            return new HandSum(rawSum, false);
        }
    }

    toString(): string {
        return `${this.sum}${this.soft ? "s" : "h"}`;
    }

    hit(card: Card): void {
        if (card.rank === Rank.ACE && this.sum+11 <= PERFECT) {
            this.sum += 11;
            this.soft = true;
        } else {
            this.sum += card.value();
        }
        if (this.soft && this.sum > PERFECT) {
            this.sum -= 10;
            this.soft = false;
        }
    }

    bust(): boolean {
        return this.sum > PERFECT;
    }
}

class Hand {
    public handSum: HandSum;
    public status: Status;

    constructor(
        public cards: Array<Card>,
    ) {
        this.handSum = HandSum.fromCards(this.cards);
        this.status = this.blackjack() ? Status.BLACKJACK : Status.WAIT;
    }

    static deal(): Hand {
        return new Hand([Card.fromRandom(), Card.fromRandom()]);
    }

    toString(): string {
        return `**${this.bust() ? "BUST" : this.blackjack() ? "BLACKJACK" : this.handSum}** ${this.getCardsAsString()}`;
    }

    getCardsAsString(): string {
        return this.cards.map(card => `\`${card}\``).join(" ");
    }

    hit(card: Card = Card.fromRandom()): Card {
        this.cards.push(card);
        this.handSum.hit(card);
        return card;
    }

    bust(): boolean {
        return this.handSum.bust();
    }

    blackjack(): boolean {
        return this.handSum.sum === PERFECT && this.cards.length <= 2;
    }

    compare(hand: Hand) {
        const ourSum = this.handSum.sum;
        const theirSum = hand.handSum.sum;
        if (ourSum > theirSum) {
            return Result.WIN;
        } else if (ourSum < theirSum) {
            return Result.LOSE;
        } else {
            if (ourSum !== PERFECT) {
                return Result.TIE;
            }
            const ourBJ = this.cards.length <= 2;
            const theirBJ = hand.cards.length <= 2;
            if (ourBJ && !theirBJ) {
                return Result.WIN;
            } else if (!ourBJ && theirBJ) {
                return Result.LOSE;
            } else {
                return Result.TIE;
            }
        }
    }
}

class Dealer extends Hand {
    public hidden: boolean = true;

    constructor(cards: Array<Card>) {
        super(cards);
    }

    static deal(): Dealer {
        return new Dealer([Card.fromRandom(), Card.fromRandom(true)]);
    }

    toString(): string {
        if (this.hidden) {
            const card = this.cards[0];
            return `**${card.rank === Rank.ACE ? `${11}s` : `${this.cards[0].value()}h`}+** ${this.getCardsAsString()}`;
        }
        return super.toString();
    }

    reveal(): Card {
        this.hidden = false;
        this.cards[1].down = false;
        return this.cards[1];
    }
}

class Player {
    constructor(
        public hands: Array<Hand>,
        public user: Discord.User,
        public game: Blackjack,
    ) {}

    static deal(user: Discord.User, game: Blackjack): Player {
        return new Player([Hand.deal()], user, game);
    }

    async move(): Promise<Move> {
        return await new Promise<Move>(resolve => {
            const collector = this.game.channel.createMessageCollector(m => {
                if (m.author.id !== this.user.id) return false;
                const move = getMove(m.content.trim().toLowerCase());
                if (move === Move.INVALID) return false;
                if (m.guild?.me?.permissionsIn(m.channel).has("MANAGE_MESSAGES") ?? false) {
                    void safeDelete(m).then(() => resolve(move));
                } else {
                    resolve(move);
                }
                return true;
            }, { time: Time.MINUTE / Time.MILLI, max: 1 });

            collector.once("end", async (_, reason) => {
                if (reason === "limit") return;
                await this.game.prompt?.edit({ content: "Ended due to inactivity." });
            });
        });
    }
}

class Blackjack {
    public players: Array<Player>;
    public dealer: Dealer;
    public embed: Discord.MessageEmbed;
    public prompt: Discord.Message | undefined;

    constructor(
        public channel: Discord.MessageChannel,
        public users: Array<Discord.User>,
    ) {}

    getEmbed(description: string = "**h**it, **s**tand, **d**ouble down, s**p**lit, or su**r**render"): Discord.MessageEmbed {
        const playerFields = this.players.map(player => ({
            name: player.user.tag,
            value: player.hands.map(hand => `${statusToEmoji[hand.status]} ${hand}`).join("\n"),
        }));
        return new Discord.MessageEmbed({
            color: config.colors.info,
            title: "Blackjack",
            description,
            fields: [
                { name: "Dealer", value: `${statusToEmoji[this.dealer.status]} ${this.dealer}` },
                ...playerFields,
            ],
            footer: { text: "See the full rules with `rules blackjack`" },
        });
    }

    async display(description?: string): Promise<void> {
        if (this.prompt === undefined || this.prompt.deleted) {
            this.prompt = await this.channel.send(this.getEmbed(description));
        } else {
            await this.prompt.edit(this.getEmbed(description));
        }
    }

    async dealerMove(): Promise<Move> {
        await sleep(1.5 * Time.SECOND / Time.MILLI);
        const { sum, soft } = this.dealer.handSum;
        if (sum < 17 || sum === 17 && soft) {
            return Move.HIT;
        } else {
            return Move.STAND;
        }
    }

    async runGame(): Promise<void> {
        this.players = this.users.map(user => Player.deal(user, this));
        this.dealer = Dealer.deal();

        if (this.dealer.handSum.sum === PERFECT) {
            this.dealer.reveal();
            await this.display(trimNewlines(`
**DEALER BLACKJACK**
${this.players[0].hands[0].handSum.sum === PERFECT ? "🟨 You tied!" : "🟥 You lost!"}
            `));
            return;
        }

        for (const player of this.players) {
            await this.display();
            for (let h = 0; h < player.hands.length; ++h) {
                const hand = player.hands[h];
                hand.status = Status.CURRENT;
                hand:
                while (true) {
                    const move = await player.move();
                    if (hand.handSum.sum === PERFECT && move !== Move.STAND) {
                        await this.display("You can't do that, you've got the best sum!");
                        continue;
                    }
                    switch (move) {
                    case Move.HIT: {
                        const card = hand.hit();
                        if (hand.bust()) {
                            await this.display(trimNewlines(`
You draw \`${card}\` and **BUST**
🟥 You lost!
                            `));
                            break hand;
                        }
                        await this.display(`You draw \`${card}\``);
                        break;
                    }
                    case Move.STAND: {
                        hand.status = Status.STAND;
                        break hand;
                    }
                    case Move.DOUBLE: {
                        const card = hand.hit();
                        if (hand.bust()) {
                            await this.display(trimNewlines(`
You double down and draw \`${card}\` and **BUST**
🟥 You lost!
                            `));
                            break hand;
                        }
                        hand.status = Status.SURRENDER;
                        await this.display(`You double down and draw \`${card}\``);
                        break hand;
                    }
                    case Move.SPLIT: {
                        if (hand.cards.length > 2) {
                            await this.display("You can only split on the first turn of your hand!");
                            break;
                        }
                        if (hand.cards[0].value() !== hand.cards[1].value()) {
                            await this.display("You can only split if your cards have the same value!");
                            break;
                        }
                        player.hands.splice(h+1, 0, new Hand([hand.cards.pop()!]));
                        hand.handSum = HandSum.fromCards(hand.cards);
                        await this.display(`You split your hand and draw \`${hand.hit()}\` and \`${player.hands[h+1].hit()}\``);
                        break;
                    }
                    case Move.SURRENDER: {
                        if (hand.cards.length > 2) {
                            await this.display("You can only surrender on the first turn of your hand!");
                            break;
                        }
                        hand.status = Status.SURRENDER;
                        await this.display(`You surrender your hand`);
                        break hand;
                    }
                    }
                }
            }
        }

        this.dealer.status = Status.CURRENT;
        await sleep(1.5 * Time.SECOND / Time.MILLI);
        await this.display(`Dealer's other card was \`${this.dealer.reveal()}\``);
        dealer:
        while (true) {
            const move = await this.dealerMove();
            switch (move) {
            case Move.HIT: {
                const card = this.dealer.hit();
                if (this.dealer.handSum.sum > PERFECT) {
                    this.dealer.status = Status.BUST;
                    await this.display(trimNewlines(`
Dealer draws \`${card}\` and **BUSTS**
🟩 You won!
                    `));
                    return;
                }
                await this.display(`Dealer draws \`${card}\``);
                break;
            }
            case Move.STAND: {
                this.dealer.status = Status.STAND;
                break dealer;
            }
            }
        }

        switch (this.players[0].hands[0].compare(this.dealer)) {
        case Result.LOSE: {
            await this.display("🟥 You lost!");
            break;
        }
        case Result.TIE: {
            await this.display("🟨 You tied!");
            break;
        }
        case Result.WIN: {
            await this.display("🟩 You won!");
            break;
        }
        }
    }
}

const channels = new Map<Discord.Snowflake, Set<Discord.Snowflake>>();

export default new Command({
    name: "blackjack",
    alias: ["bj"],
    desc:
`Starts a game of Blackjack.`,
    usage:
``,
    execute: async message => {
        const playerUsers = [message.author, ...message.mentions.users.array()];

        const playerIds = playerUsers.map(user => user.id);
        const currentIds = channels.get(message.channel.id) ?? new Set<Discord.Snowflake>();
        if (currentIds.size > 0 && playerIds.some(id => currentIds.has(id))) {
            const conflictIds = playerIds.filter(id => currentIds.has(id));

            const list = toEnglishList(conflictIds.map(id => id === message.author.id ? "You" : `<@${id}>`))!;
            const verb = conflictIds[0] !== message.author.id && conflictIds.length === 1 ? "is" : "are";
            throw new BotError("Already playing", `${list} ${verb} already playing Blackjack in this channel!`);
        }
        channels.set(message.channel.id, new Set([...currentIds, ...playerIds]));

        const game = new Blackjack(message.channel, playerUsers);
        await game.runGame();

        const ids = channels.get(message.channel.id)!;
        if (playerIds.length === ids.size) {
            channels.delete(message.channel.id);
        } else {
            playerIds.forEach(id => ids.delete(id));
        }
    },
});
