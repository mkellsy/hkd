import { LogLevel } from "homebridge/lib/logger";

interface IntermediateLogger {
    prefix?: string;
    plugin?: string;

    (message: string, ...parameters: string[]): void;

    info?(message: string, ...parameters: string[]): void;
    warn?(message: string, ...parameters: string[]): void;
    error?(message: string, ...parameters: string[]): void;
    debug?(message: string, ...parameters: string[]): void;

    log?(level: LogLevel, message: string, ...parameters: string[]): void;
    qr?(message: string): void;
}

export default IntermediateLogger;
