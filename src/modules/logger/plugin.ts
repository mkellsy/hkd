import { LogLevel } from "homebridge/lib/logger";

import Config from "../config";
import ExtendedLogger from "./extended";
import IntermediateLogger from "./intermediate";
import Log from "./log";
import PrefixedLogger from "./prefixed";

import { loggers } from "./";

function PluginLogger(log: Log, label: string, config: Config, plugin?: string) {
    if (!loggers[label]) {
        const logger = new PrefixedLogger(log, label, config, plugin);
        const prefixed: IntermediateLogger = logger.info.bind(logger);

        prefixed.prefix = label;
        prefixed.plugin = plugin;

        prefixed.debug = (message: string, ...parameters: string[]) => logger.debug(message, ...parameters);
        prefixed.info = (message: string, ...parameters: string[]) => logger.info(message, ...parameters);
        prefixed.warn = (message: string, ...parameters: string[]) => logger.warn(message, ...parameters);
        prefixed.error = (message: string, ...parameters: string[]) => logger.error(message, ...parameters);
        prefixed.log = (level: LogLevel, message: string, ...parameters: string[]) => logger.log(level, message, ...parameters);
        prefixed.qr = (message: string) => logger.qr(message);

        loggers[label] = <ExtendedLogger>prefixed;
    }

    return loggers[label];
}

export default PluginLogger;
