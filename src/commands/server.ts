import { Command } from "commander";

import Config, { Signal } from "../modules/config";
import Logger from "../modules/logger";
import Server from "../modules/server";
import Sudo from "../modules/sudo";

export default function (program: Command) {
    program.command("start")
        .description("start the hub service")
        .option("-c, --config <path>", "define the path to the config file")
        .option("-p, --port <1-65535>", "change the port the hub runs on")
        .option("--color=full", "force full color support")
        .action((command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);
            const server = new Server(config);

            [
                Signal.EXIT,
                Signal.SIGINT,
                Signal.SIGTERM,
                Signal.SIGUSR1,
                Signal.SIGUSR2,
            ].forEach((signal) => process.on(signal, () => {
                if (!server.terminating) {
                    server.stop().finally(() => {
                        log.info("good bye");

                        process.exit();
                    });
                }
            }));

            process.on("uncaughtException", (error: unknown) => /* log.warn((error as Error).message) */ console.log(error));
            process.on("unhandledRejection", (reason) => log.warn(`unhandled rejection: ${reason as string}`));

            server.start().catch((error) => log.error((error as Error).message));
        });
}