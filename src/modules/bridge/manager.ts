import { HomebridgeAPI, PluginIdentifier } from "homebridge/lib/api";
import { Plugin } from "homebridge/lib/plugin";
import { PluginManagerOptions, PluginManager as HBPluginManager } from "homebridge/lib/pluginManager";

class PluginManager extends HBPluginManager {
    constructor(api: HomebridgeAPI, options?: PluginManagerOptions) {
        super(api, options);
    }

    get pluginMap(): Map<PluginIdentifier, Plugin> {

        /*
         * Homebridge doesn't expose a method to get a list of
         * currently installed/running plugins. This override
         * exposes the plugins loaded into the manager.
         */

        // @ts-ignore
        return this.plugins;
    }

    get initializingPlugin(): Plugin {

        /*
         * Homebridge doesn't let you know what plugin is loading.
         * This override exposes the current loading plugin.
         */

        // @ts-ignore
        return this.currentInitializingPlugin;
    }

    set initializingPlugin(plugin: Plugin | undefined) {

        /*
         * Homebridge doesn't allow you to custom load a plugin from
         * source. This override allow you to load code as a plugin
         * and set the current loading plugin while it is loading.
         */

        // @ts-ignore
        this.currentInitializingPlugin = plugin;
    }
}

export default PluginManager;
