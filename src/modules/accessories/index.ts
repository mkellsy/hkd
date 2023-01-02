import {
    Bridge,
    Accessory,
    MacAddress,
} from "hap-nodejs";

import { createHash } from "crypto";
import { PlatformAccessory } from "homebridge/lib/platformAccessory";

export default class Accessories {
    public bridges: Bridge[] = [];
    public hap: (PlatformAccessory | Accessory)[] = [];
    public platform: PlatformAccessory[] = [];
    public unbridged: Map<MacAddress, PlatformAccessory> = new Map();

    private readonly bridge: string;

    constructor(bridge: string) {
        this.bridge = bridge;
    }

    static identifier(bridge: string, id?: string): string {
        const hash = createHash("md5").update(`${bridge}-${id || ""}`).digest("hex");

        return `${hash.substring(0, 8)}-${hash.substring(8, 4)}-${hash.substring(12, 4)}-${hash.substring(16, 4)}-${hash.substring(20)}`;
    }
}
