import { Service } from "hap-nodejs";

import Device from "./device";
import Plugin from "./plugin";

export class Information extends Service {
    constructor() {
        super("Home", "00000002-0000-1000-8000-0026BB765291");

        this.addCharacteristic(Plugin);
        this.addCharacteristic(Device);
    }
}

export default Information;
