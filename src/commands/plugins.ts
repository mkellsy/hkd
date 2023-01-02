import Inquirer from "inquirer";
import { Command } from "commander";

import Logger from "../modules/logger";
import { Bridge } from "../modules/bridge";
import Config, { BridgeConfig } from "../modules/config";
import Plugins, { PluginDetails } from "../modules/plugins";
import Sudo from "../modules/sudo";

export default function (program: Command) {
    program.command("plugin [action] [name]")
        .alias("plugins")
        .description("manage plugins for a given bridge")
        .option("-c, --config <path>", "define the path to the config file")
        .option("-b, --bridge <string>", "set the bridge name")
        .action(async (action: string, name: string, command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");
            const prompt: Inquirer.PromptModule = Inquirer.createPromptModule();

            let id: string | undefined;
            let bridge: BridgeConfig | undefined;
            let plugin: PluginDetails | undefined;
            let plugins;

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);

            switch (action) {
                case "add":
                case "install":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);
                    plugin = Plugins.details(Plugins.parse(name, config));

                    if (bridge && plugin) {
                        log.info(`installing ${log.cyan(plugin.identifier)} at ${log.cyan(plugin.tag)} on ${log.cyan(bridge.name)}`);

                        await Plugins.install(config, bridge, plugin);

                        plugins = Plugins.installed(config);

                        if (plugins.length > 0) log.table(plugins);
                    }

                    break;

                case "rm":
                case "remove":
                case "uninstall":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);
                    plugin = Plugins.details(Plugins.parse(name, config));

                    if (bridge && plugin) {
                        log.info(`uninstalling ${log.cyan(plugin.identifier)} from ${log.cyan(bridge.name)}`);

                        await Plugins.uninstall(config, bridge, plugin);

                        plugins = Plugins.installed(config);

                        if (plugins.length > 0) {
                            log.table(plugins);
                        } else {
                            log.warn("no plugins defined");
                        }
                    }

                    break;

                case "update":
                case "upgrade":
                    if (config.bridges.length === 0) {
                        log.warn("no bridges defined");

                        return;
                    }

                    id = Config.sanitize(command.bridge as string);

                    if (!id) id = await Bridge.select(prompt, config);

                    bridge = config.bridges.find((entry) => entry.id === id);
                    plugin = Plugins.details(Plugins.parse(name, config));

                    if (bridge && plugin) {
                        log.info(`upgrading ${log.cyan(plugin.identifier)} to ${log.cyan(plugin.tag)} on ${log.cyan(bridge.name)}`);

                        await Plugins.upgrade(config, bridge, plugin);

                        plugins = Plugins.installed(config);

                        if (plugins.length > 0) log.table(plugins);
                    }

                    break;

                default:
                    plugins = Plugins.installed(config);

                    if (plugins.length === 0) {
                        log.warn("no plugins defined");

                        return;
                    }

                    log.table(plugins);
                    break;
            }
        });
}
