import fs from "fs";

import chalk from "chalk";

fs.rmSync("./dist/", { recursive: true, force: true });
fs.mkdirSync("./dist/");
try {
    fs.cpSync("./src/assets/", "./dist/assets/", { recursive: true });
} catch {
    console.log(`No ${chalk.yellow("assets")} folder found.`);
}
