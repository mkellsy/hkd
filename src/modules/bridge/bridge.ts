import Path from "path";
import Yaml from "yaml";
import File from "fs-extra";
import Watcher from "chokidar";

import { gzipSync, gunzipSync } from "zlib";
import { EventEmitter } from "events";
import { execSync } from "child_process";
import { uuid, once } from "hap-nodejs";
import { PromptModule } from "inquirer";

import {
    AccessoryLoader,
    Categories,
    Accessory,
    AccessoryEventTypes,
    Service,
    Characteristic,
    CharacteristicEventTypes,
} from "hap-nodejs";

import { Bridge as HAPBridge } from "hap-nodejs";
import { PlatformAccessory, SerializedPlatformAccessory } from "homebridge/lib/platformAccessory";
import { ExternalPortService as HBExternalPorts } from "homebridge/lib/externalPortService";

import {
    HomebridgeAPI,
    AccessoryIdentifier,
    AccessoryName,
    InternalAPIEvent,
    AccessoryPluginConstructor,
    PlatformPluginConstructor,
    StaticPlatformPlugin,
    PlatformIdentifier,
    PlatformPlugin,
    PlatformName,
} from "homebridge/lib/api";

import { HomebridgeConfig as HBConfig } from "homebridge/lib/bridgeService";
import { Plugin as HBPlugin } from "homebridge/lib/plugin";
import { Logger as HBLogger, Logging } from "homebridge/lib/logger";
import { User as HBUser } from "homebridge/lib/user";
import * as HBUsername from "homebridge/lib/util/mac";

import filterConfig from "../config/filter";

import Accessories from "../accessories";
import AccessoryPlugin from "./plugin";
import BridgeEvent from "./event";
import Cache from "../cache";
import Config, { BridgeConfig } from "../config";
import ExtendedLogger from "../logger/extended";
import Hub from "../hub";
import Plugins from "../plugins";
import PluginManager from "./manager";
import SandboxConfig from "../config/sandbox";

import { Device, Information, Plugin } from "../hub";
import Logger, { Internal, Log, PluginLogger } from "../logger";

export class Bridge extends EventEmitter {
    public log: ExtendedLogger;
    public running = false;

    private internal: Log;
    private bridge: HAPBridge | undefined;
    private config: Config;
    private development = false;
    private externalPorts: HBExternalPorts | undefined;
    private homebridge: HomebridgeAPI | undefined;
    private hub: Hub;
    private instance: HBConfig | undefined;
    private pluginManager: PluginManager | undefined;
    private records: Accessories | undefined;
    private settings: BridgeConfig;
    private setup: string | undefined;
    private storage: string;
    private url: string | undefined;
    private watchers: Record<string, Watcher.FSWatcher> = {};

    constructor(config: Config, settings: BridgeConfig, hub: Hub) {
        super();

        this.internal = Logger("bridge");
        this.config = config;
        this.hub = hub;
        this.settings = settings;
        this.storage = Path.resolve(this.config.storage.path as string, this.settings.id);
        this.url = Cache.get<string>(`${this.settings.id}:uri`) || undefined;
        this.setup = Cache.get<string>(`${this.settings.id}:setup_id`);

        Internal.transports(this.internal, "bridge", this.config);

        this.log = PluginLogger(this.internal, this.settings.name, this.config) as ExtendedLogger;

        this.ensurePackage();

        /*
         * Homebridge is uber stupid sometimes. There is no reason why set storage
         * can't be called more than once. This override ensures it won't throw an
         * exception for resetting a variable. (They don't even give you a readonly)
         *
         * This needs to be reset when the sandbox is restarted. If the VM is not
         * reinitilized, including the storage path, some signatures will point to
         * the previous instance.
         */

        // @ts-ignore
        HBUser.storageAccessed = false;

        HBUser.setStoragePath(this.storage);
        HBLogger.setTimestampEnabled(false);

        if (process.env.level === "debug") HBLogger.setDebugEnabled(true);

        /*
         * Homebridge doesn't give you a way to plugin a proper logger. This
         * override allows us to use Watson like the rest of this project.
         */

        // @ts-ignore
        HBLogger.internal = this.log;

        this.running = false;
        this.development = this.settings.type === "development" || this.settings.type === "dev";
    }

