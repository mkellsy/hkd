import Path from "path";
import Winston from "winston";

import Config from "../config";
import Logger from "./";
import Log from "./log";

import { message } from "./message";

const transports = Winston.transports;

class Internal {
    public static create(label: string) {
        return Logger(label);
    }

    public static transports(log: Log, label: string, config: Config, plugin?: string) {
        log.add(new transports.File({
            filename: Path.resolve(config.storage.path as string, "log"),
            maxsize: (config.storage.logsize || 10) * 1000000,
            maxFiles: 10,
            tailable: true,
            level: "debug",
            format: message(label),
        }));
    }
}

export default Internal;
