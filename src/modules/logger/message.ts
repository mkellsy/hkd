import Colors from "colors";
import Winston from "winston";

import levels from "./levels";

const { combine, label, printf, splat, timestamp } = Winston.format;

export function message(prefix: string, colors: boolean, full: boolean) {
    return combine(
        timestamp({ format: full ? "M/D/YYYY HH:mm:ss" : "HH:mm:ss" }),
        splat(),
        label({ label: Colors.cyan(prefix.toUpperCase()) }),
        printf((info) => {
            const formatted = `${Colors.dim(info.timestamp)} ${Colors.dim("[")} ${info.label} ${Colors.dim("]")} ${levels(info.level)}${info.message}`;

            if (colors) return formatted;

            return Colors.stripColors(formatted);
        }),
    );
}

export function print() {
    return printf((info) => info.message);
}
