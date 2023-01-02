import { Accessory } from "hap-nodejs";
import { EventEmitter } from "events";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";

import ExtendedLogger from "../logger/extended";

interface Instance extends EventEmitter {
    running: boolean;
    log: ExtendedLogger;
    name: string;
    port: number;
    username: string;
    pin: string;
    uri: string;
    accessories: () => (PlatformAccessory | Accessory)[];
    start: () => Promise<void>;
    stop: () => Promise<void>;
    restart: () => Promise<void>;
}

export default Instance;
