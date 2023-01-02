import { EventEmitter } from "events";
import { NodeVM } from "vm2";

import Bridge, { BridgeEvent } from "../bridge";
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
    private config: Config;
    private sandboxes: Sandboxs = {};

    constructor(config: Config) {
        super();

        this.log = Logger("hub");
        this.config = config;

        Internal.transports(this.log, "hub", this.config);

        this.on(BridgeEvent.RestartBridge, (bridge: string) => {
            this.restartBridge(bridge).catch((error) => this.log.error((error as Error).message));
        });

        this.on(BridgeEvent.RestartHub, () => {
            this.restart().catch((error) => this.log.error((error as Error).message));
        });
    }

    public get bridges() {
        return this.sandboxes;
    }

    public start(): void {
        if (!this.running) {
            for (let i = 0; i < this.config.bridges.length; i += 1) {
                this.createSandbox(this.config.bridges[i]);
            }

            this.running = true;
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

            instance.bridge?.on(BridgeEvent.Listening, () => instance.bridge?.log.info(`bridge started on port ${this.log.cyan(config.port.toString())}`));
            instance.bridge?.on(BridgeEvent.Shutdown, () => instance.bridge?.log.info("shutting down"));

            setTimeout(() => {
                if (instance.start && instance.bridge) instance.start(instance.bridge, instance.bridge?.log);
            }, (config.autostart || 0) * 1000);

            this.sandboxes[config.id] = instance;
        }
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
