import BridgeConfig from "./bridge";
import HubConfig from "./hub";

interface ConfigFile {
    hub?: HubConfig;
    bridges?: BridgeConfig[];
}

export default ConfigFile;
