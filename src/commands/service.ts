import File from "fs-extra";
import Inquirer from "inquirer";
import { Command } from "commander";

import Config from "../modules/config";
import Logger from "../modules/logger";
import Server from "../modules/server";
import Sudo from "../modules/sudo";

import * as MacOS from "../modules/server/macos";
import * as Systemd from "../modules/server/systemd";

export default function (program: Command) {
    program.command("service <action>")
        .description("manage the hkd service")
        .action((action) => {
            const log = Logger("cli");

            if (!Sudo()) {
                log.warn("you are running in user mode, did you forget to use 'sudo'?");

                return;
            }

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

            switch (action) {
                case "install":
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