    public static async select(prompt: PromptModule, config: Config) {
        let bridges = config.bridges.map((item) => ({ name: item.name, value: item.id }));

        const questions = [{
            type: "list",
            name: "bridge",
            message: "Please select an bridge",
            choices: bridges,
        }];
    
        const input = (await prompt(questions)) as Record<string, any>;
    
        return input.bridge as string;
    }

    public get name() {
        return this.settings.name;
    }

    public get port() {
        return this.settings.port;
    }

    public get username() {
        return this.settings.username;
    }

    public get pin() {
        return this.settings.pin;
    }

    public get uri() {
        return this.url;
    }

    public get accessories(): (PlatformAccessory | Accessory)[] {
        return [...(this.records as Accessories).hap, ...(this.records as Accessories).platform ];
    }

    public async start(): Promise<void> {
        if (!this.running) {
            const promises: Promise<void>[] = [];

            this.instance = this.loadConfig();
            this.externalPorts = new HBExternalPorts();
            this.homebridge = new HomebridgeAPI();
            this.records = new Accessories(this.settings.id);

            this.homebridge.removeAllListeners(InternalAPIEvent.REGISTER_PLATFORM_ACCESSORIES);
            this.homebridge.removeAllListeners(InternalAPIEvent.UPDATE_PLATFORM_ACCESSORIES);
            this.homebridge.removeAllListeners(InternalAPIEvent.UNREGISTER_PLATFORM_ACCESSORIES);
            this.homebridge.removeAllListeners(InternalAPIEvent.PUBLISH_EXTERNAL_ACCESSORIES);

            this.homebridge.on(InternalAPIEvent.REGISTER_PLATFORM_ACCESSORIES, (accessories) => this.registerPlatform(accessories));
            this.homebridge.on(InternalAPIEvent.UPDATE_PLATFORM_ACCESSORIES, () => this.saveCache());
            this.homebridge.on(InternalAPIEvent.UNREGISTER_PLATFORM_ACCESSORIES, (accessories) => this.unregisterPlatform(accessories));
            this.homebridge.on(InternalAPIEvent.PUBLISH_EXTERNAL_ACCESSORIES, (accessories) => this.publishExternal(accessories));

            this.pluginManager = new PluginManager(this.homebridge, { customPluginPath: Path.resolve(this.storage, "node_modules") });

            this.bridge = new HAPBridge(this.settings.name, uuid.generate("HomeKit"));

            if (!File.existsSync(Path.join(this.storage, "node_modules", "hap-nodejs"))) execSync("npm install --ignore-engines hap-nodejs", { cwd: this.storage });

            this.loadCache();

            const plugins = Plugins.load(this.config, this.settings, this.development);

            for (let i = 0; i < plugins.length; i += 1) {
                if (File.existsSync(Path.join(plugins[i].directory, plugins[i].library))) {
                    if (!this.pluginManager.pluginMap.get(plugins[i].identifier)) {
                        if (this.development) {
                            this.log.info(`development plugin ${this.internal.cyan(plugins[i].name)}`);
                            this.log.info(`project path ${this.internal.cyan(plugins[i].directory)}`);
                        }

                        const plugin = new HBPlugin(plugins[i].name, plugins[i].directory, plugins[i].pjson, plugins[i].scope);
                        this.pluginManager.pluginMap.set(plugins[i].identifier, plugin);

                        try {
                            await plugin.load();

                            this.log.info(`Loaded plugin '${plugins[i].identifier}'`);
                        } catch (error) {
                            this.log.error(`Error loading plugin "${plugins[i].identifier}"`);
                            this.log.error((error as Error).message || "");

                            this.pluginManager.pluginMap.delete(plugins[i].identifier);
                        }

                        if (this.pluginManager.pluginMap.get(plugins[i].identifier)) {
                            try {
                                this.pluginManager.initializingPlugin = plugin;

                                await plugin.initialize(this.homebridge);
                            } catch (error) {
                                this.log.error(`Error initializing plugin '${plugins[i].identifier}'`);
                                this.log.error((error as Error).stack || "");

                                this.pluginManager.pluginMap.delete(plugins[i].identifier);
                            }
                        }
                    }
                }
            }

            this.pluginManager.initializingPlugin = undefined;

            if (this.pluginManager.pluginMap.size === 0) this.log.warn("no plugins installed");
            if (this.instance.platforms.length > 0) promises.push(...this.loadPlatforms());
            if (this.instance.accessories.length > 0) this.loadAccessories();

            this.restoreAccessories();
            this.homebridge.signalFinished();

            await Promise.allSettled(promises);

            this.publishBridge();
            this.running = true;

            if (this.watchers.package) await this.watchers.package.close();

            this.watchers.package = Watcher.watch(Path.resolve(this.storage, "package.json"));
            this.watchers.package.removeAllListeners("change");

            this.watchers.package.on("change", () => setTimeout(() => {
                this.hub.emit(BridgeEvent.RestartBridge, this.settings.id);
            }, 100));

            if (this.watchers.config) await this.watchers.config.close();

            this.emit(BridgeEvent.Listening, this.settings.port);
        }
    }

