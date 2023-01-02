import Utility from "util";

import Config from "../config";
import Log from "./log";
import Internal from "./internal";

import Logger, { internal } from "./";
import { LogLevel } from "homebridge/lib/logger";

class PrefixedLogger {
    private logger: Log;

    constructor(log: Log, label: string, config: Config, plugin?: string) {
        let cloned = internal[label];

        if (!cloned) {
            cloned = Logger(label);
            cloned.level = log.level;

            Internal.transports(cloned, label, config, plugin);
        }

        this.logger = cloned;
    }

    public static clense(message: string, ...parameters: string[]) {
        if (typeof message === "string") {
            if (!message || message === "") return undefined;

            if (message.match(/^(?=.*\binitializing\b)(?=.*\bhap-nodejs\b).*$/gmi)) return undefined;

            if (message.match(/^(?=.*\bhoobs\b)(?=.*\bhomebridge\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\brecommended\b)(?=.*\bnode\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\brecommended\b)(?=.*\bhomebridge\b).*$/gmi)) return undefined;

            if (message.match(/^(?=.*\bfetching snapshot took\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\baccessory is slow to respond\b).*$/gmi)) return undefined;

            if (message.match(/^(?=.*\bwarning\b)(?=.*\bworkspaces\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\bwarning\b)(?=.*\brequest\b)(?=.*\bdeprecated\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\bwarning\b)(?=.*\brequest\b)(?=.*\bsupported\b).*$/gmi)) return undefined;
            if (message.match(/^(?=.*\bwarning\b)(?=.*\brequest\b)(?=.*\bupgrade\b).*$/gmi)) return undefined;

            message = Utility.format(message.replace(/Homebridge/g, "Bridge"), ...parameters);
        }

        return message;
    }

    public log(level: LogLevel, message: string, ...parameters: string[]): void {
        message = PrefixedLogger.clense(message, ...parameters) as string;

        if (!message) return;

        switch (level) {
            case LogLevel.WARN:
                this.logger.warn(message);
                break;

            case LogLevel.ERROR:
                this.logger.error(message);
                break;

            case LogLevel.DEBUG:
                this.logger.debug(message);
                break;

            default:
                this.logger.info(message);
                break;
        }
    }

    debug(message: string, ...parameters: string[]): void {
        this.log(LogLevel.DEBUG, message, ...parameters);
    }

    info(message: string, ...parameters: string[]): void {
        this.log(LogLevel.INFO, message, ...parameters);
    }

    warn(message: string, ...parameters: string[]): void {
        this.log(LogLevel.WARN, message, ...parameters);
    }

    error(message: string, ...parameters: string[]): void {
        this.log(LogLevel.ERROR, message, ...parameters);
    }

    qr(message: string): void {
        this.logger.qr(message);
    }
}

export default PrefixedLogger;
