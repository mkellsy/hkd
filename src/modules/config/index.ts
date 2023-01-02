import File from "fs-extra";
import Homebridge from "homebridge/lib/version";
import OS from "os";
import Path from "path";
import Sanitize from "sanitize-filename";
import UUID from "shortid";
import Yaml from "yaml";

import { execSync, spawn } from "child_process";
import { MDNSAdvertiser } from "hap-nodejs";

import ApplicationConfig from "./application";
import { Bridge } from "../bridge";
import BridgeConfig from "./bridge";
import Cache from "../cache";
import ConfigFile from "./config";
import DefaultConfig from "./default";
import DeviceConfig from "./device";
import HubConfig from "./hub";
import Logger, { Internal, Log } from "../logger";
import SandboxConfig from "./sandbox";
import ServiceConfig from "./service";
import Signal from "./signal";
import StorageConfig from "./storage";

import { create } from "./create";
import { initilize } from "./initilize";

let current: Config;

class Config {
    private log: Log;
    private app: ApplicationConfig;
    private config: ConfigFile = {};

    constructor(file: string) {
        this.log = Logger("config");

        if (!File.existsSync(file)) {
            this.log.error("missing config file");

            process.exit(1);
        } else {
            this.log.debug(`starting with config ${this.log.cyan(file)}`);

            const hub = JSON.parse(File.readFileSync(Path.resolve(__dirname, "../../../package.json"), "utf-8")) as { [key: string]: any };

            this.app = Yaml.parse(File.readFileSync(file, "utf-8")) as ApplicationConfig || {};
            this.app.storage = this.setStorage();
            this.app.version = hub.version as string;
            this.app.homebridge = Homebridge();

            this.load();

            Internal.transports(this.log, "config", this);
            Cache.load(this.app.storage.path as string);
        }
    }

    public static uuid(): string {
        let value = "";

        for (let i = 0; i < 6; i += 1) {
            if (value !== "") value += ":";

            const hex = `00${Math.floor(Math.random() * 255).toString(16).toUpperCase()}`;

            value += hex.substring(hex.length - 2, hex.length);
        }

        return value;
    }

    public static edit(config: Config, bridge?: BridgeConfig): void {
        let editCommand = "nano";
    
        switch (process.platform) {
            case "darwin":
                editCommand = "nano";
                break;
    
            case "linux":
            case "freebsd":
            case "openbsd":
                editCommand = "nano";
                break;
    
            case "win32":
                editCommand = "notepad";
                break;
    
            default:
                Logger("config").error("unsuported operating system");
    
                process.exit(1);
        }

        const storage = config.storage.path as string;
    
        if (bridge) {
            const sandbox = Bridge.loadConfig(config, bridge, true);
            const current = Bridge.loadConfig(config, bridge);
            const filename = Path.resolve(storage, UUID.generate());
        
            File.writeFileSync(filename, Yaml.stringify(sandbox));
        
            spawn(editCommand, [filename], {
                stdio: "inherit",
                detached: true,
                cwd: storage,
            }).on("data", (data) => {
                process.stdout.pipe(data);
            }).on("close", () => {
                const updated = Yaml.parse(File.readFileSync(filename, "utf-8")) || {} as { [key: string]: any };
        
                Bridge.saveConfig(config, bridge, current, updated);
                Config.increaseVersion(config, bridge);
        
                File.unlinkSync(filename);
            });
        } else {
            const current = File.readFileSync(Path.resolve(storage, "hub.yaml"));
            const filename = Path.resolve(storage, UUID.generate());

            File.writeFileSync(filename, current);

            spawn(editCommand, [filename], {
                stdio: "inherit",
                detached: true,
                cwd: storage,
            }).on("data", (data) => {
                process.stdout.pipe(data);
            }).on("close", () => {
                const updated = Yaml.parse(File.readFileSync(filename, "utf-8")) || {} as { [key: string]: any };
        
                File.writeFileSync(Path.resolve(storage, "hub.yaml"), Yaml.stringify(updated));
                File.unlinkSync(filename);
            });
        }
    }

    public static save(config: Config, hub: HubConfig, bridges: BridgeConfig[] = []) {
        const storage = config.storage.path as string;
        const updated = Yaml.stringify({ hub, bridges });

        File.writeFileSync(Path.resolve(storage, "hub.yaml"), updated);
    }

    public static addBridge(config: Config, bridge: BridgeConfig): void {
        const storage = config.storage.path as string;
        const filename = Path.resolve(storage, "hub.yaml");
        const current = Yaml.parse(File.readFileSync(filename, "utf-8")) || {} as { [key: string]: any };

        current.bridges.push(bridge);

        File.writeFileSync(Path.resolve(storage, "hub.yaml"), Yaml.stringify(current));
    }

    public static removeBridge(config: Config, bridge: BridgeConfig): void {
        const storage = config.storage.path as string;
        const filename = Path.resolve(storage, "hub.yaml");
        const current = Yaml.parse(File.readFileSync(filename, "utf-8")) || {} as { [key: string]: any };
        const index = current.bridges.findIndex((entry: BridgeConfig) => entry.id === bridge.id);

        current.bridges.splice(index, 1);

        File.writeFileSync(Path.resolve(storage, "hub.yaml"), Yaml.stringify(current));

        if (File.existsSync(Path.resolve(storage, `${bridge.id}.yaml`))) File.unlinkSync(Path.resolve(storage, `${bridge.id}.yaml`));
        if (File.existsSync(Path.resolve(storage, `${bridge.id}.accessories`))) File.removeSync(Path.resolve(storage, `${bridge.id}.accessories`));
        if (File.existsSync(Path.resolve(storage, bridge.id))) File.removeSync(Path.resolve(storage, bridge.id));
    }

