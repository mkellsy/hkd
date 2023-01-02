import AccessoryPlugin from "./plugin";
import Bridge from "./bridge";
import BridgeEvent from "./event";
import Config from "../config";
import Hub from "../hub";
import Instance from "./instance";
import PluginManager from "./manager";

import { BridgeConfig } from "../config";

function create(config: Config, settings: BridgeConfig, hub: Hub) {
    return new Bridge(config, settings, hub);
}

export default create;

export {
    AccessoryPlugin,
    Bridge,
    BridgeEvent,
    Instance,
    PluginManager,
};
