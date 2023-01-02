import Inquirer from "inquirer";
import { Command } from "commander";

import Logger from "../modules/logger";
import { Bridge } from "../modules/bridge";
import Config from "../modules/config";
import Sudo from "../modules/sudo";

export default function (program: Command) {
    program.command("config")
        .alias("configuration")
        .description("manage plugins for a given bridge")
        .option("-c, --config <path>", "define the path to the config file")
        .option("-b, --bridge <string>", "set the bridge name")
        .action(async (command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");
            const prompt: Inquirer.PromptModule = Inquirer.createPromptModule();

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            let id: string | undefined;

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);

            id = Config.sanitize(command.bridge as string);

            if (!id) id = await Bridge.select(prompt, config);

            const bridge = config.bridges.find((entry) => entry.id === id);

            if (bridge) Config.edit(config, bridge);
        });
}