    public static touch(config: Config, bridge?: BridgeConfig): void {
        const storage = config.storage.path as string;

        if (bridge) {
            Bridge.touchConfig(config, bridge);
        } else {
            const current = File.readFileSync(Path.resolve(storage, "hub.yaml"), "utf-8");

            File.writeFileSync(Path.resolve(storage, "hub.yaml"), current);
        }
    }

    public static configure(file?: string) {
        current = new Config(Config.locate(file));

        return current;
    }

    public static increaseVersion(config: Config, bridge: BridgeConfig) {
        const storage = Path.resolve(config.storage.path as string, bridge.id);
    
        let pjson = {
            name: "plugins",
            description: "HOOBS Plugins",
            version: (new Date()).getTime().toString(),
            private: true,
            dependencies: {},
        };
    
        if (File.existsSync(Path.join(storage, "package.json"))) pjson = { ...pjson, ...(File.readJSONSync(Path.resolve(storage, "package.json"))) };
    
        pjson.version = (new Date()).getTime().toString();
    
        File.writeFileSync(Path.resolve(storage, "package.json"), JSON.stringify(pjson, undefined, 4));
    }

    public static configureBridge(config: Config, bridge: BridgeConfig) {
        let sandbox: SandboxConfig = {
            accessories: [],
            platforms: [],
        };

        const storage = config.storage.path as string;

        if (File.existsSync(Path.join(storage, `${bridge.id}.yaml`))) {
            sandbox = { ...(Yaml.parse(File.readFileSync(Path.resolve(storage, `${bridge.id}.yaml`), "utf-8")) || {}) } as SandboxConfig;
        }

        return sandbox;
    }

    public static get() {
        return current;
    }

    public static locate(file?: string): string {
        if (file) return Path.resolve(file);

        return Path.resolve(__dirname, "../../..", (`config.${process.env.NODE_ENV || ""}.yaml`).replace(/test/gi, "").replace(/\.\./gi, "."));
    }

    public static sanitize(value: string, prevent?: string): string | undefined {
        if (!value || value === "") return undefined;
        if (prevent && prevent !== "" && prevent.toLowerCase() === value.toLowerCase()) return undefined;
    
        return Sanitize(value).toLowerCase().replace(/ /gi, "");
    }

    public load() {
        if (File.existsSync(Path.resolve(this.storage.path as string, "hub.yaml"))) {
            this.config = Yaml.parse(File.readFileSync(Path.resolve(this.storage.path as string, "hub.yaml"), "utf-8")) as ConfigFile || {};
        }
    }

    public get version(): { bridge: string, homebridge: string } {
        return { bridge: this.app.version, homebridge: this.app.homebridge };
    }

    public get service(): ServiceConfig {
        return this.app.service;
    }

    public get storage(): StorageConfig {
        return this.app.storage;
    }

    public get hub(): HubConfig {
        return this.config.hub as HubConfig;
    }

    public get bridges(): BridgeConfig[] {
        return this.config.bridges as BridgeConfig[] || [];
    }

    public get advertiser(): MDNSAdvertiser {
        return this.getAdvertiser();
    }

    public getAdvertiser(bridge?: BridgeConfig): MDNSAdvertiser {
        const value = ((bridge ? bridge.advertiser : this.hub.advertiser) || "").toLowerCase();

        switch (value) {
            case "bonjour":
                return MDNSAdvertiser.BONJOUR;

            default:
                return MDNSAdvertiser.CIAO;
        }
    }

    private setStorage(): StorageConfig {
        const storage: StorageConfig = this.app.storage || {};

        if (storage.path || "auto" === "auto") {
            storage.path = "";

            switch (process.platform) {
                case "darwin":
                    if (process.getuid && process.getuid() === 0) {
                        storage.path = Path.resolve("/Library/Application Support/HomeKit");
                    } else {
                        storage.path = Path.resolve(OS.homedir(), "Library/Application Support/HomeKit");
                    }

                    break;

                case "linux":
                case "freebsd":
                case "openbsd":
                    if (File.existsSync("/proc/1/cgroup") && execSync("cat /proc/1/cgroup | grep 'docker\\|lxc'", { stdio: ["pipe", "pipe", "ignore"] }).toString().trim() !== "") {
                        storage.path = "/homekit";
                    } else if (process.getuid && process.getuid() === 0) {
                        storage.path = Path.resolve("/var/lib/homekit");
                    } else {
                        storage.path = Path.resolve(OS.homedir(), "homekit");
                    }

                    break;

                case "win32":
                    storage.path = Path.resolve(OS.homedir(), "../Public/Documents/HomeKit");
                    break;

                default:
                    this.log.error("unsuported operating system");

                    process.exit(1);
            }
        }

        this.log.debug(`setting storage to ${this.log.cyan(this.app.storage.path as string)}`);

        File.ensureDirSync(storage.path as string);

        return storage;
    }
}

export default Config;

export {
    create,
    initilize,
};

export {
    ApplicationConfig,
    BridgeConfig,
    Cache,
    ConfigFile,
    DefaultConfig,
    DeviceConfig,
    HubConfig,
    Internal,
    SandboxConfig,
    ServiceConfig,
    Signal,
    StorageConfig,
};
