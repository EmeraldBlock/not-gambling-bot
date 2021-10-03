import Discord from "discord.js";

// general

export function randFloat(a: number, b?: number): number {
    if (b === undefined) {
        return Math.random() * a;
    } else {
        return Math.random() * (b - a) + a;
    }
}

export function randInt(a: number, b?: number): number {
    return Math.floor(randFloat(a, b));
}

export function range(a: number, b?: number): Array<number> {
    if (b === undefined) {
        return new Array(a).fill(undefined).map((_, i) => i);
    } else {
        return new Array(b-a).fill(undefined).map((_, i) => i+a);
    }
}

export function trimNewlines(str: string): string {
    return str.replace(/^.*\n|\n.*$/g, "");
}

export function toEnglishList(array: Array<string>): string | undefined {
    switch (array.length) {
    case 0: {
        return undefined;
    }
    case 1: {
        return array[0];
    }
    case 2: {
        return `${array[0]} and ${array[1]}`;
    }
    default: {
        return `${array.slice(0, -1).join(", ")}, and ${array[-1]}`;
    }
    }
}

export async function sleep(ms: number): Promise<void> {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

// Discord

export async function findAsync<T>(collection: Discord.Collection<unknown, T>, callback: (val: T) => Promise<boolean>): Promise<T | undefined> {
    return (await Promise.all(collection.map(val => Promise.all([callback(val), val])))).find(result => result[0])?.[1];
}

export async function safeDelete(message: Discord.Message): Promise<Discord.Message> {
    try {
        return await message.delete();
    } catch (reason) {
        if (reason instanceof Discord.DiscordAPIError && reason.code === 10008) {
            return message;
        }
        throw reason;
    }
}

export function fetchGuildMessageById(id: Discord.Snowflake, guild: Discord.Guild): Promise<Discord.Message> {
    const textChannelsCache = guild.channels.cache.filter((channel): channel is Discord.TextChannel => channel instanceof Discord.TextChannel);
    return Promise.any(textChannelsCache.map(channel => channel.messages.fetch(id)));
}
