import Discord from "discord.js";

import { Command } from "../index.js";
import { BotError } from "../errors.js";

import config from "../config/config.json";

export default new Command({
    name: "help",
    alias: ["info"],
    desc:
`Provides the list of commands or information about a specific command.`,
    usage:
`[<command>]`,
    execute: async (message, args, data) => {
        const embed = new Discord.MessageEmbed()
            .setColor(config.colors.info);
        if (args.length === 0) {
            embed
                .setTitle("Commands")
                .setDescription(`\
\`\`\`
${data.commands.map((val, key) => key).join("\n")}
\`\`\`
\`${config.prefix}help <command>\` for more information on a command.`,
                );
        } else {
            const name = args[0];
            const command = data.commands.get(name) ?? data.commands.find(cmd => cmd.alias !== undefined && cmd.alias.includes(name));
            if (command === undefined) throw new BotError("Unknown command name", `\`${name}\` is not the name or alias of any command I have!`);
            embed
                .setTitle(command.name)
                .setDescription(`\
${command.alias !== undefined ? `Aliases: \`${command.alias.join(", ")}\`
` : ""}${command.desc ?? ""}${command.usage !== undefined ? `\`\`\`
${config.prefix}${command.name} ${command.usage}
\`\`\`` : "" }`,
                );
        }
        await message.channel.send(embed);
    },
});
