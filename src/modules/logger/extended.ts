import { Logging } from "homebridge/lib/logger";

interface ExtendedLogger extends Logging {
    plugin?: string;

    qr?(value: string): void;
}

export default ExtendedLogger;
