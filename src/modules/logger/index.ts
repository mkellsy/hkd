import Colors from "colors";
import Path from "path";
import Table from "as-table"
import Utility from "util";;
import Winston from "winston";
import QRCode from "qrcode-terminal";

import levels from "./levels";
import random from "./random";

import { message, print } from "./message";

import Background from "./background";
import ExtendedLogger from "./extended";
import IntermediateLogger from "./intermediate";
import Internal from "./internal";
import Log from "./log";
import Loggers from "./loggers";
import PluginLogger from "./plugin";
import PrefixedLogger from "./prefixed";

const transports = Winston.transports;
const internal: { [key: string]: Log } = {};
const loggers: Loggers = {};

function create(prefix: string): Log {
    const direct = Winston.createLogger({
        level: process.env.level,
        exitOnError: false,
    });

    direct.add(new Winston.transports.Console({ format: print() }));

    const logger = Winston.createLogger({
        level: process.env.level,
        exitOnError: false,
    }) as Log;

    logger.add(new Winston.transports.Console({ format: message(prefix, true, false) }));

    const grid = Table.configure({
        title: (item: string) => Colors.cyan(item),
        print: (item: string) => Colors.white(item),
        delimiter: Colors.dim(" | "),
        dash: Colors.dim("-"),
    });

    logger.json = (value: any, length?: number) => {
        direct.info(`\n${Utility.inspect(value, { colors: true, maxStringLength: length || 100 })}\n`);
    }

    logger.print = (value: any) => direct.info(value);
    logger.table = (value: any) => direct.info(`\n${grid(value)}\n`);

    logger.qr = (value: string) => {
        QRCode.generate(value, {small: true}, (code) => direct.info(`\n\n${code}\n`));
    };

    logger.strip = (text: string) => Colors.stripColors(text);
    logger.reset = (text: string) => Colors.reset(text);
    logger.bold = (text: string) => Colors.bold(text);
    logger.dim = (text: string) => Colors.dim(text);
    logger.italic = (text: string) => Colors.italic(text);
    logger.underline = (text: string) => Colors.underline(text);
    logger.inverse = (text: string) => Colors.inverse(text);
    logger.hidden = (text: string) => Colors.hidden(text);
    logger.strikethrough = (text: string) => Colors.strikethrough(text);

    logger.black = (text: string) => Colors.black(text);
    logger.red = (text: string) => Colors.red(text);
    logger.green = (text: string) => Colors.green(text);
    logger.yellow = (text: string) => Colors.yellow(text);
    logger.blue = (text: string) => Colors.blue(text);
    logger.magenta = (text: string) => Colors.magenta(text);
    logger.cyan = (text: string) => Colors.cyan(text);
    logger.white = (text: string) => Colors.white(text);
    logger.gray = (text: string) => Colors.gray(text);
    logger.rainbow = (text: string) => Colors.rainbow(text);
    logger.random = (text: string) => random(text);

    logger.bg = {
        black(text: string) {
            return Colors.bgBlack(text);
        },

        red(text: string) {
            return Colors.bgRed(text);
        },

        green(text: string) {
            return Colors.bgGreen(text);
        },

        yellow(text: string) {
            return Colors.bgYellow(text);
        },

        blue(text: string) {
            return Colors.bgBlue(text);
        },

        magenta(text: string) {
            return Colors.bgMagenta(text);
        },

        cyan(text: string) {
            return Colors.bgCyan(text);
        },

        white(text: string) {
            return Colors.bgWhite(text);
        },
    };

    return logger;
}

function cache(prefix: string): Log {
    if (!loggers[prefix]) loggers[prefix] = create(prefix);

    return loggers[prefix] as Log;
}

export default cache;

export {
    internal,
    levels,
    loggers,
    message,
    random,
};

export {
    Background,
    ExtendedLogger,
    IntermediateLogger,
    Internal,
    Log,
    Loggers,
    PluginLogger,
    PrefixedLogger,
};
