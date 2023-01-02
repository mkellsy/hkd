import { Characteristic, Formats, Perms } from "hap-nodejs";

class Plugin extends Characteristic {
    static readonly UUID: string = "00000004-0000-1000-8000-0026BB765291";

    constructor() {
        super("Plugin ID", "00000004-0000-1000-8000-0026BB765291", { format: Formats.STRING, perms: [Perms.PAIRED_READ, Perms.NOTIFY] });

        this.value = this.getDefaultValue();
    }
}

export default Plugin;
