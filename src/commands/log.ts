import Path from "path";
import { Command } from "commander";

import Logger from "../modules/logger";
import Config from "../modules/config";
import Sudo from "../modules/sudo";

export default function (program: Command) {
    program.command("log")
        .alias("logger")
        .description("view the hub and bridges log output")
        .option("-c, --config <path>", "define the path to the config file")
        .action(async (command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);

            log.tail(Path.resolve(config.storage.path as string, "log"));
        });
}
