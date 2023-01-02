import File from "fs-extra";
import Path from "path";

import { EventEmitter } from "events";
import { gzipSync, gunzipSync } from "zlib";
import { NodeVM } from "vm2";
import { uuid } from "hap-nodejs";

import {
    Accessory,
    AccessoryEventTypes,
    Categories,
    Characteristic,
    Service,
} from "hap-nodejs";

import { Bridge as HAPBridge } from "hap-nodejs";
import { PlatformAccessory, SerializedPlatformAccessory } from "homebridge/lib/platformAccessory";

import Accessories from "../accessories";
import Bridge, { BridgeEvent } from "../bridge";
import Cache from "../cache";
import Config, { BridgeConfig } from "../config";
import Device from "./device";
import Information from "./information";
import Logger, { Internal, Log } from "../logger";
import Plugin from "./plugin";
import Sandbox from "./sandbox";
import Sandboxs from "./sandboxs";

class Hub extends EventEmitter {
    public running = false;

    private log: Log;
    private bridge: HAPBridge | undefined;
    private config: Config;
    private id: string | undefined;
    private records: Accessories | undefined;
    private sandboxes: Sandboxs = {};
    private url: string | undefined;

    constructor(config: Config) {
        super();

        this.log = Logger("hub");
        this.config = config;
        this.url = Cache.get<string>("hub:uri") || undefined;
        this.id = Cache.get<string>("hub:setup_id");

        Internal.transports(this.log, "hub", this.config);

        this.on(BridgeEvent.RestartBridge, (bridge: string) => {
            this.restartBridge(bridge).catch((error) => this.log.error((error as Error).message));
        });

        this.on(BridgeEvent.RestartHub, () => {
            this.restart().catch((error) => this.log.error((error as Error).message));
        });
    }

    public get uri() {
        return this.url;
    }

    public get accessories() {
        return [...(this.records as Accessories).hap, ...(this.records as Accessories).platform];
    }

    public get bridges() {
        return this.sandboxes;
    }

    public start(): void {
        if (!this.running) {
            this.records = new Accessories("hub");
            this.bridge = new HAPBridge("Home", uuid.generate("Home"));

            setTimeout(() => {
                this.loadCache();
                this.restoreAccessories();

                this.publish();
                this.running = true;

                this.emit(BridgeEvent.Listening, this.config.hub.port);

                for (let i = 0; i < this.config.bridges.length; i += 1) {
                    this.createSandbox(this.config.bridges[i]);
                }
            }, (this.config.hub.autostart || 0) * 1000);
        }
    }

    public startBridge(bridge: string): void {
        this.createSandbox(this.config.bridges.find((entry) => entry.id === bridge));
    }

    public async stop(): Promise<void> {
        if (this.running) {
            const instances = Object.keys(this.sandboxes);
            const waits: Promise<void>[] = [];

            this.running = false;

            for (let i = 0; i < instances.length; i += 1) {
                const instance = this.sandboxes[instances[i]];

                if (instance.bridge) waits.push((instance.bridge as Record<string, any>).stop() as Promise<void>);
            }

            waits.push((this.bridge as HAPBridge).unpublish());

            for (const accessory of (this.records as Accessories).unbridged.values()) {
                waits.push(accessory._associatedHAPAccessory.unpublish());
            }

            this.saveCache();

            await Promise.allSettled(waits);

            this.emit(BridgeEvent.Shutdown);
        }
    }

    public async stopBridge(bridge: string): Promise<void> {
        if (this.sandboxes[bridge] && this.sandboxes[bridge].bridge) {
            await this.sandboxes[bridge].bridge?.stop();
        }
    }

    public async restart(): Promise<void> {
        await this.stop();

        this.start();
    }

    public async restartBridge(bridge: string): Promise<void> {
        await this.stopBridge(bridge);

        this.startBridge(bridge);
    }

    public create(accessory: PlatformAccessory): Accessory {
        const service = new Information();

        Cache.remove("bridge/hub/accessories");

        service.updateCharacteristic(Device, accessory.UUID);
        accessory._associatedHAPAccessory.addService(service);

        (this.records as Accessories).platform.push(accessory);

        this.saveCache();

        return accessory._associatedHAPAccessory;
    }

    public addAccessories(...accessories: Accessory[]) {
        (this.bridge as HAPBridge).addBridgedAccessories(accessories);
    }

    public removeAccessories(...accessories: Accessory[]) {
        (this.bridge as HAPBridge).removeBridgedAccessories(accessories);
    }

