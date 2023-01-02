import Inquirer from "inquirer";
import { Command } from "commander";

import Config, { create, BridgeConfig } from "../modules/config";
import { Bridge } from "../modules/bridge";
import Cache from "../modules/cache";
import Logger from "../modules/logger";
import Sudo from "../modules/sudo";

export default function (program: Command) {
    program.command("bridge [action]")
        .alias("bridges")
        .description("manage bridges")
        .option("-c, --config <path>", "define the path to the config file")
        .option("-b, --bridge <string>", "set the bridge name")
        .option("--port <1-65535>", "define the port for a new bridge")
        .option("--pin <xxx-xxx>", "define pin for a new bridge")
        .option("--advertiser <bonjour|ciao>", "set the bridge advertiser")
        .option("--autostart <integer>", "define number of seconds to wait on start for a new bridge")
        .action(async (action: string, command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");
            const prompt: Inquirer.PromptModule = Inquirer.createPromptModule();

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            let id: string | undefined;
            let uri: string | undefined;
            let bridge: BridgeConfig | undefined;

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);

            switch (action) {
                case "pair":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);
                    uri = Cache.get(`${id}:uri`);

                    if (!bridge || !bridge.pin || !uri) {
                        log.warn("setup uri not available");

                        return;
                    }

                    log.info("scan this code the home app to pair");
                    log.debug(`setup uri ${log.cyan(uri)}`);
                    log.qr(uri);
                    log.info(`homekit pin ${log.cyan(bridge.pin)}`);
                    break;

                case "add":
                case "create":
                    bridge = await create(
                        prompt,
                        config,
                        command.bridge,
                        parseInt(command.port || "0", 10),
                        command.pin || "0314-5154",
                        parseInt(command.autostart || "0", 10),
                        command.advertiser === "ciao" ? "ciao" : "bonjour",
                    );

                    if (bridge) Config.addBridge(config, bridge);
                    break;

                case "rm":
                case "remove":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);

                    if (bridge) Config.removeBridge(config, bridge);
                    break;

                case "restart":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);

                    if (bridge) Config.touch(config, bridge);
                    break;

                default:
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    log.table(config.bridges);
                    break;
            }
        });
}