    public async stop(): Promise<void> {
        if (this.running) {
            this.running = false;

            const waits: Promise<void>[] = [];

            waits.push((this.bridge as HAPBridge).unpublish());

            if (this.watchers.package) waits.push(this.watchers.package.close());
            if (this.watchers.config) waits.push(this.watchers.config.close());

            for (const accessory of (this.records as Accessories).unbridged.values()) {
                waits.push(accessory._associatedHAPAccessory.unpublish());
            }

            this.saveCache();

            (this.homebridge as HomebridgeAPI).signalShutdown();

            await Promise.allSettled(waits);

            this.emit(BridgeEvent.Shutdown);
        }
    }

    private publishBridge(): void {
        const info = (this.bridge as HAPBridge).getService(Service.AccessoryInformation)!;

        info.setCharacteristic(Characteristic.Manufacturer, "Home");
        info.setCharacteristic(Characteristic.Model, "Home");
        info.setCharacteristic(Characteristic.SerialNumber, this.settings.username as string);
        info.setCharacteristic(Characteristic.FirmwareRevision, this.config.version.bridge);

        (this.bridge as HAPBridge).publish({
            username: this.settings.username as string,
            port: this.settings.port,
            pincode: Config.pincode(this.settings.pin),
            category: Categories.BRIDGE,
            bind: "0.0.0.0",
            setupID: this.setup,
            addIdentifyingMaterial: true,
            advertiser: this.config.getAdvertiser(this.settings),
        });

        this.setup = this.bridge?._setupID as string;
        this.url = this.bridge?.setupURI();

        Cache.set(`${this.settings.id}:setup_id`, this.setup, 3 * 365 * 24 * 60);
        Cache.set(`${this.settings.id}:uri`, this.url, 3 * 365 * 24 * 60);

        this.emit(BridgeEvent.PublishBridge, this.url);
    }

    private ensurePackage(): void {
        File.ensureDirSync(this.storage);

        let pjson = {
            name: "plugins",
            description: "HomeKit Plugins",
            version: (new Date()).getTime().toString(),
            private: true,
            dependencies: {},
        };

        if (File.existsSync(Path.join(this.storage, "package.json"))) pjson = { ...pjson, ...(File.readJSONSync(Path.resolve(this.storage, "package.json"))) };

        File.writeFileSync(Path.resolve(this.storage, "package.json"), JSON.stringify(pjson, undefined, 4));
    }