    private createSandbox(config: BridgeConfig | undefined) {
        if (config) {
            const instance: Sandbox = {
                vm: new NodeVM({
                    console: "inherit",
                    sandbox: {
                        bridge: Bridge,
                        config: this.config,
                        settings: config,
                        hub: this,
                    },
                    require: true,
                }),
            };

            instance.bridge = instance.vm.run("module.exports = function() { return bridge(config, settings, hub) }")();

            instance.start = instance.vm.run(`
                module.exports = (bridge, log) => {
                    bridge.start().catch((error) => log.error(error.message));
                };
            `);

            instance.bridge?.removeAllListeners(BridgeEvent.PublishBridge);
            instance.bridge?.removeAllListeners(BridgeEvent.Listening);
            instance.bridge?.removeAllListeners(BridgeEvent.Shutdown);

            instance.bridge?.on(BridgeEvent.Listening, () => instance.bridge?.log.info(config.child || !config.port ? "bridge started" : `bridge started on port ${this.log.cyan(config.port.toString())}`));
            instance.bridge?.on(BridgeEvent.Shutdown, () => instance.bridge?.log.info("shutting down"));

            setTimeout(() => {
                if (instance.start && instance.bridge) instance.start(instance.bridge, instance.bridge?.log);
            }, (config.autostart || 0) * 1000);

            this.sandboxes[config.id] = instance;
        }
    }

    private restoreAccessories(): void {
        Cache.remove("bridge/hub/accessories");

        (this.records as Accessories).platform = (this.records as Accessories).platform.filter((accessory) => {
            accessory.getService(Service.AccessoryInformation)!.setCharacteristic(Characteristic.FirmwareRevision, this.config.version.bridge);

            try {
                (this.bridge as HAPBridge).addBridgedAccessory(accessory._associatedHAPAccessory);
            } catch (_error) {
                return false;
            }

            return true;
        });
    }

    private publish(): void {
        const info = (this.bridge as HAPBridge).getService(Service.AccessoryInformation)!;

        info.setCharacteristic(Characteristic.Manufacturer, "Home");
        info.setCharacteristic(Characteristic.Model, "Home");
        info.setCharacteristic(Characteristic.SerialNumber, this.config.hub.username);
        info.setCharacteristic(Characteristic.FirmwareRevision, this.config.version.bridge);

        (this.bridge as HAPBridge).removeAllListeners(AccessoryEventTypes.LISTENING);

        (this.bridge as HAPBridge).on(AccessoryEventTypes.LISTENING, (port: number) => {
            if (port) this.log.info(`hub started on port ${this.log.cyan(port.toString())}.`);
        });

        (this.bridge as HAPBridge).publish({
            username: this.config.hub.username,
            port: this.config.hub.port,
            pincode: this.config.hub.pin,
            category: Categories.BRIDGE,
            bind: "0.0.0.0",
            setupID: this.id,
            addIdentifyingMaterial: true,
            advertiser: this.config.advertiser,
        }, true);

        this.id = (this.bridge as HAPBridge)._setupID as string;
        this.url = (this.bridge as HAPBridge).setupURI();

        Cache.set("hub:setup_id", this.id, 3 * 365 * 24 * 60);
        Cache.set("hub:uri", this.url, 3 * 365 * 24 * 60);

        this.emit(BridgeEvent.PublishBridge, this.url);
    }

    private loadCache(): void {
        let backup: SerializedPlatformAccessory[] = [];
        let cached: SerializedPlatformAccessory[] = [];

        if (File.existsSync(Path.resolve(this.config.storage.path as string, "hub.accessories.bak"))) {
            try {
                const content = File.readFileSync(Path.resolve(this.config.storage.path as string, "hub.accessories.bak"));
                const decompressed = gunzipSync(content).toString("utf-8");

                backup = JSON.parse(decompressed) as SerializedPlatformAccessory[];
            } catch (err) {
                backup = [];
            }
        }

        if (File.existsSync(Path.resolve(this.config.storage.path as string, "hub.accessories"))) {
            try {
                const content = File.readFileSync(Path.resolve(this.config.storage.path as string, "hub.accessories"));
                const decompressed = gunzipSync(content).toString("utf-8");

                cached = JSON.parse(decompressed) as SerializedPlatformAccessory[];
            } catch (err) {
                cached = backup;
            }
        }

        if (cached && cached.length > 0) {
            Cache.remove("bridge/hub/accessories");

            (this.records as Accessories).platform = cached.map((serialized) => {
                const accessory = PlatformAccessory.deserialize(serialized);

                return accessory;
            });

            File.copyFileSync(
                Path.resolve(this.config.storage.path as string, "hub.accessories"),
                Path.resolve(this.config.storage.path as string, "hub.accessories.bak"),
            );
        }
    }

    private saveCache() {
        const cache = Path.resolve(this.config.storage.path as string, "hub.accessories");
        const filename = Path.resolve(cache, "cachedAccessories");
        const content = JSON.stringify((this.records as Accessories).platform.map((accessory) => PlatformAccessory.serialize(accessory)));
        const compressed = gzipSync(content);

        File.ensureDirSync(cache);
        File.writeFileSync(filename, compressed);
    }
}

export default Hub;

export {
    Device,
    Information,
    Plugin,
    Sandbox,
    Sandboxs,
};
