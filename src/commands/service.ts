import File from "fs-extra";
import Inquirer from "inquirer";
import { Command } from "commander";

import Config, { HubConfig, initilize } from "../modules/config";
import Logger from "../modules/logger";
import Server from "../modules/server";
import Sudo from "../modules/sudo";

import * as MacOS from "../modules/server/macos";
import * as Systemd from "../modules/server/systemd";

export default function (program: Command) {
    program.command("service <action>")
        .description("manage the hkd service")
        .option("-c, --config <path>", "define the path to the config file")
        .option("--port <1-65535>", "define the port for a new bridge")
        .option("--pin <xxx-xxx>", "define pin for a new bridge")
        .option("--advertiser <bonjour|ciao>", "set the bridge advertiser")
        .option("--autostart <integer>", "define number of seconds to wait on start for a new bridge")
        .action(async (action, command: { [key: string]: string | undefined }) => {
            const log = Logger("cli");
            const prompt: Inquirer.PromptModule = Inquirer.createPromptModule();

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

            let hub: HubConfig | undefined;
            let service: string | undefined;
            let path: string | undefined;
            let load: Function | undefined;
            let unload: Function | undefined;
            let restart: Function | undefined;

            switch (process.platform) {
                case "darwin":
                    service = MacOS.LaunchDaemon;
                    path = MacOS.ServicePath;
                    load = MacOS.LoadService;
                    unload = MacOS.UnloadService;
                    restart = MacOS.RestartService;
                    break;
        
                case "linux":
                case "freebsd":
                case "openbsd":
                    if (Server.locate("systemctl")) {
                        service = Systemd.LaunchDaemon;
                        path = Systemd.ServicePath;
                        load = Systemd.LoadService;
                        unload = Systemd.UnloadService;
                        restart = Systemd.RestartService;
                    }

                    break;
            }

            const filename = Config.locate(command.config);
            const config = Config.configure(filename);

            switch (action) {
                case "install":
                    if (!config.hub || !config.hub.port) {
                        hub = await initilize(
                            prompt,
                            config,
                            parseInt(command.port || "0", 10),
                            command.pin || "0314-5154",
                            parseInt(command.autostart || "0", 10),
                            command.advertiser || "bonjour",
                        );

                        Config.save(config, hub);
                    }

                    if (service && path && load) {
                        log.info("installing the hkd service");
                        File.writeFileSync(path, service);
                        load();
                    } else if (process.platform === "linux" || process.platform === "freebsd" || process.platform === "openbsd") {
                        log.warn("service requires systemd");
                    } else {
                        log.warn(`service not supported on ${process.platform}`);
                    }

                    break;

                case "uninstall":
                    if (path && unload) {
                        log.warn("uninstalling the hkd service");
                        unload();
                        File.unlinkSync(path);
                    } else if (process.platform === "linux" || process.platform === "freebsd" || process.platform === "openbsd") {
                        log.warn("service requires systemd");
                    } else {
                        log.warn(`service not supported on ${process.platform}`);
                    }

                    break;

                case "restart":
                    if (restart) {
                        log.warn("restart the hkd service");
                        restart();
                    } else if (process.platform === "linux" || process.platform === "freebsd" || process.platform === "openbsd") {
                        log.warn("service requires systemd");
                    } else {
                        log.warn(`service not supported on ${process.platform}`);
                    }

                    break;

                default:
                    console.log(program.helpInformation());
                    break;
            }
        });
}