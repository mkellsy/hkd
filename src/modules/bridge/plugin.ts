import { AccessoryPlugin as HBAccessoryPlugin } from "homebridge/lib/api";

interface AccessoryPlugin extends HBAccessoryPlugin {
    name?: string;
    uuid_base?: string;
    identify?: (callback?: () => void) => void;
}

export default AccessoryPlugin;