    public static loadConfig(config: Config, bridge: BridgeConfig, unmap?: boolean) {
        let sandbox: { [key: string]: any } = {
            accessories: [],
            platforms: [],
        };
    
    
        if (File.existsSync(Path.join(config.storage.path as string, `${bridge.id}.yaml`))) {
            sandbox = { ...(Yaml.parse(File.readFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`), "utf-8")) || {}) } as SandboxConfig;
    
            if (unmap) {
                for (let i = 0; i < (sandbox.accessories as { [key: string]: any }[]).length; i += 1) {
                    delete ((sandbox.accessories as { [key: string]: any }[])[i] as { [key: string]: any }).plugin_map;
                }
    
                for (let i = 0; i < (sandbox.platforms as { [key: string]: any }[]).length; i += 1) {
                    delete ((sandbox.platforms as { [key: string]: any }[])[i] as { [key: string]: any }).plugin_map;
                }
            }
    
            const keys = Object.keys(sandbox);
    
            for (let i = 0; i < keys.length; i += 1) {
                if (keys[i] !== "accessories" && keys[i] !== "platforms") delete sandbox[keys[i]];
            }
        }

        return sandbox as SandboxConfig;
    }

    private loadConfig() {
        const storage = this.config.storage.path as string;

        let config: HBConfig = {
            bridge: {
                name: this.settings.name,
                username: this.settings.username as string,
                pin: this.settings.pin as string,
                advertiser: this.config.getAdvertiser(this.settings),
                port: this.settings.port,
                bind: "0.0.0.0",
                manufacturer: "Home",
                model: "Home",
                disableIpc: true,
            },
            accessories: [],
            platforms: [],
        };

        if (File.existsSync(Path.join(storage, `${this.settings.id}.yaml`))) {
            config = { ...(Yaml.parse(File.readFileSync(Path.resolve(storage, `${this.settings.id}.yaml`), "utf-8")) || {}) } as HBConfig;
        }

        for (let i = 0; i < config.accessories.length; i += 1) {
            delete config.accessories[i].plugin_map;
        }

        for (let i = 0; i < config.platforms.length; i += 1) {
            delete config.platforms[i].plugin_map;
        }

        return config;
    }

    public static touchConfig(config: Config, bridge: BridgeConfig) {
        const current = File.readFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`));

        File.writeFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`), current);
        Config.increaseVersion(config, bridge);
    }

    public static saveConfig(config: Config, bridge: BridgeConfig, current: SandboxConfig, updated: { [key: string]: any }) {
        updated.accessories = updated.accessories || [];
        updated.platforms = updated.platforms || [];
    
        filterConfig(updated.accessories);
        filterConfig(updated.platforms);
    
        const maps: { [key: string]: { [key: string]: string } } = { accessories: {}, platforms: {} };
    
        for (let i = 0; i < current.accessories.length; i += 1) {
            if ((current.accessories[i].plugin_map as { [key: string]: any })?.plugin_name) {
                maps.accessories[current.accessories[i].accessory] = (current.accessories[i].plugin_map as { [key: string]: any }).plugin_name;
            }
        }
    
        for (let i = 0; i < current.platforms.length; i += 1) {
            if ((current.platforms[i].plugin_map as { [key: string]: any })?.plugin_name) {
                maps.platforms[current.platforms[i].platform] = (current.platforms[i].plugin_map as { [key: string]: any }).plugin_name;
            }
        }
    
        for (let i = 0; i < (updated.accessories as { [key: string]: any }[]).length; i += 1) {
            if (maps.accessories[((updated.accessories as { [key: string]: any }[])[i] as { [key: string]: any }).accessory as string]) {
                ((updated.accessories as { [key: string]: any }[])[i] as { [key: string]: any }).plugin_map = {
                    plugin_name: maps.accessories[((updated.accessories as { [key: string]: any }[])[i] as { [key: string]: any }).accessory as string],
                };
            }
        }
    
        for (let i = 0; i < (updated.platforms as { [key: string]: any }[]).length; i += 1) {
            if (maps.platforms[((updated.platforms as { [key: string]: any }[])[i] as { [key: string]: any }).platform as string]) {
                ((updated.platforms as { [key: string]: any }[])[i] as { [key: string]: any }).plugin_map = {
                    plugin_name: maps.platforms[((updated.platforms as { [key: string]: any }[])[i] as { [key: string]: any }).platform as string],
                };
            }
        }
    
        const keys = Object.keys(updated);
    
        for (let i = 0; i < keys.length; i += 1) {
            if (keys[i] !== "accessories" && keys[i] !== "platforms") delete updated[keys[i]];
        }
    
        File.writeFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`), Yaml.stringify(updated));
    }

