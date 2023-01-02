import File from "fs-extra";
import Path from "path";
import Watcher from "chokidar";

import { EventEmitter } from "events";
import { HAPStorage } from "hap-nodejs";

import Config from "../config";
import Hub from "../hub";
import Logger, { Internal, Log } from "../logger";
import ServerEvent from "./event";

import { BridgeEvent } from "../bridge";

class Server extends EventEmitter {
    public running = false;
    public started = 0; 
    public terminating = false;

    private log: Log;
    private hub: Hub;
    private config: Config;
    private watcher: Watcher.FSWatcher | undefined;

    constructor(config: Config) {
        super();

        this.log = Logger("server");
        this.config = config;
        this.hub = new Hub(this.config);

        Internal.transports(this.log, "server", this.config);
        HAPStorage.setCustomStoragePath(Path.resolve(this.config.storage.path as string, "persist"));

        this.hub.removeAllListeners(BridgeEvent.Shutdown);
        this.hub.on(BridgeEvent.Shutdown, () => this.log.info("shutting down"));
    }

    public static locate(command: string): string | undefined {
        const paths = (process.env.PATH || "").split(":");

        for (let i = 0; i < paths.length; i += 1) {
            if (File.existsSync(Path.join(paths[i], command))) return Path.join(paths[i], command);
        }

        return undefined;
    }

    public async start() {
        this.log.info("starting hub");

        if (!this.config.hub || !this.config.hub.port) {
            this.log.warn(`service not initilized, please run ${this.log.yellow(`${process.platform === "win32" ? "" : "sudo "}hkd service install`)}`);

            process.exit();
        }

        if (this.watcher) await this.watcher.close();

        this.watcher = Watcher.watch(Path.resolve(this.config.storage.path as string, "hub.yaml"));
        this.watcher.removeAllListeners("change");

        this.watcher.on("change", () => setTimeout(() => {
            this.config.load();
            this.hub.restart().catch((error) => this.log.error((error as Error).message));
        }, 100));

        this.hub.start();
    }

    async stop() {
        this.terminating = true;
        this.running = false;

        this.log.info("stopping hub");

        const waits = [];

        waits.push(this.hub.stop());

        if (this.watcher) waits.push(this.watcher.close());

        await Promise.allSettled(waits);

        this.emit(ServerEvent.Stopped);
    }
}

export default Server;
export { ServerEvent };
