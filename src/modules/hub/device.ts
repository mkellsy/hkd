import { Characteristic, Formats, Perms } from "hap-nodejs";

class Device extends Characteristic {
    static readonly UUID: string = "00000003-0000-1000-8000-0026BB765291";

    constructor() {
        super("Device ID", "00000003-0000-1000-8000-0026BB765291", { format: Formats.STRING, perms: [Perms.PAIRED_READ, Perms.NOTIFY] });

        this.value = this.getDefaultValue();
    }
}

export default Device;
