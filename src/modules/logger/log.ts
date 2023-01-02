import { Logger as BaseLogger } from "winston";

import Background from "./background";

interface Log extends BaseLogger {
    tail: (filename: string) => void;

    json: (value: any, length?: number) => void;
    print: (value: any) => void;
    table: (value: any) => void;
    qr: (value: string) => void;

    strip: (text: string) => string;
    reset: (text: string) => string;
    bold: (text: string) => string;
    dim: (text: string) => string;
    italic: (text: string) => string;
    underline: (text: string) => string;
    inverse: (text: string) => string;
    hidden: (text: string) => string;
    strikethrough: (text: string) => string;

    black: (text: string) => string;
    red: (text: string) => string;
    green: (text: string) => string;
    yellow: (text: string) => string;
    blue: (text: string) => string;
    magenta: (text: string) => string;
    cyan: (text: string) => string;
    white: (text: string) => string;
    gray: (text: string) => string;
    rainbow: (text: string) => string;
    random: (text: string) => string;

    bg: Background;
}

export default Log;
