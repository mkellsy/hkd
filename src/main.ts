import { resolve } from "path";
import { program } from "commander";
import { readJsonSync } from "fs-extra";

import Logger from "./modules/logger";

import BridgeCommand from "./commands/bridges";
import ConfigCommand from "./commands/config";
import PluginCommand from "./commands/plugins";
import ServerCommand from "./commands/server";
import ServiceCommand from "./commands/service";

process.env.level = "info";

interface PackageJson {
    [key: string]: string | number | boolean;
}

export = function Main(args?: string[] | undefined): void {
    program.version((readJsonSync(resolve(__dirname, "../package.json")) as PackageJson).version as string, "-v, --version", "output the current version");
    program.option("-d, --debug", "turn on debug level logging", () => { process.env.level = "debug"; });

    const log = Logger("main");

    console.log = (message: string) => log.info(message);
    console.info = (message: string) => log.info(message);
    console.warn = (message: string) => log.warn(message);
    console.error = (message: string) => log.error(message);
    console.debug = (message: string) => log.debug(message);

    ServerCommand(program);
    BridgeCommand(program);
    PluginCommand(program);
    ConfigCommand(program);
    ServiceCommand(program);

    program.parse(args || process.argv);
};
