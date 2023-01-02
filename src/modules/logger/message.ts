import Colors from "colors";
import Winston from "winston";

import levels from "./levels";

const { combine, label, printf, splat, timestamp } = Winston.format;

export function message(prefix: string) {
    return combine(
        timestamp({ format: "M/D/YYYY HH:mm:ss" }),
        splat(),
        label({ label: Colors.cyan(prefix.toUpperCase()) }),
        printf((info) => {
            return `${Colors.dim(info.timestamp)} ${Colors.dim("[")} ${info.label} ${Colors.dim("]")} ${levels(info.level)}${info.message}`;
        }),
    );
}

export function print() {
    return printf((info) => info.message);
}
