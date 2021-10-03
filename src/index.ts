import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import assert from "assert/strict";

import Discord from "discord.js";
import chalk from "chalk";

import { BotError, AggregateBotError } from "./errors.js";

import config from "./config/config.json";
import secrets from "./config/secrets.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.chdir(__dirname);

interface CommandArgs {
    name: string;
    alias?: Array<string>;
    desc?: string;
    usage?: string;
    auth?: (message: Discord.Message) => boolean;
    execute: (message: Discord.Message, args: Array<string>, data: Data) => void | Promise<void>;
}
export class Command {
    constructor(args: CommandArgs) {
        Object.assign(this, args);
    }
}
export interface Command extends CommandArgs {}

type Data = {
    commands: Discord.Collection<string, Command>
};

const client = new Discord.Client({
    partials: ["MESSAGE", "CHANNEL", "REACTION", "USER"],
});

async function initData(): Promise<Data> {
    const files = fs.readdirSync("./commands/").filter(file => file.endsWith(".js"));

    const commands: Discord.Collection<string, Command> = new Discord.Collection();
    for (const file of files) {
        const val: Record<string, unknown> = await import(`./commands/${file}`) as Record<string, unknown>;
        if (!(val.default instanceof Command)) continue;
        const command = val.default;
        commands.set(command.name, command);
    }

    return { commands };
}

async function runBot() {
    const data = await initData();

    client.once("ready", async () => {
        assert(client.user !== null);
        console.log(chalk.yellow(client.user.tag) + " has logged on!");
        await client.user.setPresence({ activity: { name: `${config.prefix}help` } });
    });

    client.on("message", async message => {
        if (!message.content.startsWith(config.prefix) || message.author.bot) return;

        if (message.channel instanceof Discord.DMChannel) {
            await message.channel.send("Sorry, I don't support DMs yet!");
            return;
        }

        const args = message.content.slice(config.prefix.length).split(/ +/);
        const name = args.shift()!;

        const command = data.commands.get(name) ?? data.commands.find(cmd => cmd.alias !== undefined && cmd.alias.includes(name));
        try {
            if (command === undefined) {
                throw new BotError("Unknown command name", `\`${name}\` is not the name or alias of any command I have!`);
            }

            if (command.auth !== undefined && !command.auth(message)) {
                throw new BotError("Missing permissions", `You do not have the required permissions to use this command!`);
            }

            await command.execute(message, args, data);
        } catch (err) {
            if (err instanceof BotError || err instanceof AggregateBotError) {
                await message.channel.send(err.getEmbed());
            } else if (err instanceof Error) {
                console.error(err);
                const embed = new Discord.MessageEmbed()
                    .setColor(config.colors.error)
                    .setTitle(err.name)
                    .setDescription(err.message);
                await message.channel.send(embed);
            } else {
                console.error(`Nonstandard Error: ${err}`);
                const embed = new Discord.MessageEmbed()
                    .setColor(config.colors.error)
                    .setTitle("An error occurred");
                await message.channel.send(embed);
            }
        }
    });

    await client.login(secrets.token);
}

runBot().catch((err) => {
    console.error("Failed to start bot.");
    console.error(err);
    process.exit(1);
});