    private loadAccessories(): void {
        this.log.info(`loading ${this.internal.cyan((this.instance as HBConfig).accessories.length.toString())} accessories...`);

        (this.instance as HBConfig).accessories.forEach((accessoryConfig) => {
            if (!accessoryConfig.accessory) return;

            const accessoryIdentifier: AccessoryName | AccessoryIdentifier = accessoryConfig.accessory;
            const displayName = accessoryConfig.name;

            if (!displayName) return;

            let plugin: HBPlugin;
            let constructor: AccessoryPluginConstructor;

            try {
                plugin = (this.pluginManager as PluginManager).getPluginForAccessory(accessoryIdentifier);
                constructor = plugin.getAccessoryConstructor(accessoryIdentifier);
            } catch (_error) {
                return;
            }

            const logger = PluginLogger(this.internal, displayName, this.config, plugin.getPluginIdentifier()) as ExtendedLogger;
            const accessoryInstance: AccessoryPlugin = new constructor(logger as ExtendedLogger, accessoryConfig, (this.homebridge as HomebridgeAPI));
            const accessory = this.create(plugin, accessoryInstance, displayName, accessoryIdentifier, accessoryConfig.uuid_base);

            if (accessory) {
                Cache.remove(`bridge/${this.settings.id}/accessories`);

                (this.records as Accessories).hap.push(accessory);

                this.bridge?.addBridgedAccessory(accessory);
            } else {
                logger(`accessory ${accessoryIdentifier} returned empty set of services`);
            }
        });
    }

    private loadPlatforms(): Promise<void>[] {
        this.log.info(`loading ${this.internal.cyan((this.instance as HBConfig).platforms.length.toString())} platforms...`);

        const promises: Promise<void>[] = [];

        (this.instance as HBConfig).platforms.forEach((platformConfig) => {
            if (!platformConfig.platform) return;

            const platformIdentifier: PlatformName | PlatformIdentifier = platformConfig.platform;
            const displayName = platformConfig.name || platformIdentifier;

            let plugin: HBPlugin;
            let constructor: PlatformPluginConstructor;

            try {
                plugin = (this.pluginManager as PluginManager).getPluginForPlatform(platformIdentifier);
                constructor = plugin.getPlatformConstructor(platformIdentifier);
            } catch (error) {
                return;
            }

            const logger = PluginLogger(this.internal, displayName, this.config, plugin.getPluginIdentifier());
            const platform: PlatformPlugin = new constructor(logger as ExtendedLogger, platformConfig, (this.homebridge as HomebridgeAPI));

            if (HomebridgeAPI.isDynamicPlatformPlugin(platform)) {
                plugin.assignDynamicPlatform(platformIdentifier, platform);
            } else if (HomebridgeAPI.isStaticPlatformPlugin(platform)) {
                promises.push(this.loadPlatformAccessories(plugin, platform, platformIdentifier, logger as ExtendedLogger));
            }
        });

        return promises;
    }

    private async loadPlatformAccessories(plugin: HBPlugin, platformInstance: StaticPlatformPlugin, platformType: PlatformName | PlatformIdentifier, logger: Logging): Promise<void> {
        return new Promise((resolve) => {
            platformInstance.accessories(once((accessories: AccessoryPlugin[]) => {
                accessories.forEach((accessoryInstance, index) => {
                    const accessoryName = accessoryInstance.name as string;
                    const uuidBase: string | undefined = accessoryInstance.uuid_base;
                    const accessory = this.create(plugin, accessoryInstance, accessoryName, platformType, uuidBase);

                    if (accessory) {
                        Cache.remove(`bridge/${this.settings.id}/accessories`);

                        (this.records as Accessories).hap.push(accessory);

                        this.bridge?.addBridgedAccessory(accessory);
                    } else {
                        logger(`platform %${platformType} returned an accessory at index ${index} with an empty set of services`);
                    }
                });

                resolve();
            }));
        });
    }

    private registerPlatform(accessories: PlatformAccessory[]): void {
        const hapAccessories = accessories.map((accessory) => {
            const plugin = (this.pluginManager as PluginManager).getPlugin(accessory._associatedPlugin!);
            const service = new Information();

            Cache.remove(`bridge/${this.settings.id}/accessories`);

            if (plugin) service.updateCharacteristic(Plugin, plugin.getPluginIdentifier());

            service.updateCharacteristic(Device, accessory.UUID);
            accessory.addService(service);

            (this.records as Accessories).platform.push(accessory);

            if (plugin) {
                const informationService = accessory.getService(Service.AccessoryInformation)!;

                if (informationService.getCharacteristic(Characteristic.FirmwareRevision).value === "0.0.0") informationService.setCharacteristic(Characteristic.FirmwareRevision, plugin.version);

                const platforms = plugin.getActiveDynamicPlatform(accessory._associatedPlatform!);

                if (!platforms) this.log.warn(`platform ${this.internal.cyan(accessory._associatedPlatform as string)}" for plugin ${this.internal.cyan(accessory._associatedPlugin as string)} not found`);
            } else {
                this.log.warn(`plugin ${this.internal.cyan(accessory._associatedPlugin as string)} not found`);
            }

            return accessory._associatedHAPAccessory;
        });

        this.bridge?.addBridgedAccessories(hapAccessories);
        this.saveCache();
    }

    private unregisterPlatform(accessories: PlatformAccessory[]): void {
        const hapAccessories = accessories.map((accessory) => {
            const index = (this.records as Accessories).platform.indexOf(accessory);

            Cache.remove(`bridge/${this.settings.id}/accessories`);

            if (index >= 0) (this.records as Accessories).platform.splice(index, 1);

            return accessory._associatedHAPAccessory;
        });

        this.bridge?.removeBridgedAccessories(hapAccessories);
        this.saveCache();
    }

    private publishExternal(accessories: PlatformAccessory[]): void {
        for (let i = 0; i < accessories.length; i += 1) {
            const accessory = accessories[i]._associatedHAPAccessory;
            const username = HBUsername.generate(accessory.UUID);

            if ((this.records as Accessories).unbridged.has(username)) {
                this.log.error(`accessory ${accessory.displayName} experienced an address collision`);
            } else {
                const plugin = (this.pluginManager as PluginManager).getPlugin(accessories[i]._associatedPlugin!);
                const service = new Information();

                (this.records as Accessories).unbridged.set(username, accessories[i]);

                if (plugin) service.updateCharacteristic(Plugin, plugin.getPluginIdentifier());

                service.updateCharacteristic(Device, accessory.UUID);
                accessory.addService(service);

                if (plugin) {
                    const informationService = accessory.getService(Service.AccessoryInformation)!;

                    if (informationService.getCharacteristic(Characteristic.FirmwareRevision).value === "0.0.0") informationService.setCharacteristic(Characteristic.FirmwareRevision, plugin.version);

                    accessory.on(AccessoryEventTypes.LISTENING, (port: number) => this.log.info(`${accessory.displayName} is running on port ${port}`));

                    Cache.remove(`bridge/${this.settings.id}/accessories`);

                    (this.records as Accessories).hap.push(accessory);

                    (this.externalPorts as HBExternalPorts).requestPort(username).then((port) => {
                        accessory.publish({
                            username,
                            pincode: Config.pincode(this.settings.pin),
                            category: accessories[i].category,
                            port,
                            bind: "0.0.0.0",
                            addIdentifyingMaterial: true,
                            advertiser: this.config.getAdvertiser(this.settings),
                        }, true);
                    }).catch((error) => this.log.error((error as Error).message));
                } else {
                    this.log.warn(`plugin ${this.internal.cyan(accessories[i]._associatedPlugin as string)} not found`);
                }
            }
        }
    }

    private create(plugin: HBPlugin, accessoryInstance: AccessoryPlugin, displayName: string, accessoryType: AccessoryName | AccessoryIdentifier, uuidBase?: string): Accessory | undefined {
        const services = (accessoryInstance.getServices() || []).filter((service) => !!service);
        const controllers = (accessoryInstance.getControllers ? accessoryInstance.getControllers() || [] : []).filter((controller) => !!controller);

        if (services.length === 0 && controllers.length === 0) return undefined;

        if (!(services[0] instanceof Service)) {
            return AccessoryLoader.parseAccessoryJSON({ displayName, services });
        }

        const accessory = new Accessory(displayName, uuid.generate(`${accessoryType}:${uuidBase || displayName}`));
        const service = new Information();

        if (plugin) service.updateCharacteristic(Plugin, plugin.getPluginIdentifier());

        service.updateCharacteristic(Device, accessory.UUID);
        accessory.addService(service);

        if (accessoryInstance.identify) {
            accessory.on(AccessoryEventTypes.IDENTIFY, (_paired, callback) => {
                accessoryInstance.identify!(() => { });

                callback();
            });
        }

        const informationService = accessory.getService(Service.AccessoryInformation)!;

        services.forEach((service: any) => {
            if (service instanceof Service.AccessoryInformation) {
                service.setCharacteristic(Characteristic.Name, displayName);
                service.getCharacteristic(Characteristic.Identify).removeAllListeners(CharacteristicEventTypes.SET);

                informationService.replaceCharacteristicsFromService(service);
            } else {
                accessory.addService(service);
            }
        });

        if (informationService.getCharacteristic(Characteristic.FirmwareRevision).value === "0.0.0") informationService.setCharacteristic(Characteristic.FirmwareRevision, plugin.version);

        controllers.forEach((controller) => accessory.configureController(controller));

        return accessory;
    }

    private restoreAccessories(): void {
        Cache.remove(`bridge/${this.settings.id}/accessories`);

        (this.records as Accessories).platform = (this.records as Accessories).platform.filter((accessory) => {
            let plugin = (this.pluginManager as PluginManager).getPlugin(accessory._associatedPlugin!);

            if (!plugin) {
                try {
                    plugin = (this.pluginManager as PluginManager).getPluginByActiveDynamicPlatform(accessory._associatedPlatform!);

                    if (plugin) accessory._associatedPlugin = plugin.getPluginIdentifier();
                } catch (error) {
                    this.log.info(`could not find the associated plugin for accessory ${this.internal.cyan(accessory.displayName)}`);
                }
            }

            const platformPlugins = plugin && plugin.getActiveDynamicPlatform(accessory._associatedPlatform!);

            if (!platformPlugins) {
                this.log.info(`Failed to find plugin for accessory ${this.internal.cyan(accessory._associatedHAPAccessory.displayName)}`);

                return false;
            }

            accessory.getService(Service.AccessoryInformation)!.setCharacteristic(Characteristic.FirmwareRevision, plugin!.version);

            platformPlugins.configureAccessory(accessory);

            try {
                this.bridge?.addBridgedAccessory(accessory._associatedHAPAccessory);
            } catch (_error) {
                return false;
            }

            return true;
        });
    }

    private loadCache(): void {
        const storage = this.config.storage.path as string;

        let backup: SerializedPlatformAccessory[] = [];
        let cached: SerializedPlatformAccessory[] = [];

        if (File.existsSync(Path.resolve(storage, `${this.settings.id}.accessories.bak`))) {
            try {
                const content = File.readFileSync(Path.resolve(storage, `${this.settings.id}.accessories.bak`));
                const decompressed = gunzipSync(content).toString("utf-8");

                backup = JSON.parse(decompressed) as SerializedPlatformAccessory[];
            } catch (err) {
                backup = [];
            }
        }

        if (File.existsSync(Path.resolve(storage, `${this.settings.id}.accessories`))) {
            try {
                const content = File.readFileSync(Path.resolve(storage, `${this.settings.id}.accessories`));
                const decompressed = gunzipSync(content).toString("utf-8");

                cached = JSON.parse(decompressed) as SerializedPlatformAccessory[];
            } catch (err) {
                cached = backup;
            }
        }

        if (cached && cached.length > 0) {
            Cache.remove(`bridge/${this.settings.id}/accessories`);

            (this.records as Accessories).platform = cached.map((serialized) => PlatformAccessory.deserialize(serialized));

            File.copyFileSync(
                Path.resolve(storage, `${this.settings.id}.accessories`),
                Path.resolve(storage, `${this.settings.id}.accessories.bak`),
            );
        }
    }

    private saveCache() {
        const storage = this.config.storage.path as string;
        const cache = Path.resolve(storage, `${this.settings.id}.accessories`);
        const filename = Path.resolve(cache, "cachedAccessories");
        const content = JSON.stringify((this.records as Accessories).platform.map((accessory) => PlatformAccessory.serialize(accessory)));
        const compressed = gzipSync(content);

        if (File.existsSync(Path.resolve(storage, `${this.settings.id}.yaml`))) {
            File.ensureDirSync(cache);
            File.writeFileSync(filename, compressed);
        }
    }
}

export default Bridge;
