
import File from "fs-extra";
import Path from "path";
import Yaml from "yaml";

import { execSync, spawn } from "child_process";
import { PluginManager } from "homebridge/lib/pluginManager";

import Config, { BridgeConfig } from "../config";
import Logger, { Internal } from "../logger";
import Package from "../config/package";
import PluginDetails from "./details";
import PluginIdentifier from "./identifier";
import PluginRecord from "./record";

class Plugins {
    public static load(config: Config, bridge: BridgeConfig, development?: boolean): PluginRecord[] {
        const results: PluginRecord[] = [];

        if (development) {
            const pjson = File.readJSONSync(Path.resolve(bridge.project as string, "package.json")) as Package;

            results.push({
                identifier: pjson.name,
                name: PluginManager.extractPluginName(pjson.name),
                scope: PluginManager.extractPluginScope(pjson.name),
                directory: bridge.project as string,
                pjson,
                library: pjson.main as string || "./index.js",
            });
        } else if (File.existsSync(Path.join(config.storage.path as string, bridge.id, "package.json"))) {
            const ijson = File.readJSONSync(Path.resolve(config.storage.path as string, bridge.id, "package.json")) as Package;
            const plugins = Object.keys(ijson.dependencies || {});

            for (let i = 0; i < plugins.length; i += 1) {
                if (plugins[i] !== "hap-nodejs") {
                    const directory = Path.join(config.storage.path as string, bridge.id, "node_modules", plugins[i]);
                    const pjson = File.readJSONSync(Path.resolve(directory, "package.json")) as Package;
                    const keywords: string[] = pjson.keywords as string[] || [];

                    if (File.existsSync(directory) && pjson && keywords.indexOf("homebridge-plugin") >= 0) {
                        results.push({
                            identifier: pjson.name,
                            name: PluginManager.extractPluginName(pjson.name),
                            scope: PluginManager.extractPluginScope(pjson.name),
                            directory,
                            pjson,
                            library: pjson.main as string || "./index.js",
                        });
                    }
                }
            }
        }

        return results;
    }

    public static delta(left: PluginRecord[], right: PluginRecord[]) {
        const removed: PluginRecord[] = [];
        const added: PluginRecord[] = [];
    
        for (let i = 0; i < left.length; i += 1) {
            if (right.findIndex((entry) => entry.scope === left[i].scope && entry.name === left[i].name) === -1) {
                removed.push(left[i]);
            }
        }
    
        for (let i = 0; i < right.length; i += 1) {
            if (left.findIndex((entry) => entry.scope === right[i].scope && entry.name === right[i].name) === -1) {
                added.push(right[i]);
            }
        }
    
        return { added, removed };
    }

    public static details(plugin?: PluginIdentifier): PluginDetails | undefined {
        if (!plugin) return undefined;

        if (plugin.name.startsWith("http://") || plugin.name.startsWith("https://")) {
            return {
                identifier: plugin.name,
                tag: plugin.tag,
            };
        }

        return {
            identifier: plugin.scope ? `@${plugin.scope}/${plugin.name}` : plugin.name,
            tag: plugin.tag,
        };
    }

    public static parse(input: string, config: Config): PluginIdentifier | undefined {
        const log = Logger("plugins");

        Internal.transports(log, "plugins", config);

        if (!input) {
            log.warn("no plugin defined");
    
            return undefined;
        }
    
        const plugin: PluginIdentifier = { name: input, tag: "latest" };
    
        if (plugin.name.toLowerCase().startsWith("http://") || plugin.name.toLowerCase().startsWith("https://")) {
            plugin.tag = "latest";
            plugin.name = plugin.name.toLowerCase();
    
            return plugin;
        }
    
        if (plugin.name.startsWith("@")) {
            plugin.name = plugin.name.substring(1);
            plugin.scope = plugin.name.split("/").shift() || "";
            plugin.name = plugin.name.split("/").pop() || "";
        }
    
        if (plugin.name.indexOf("@") >= 0) {
            plugin.tag = plugin.name.split("@").pop() || "latest";
            plugin.name = plugin.name.split("@").shift() || "";
        }
    
        return plugin;
    }

    public static installed(config: Config) {
        const plugins: { bridge: string; plugin: string; version: string; path: string; }[] = [];

        for (let i = 0; i < config.bridges.length; i += 1) {
            const installed = Plugins.load(config, config.bridges[i]);

            const transformed = installed.map((item) => ({
                bridge: config.bridges[i].id,
                plugin: item.scope ? `@${item.scope}/${item.name}` : item.name,
                version: item.pjson.version,
                path: item.directory,
            }));

            plugins.push(...transformed);
        }

        plugins.sort((a, b) => {
            if (a.plugin < b.plugin) return -1;
            if (a.plugin > b.plugin) return 1;
            return 0;
        });

        return plugins;
    }

    public static install(config: Config, bridge: BridgeConfig, plugin: PluginDetails): Promise<void> {
        return new Promise((resolve) => {
            const log = Logger("plugins");
            const storage = Path.resolve(config.storage.path as string, bridge.id);

            Internal.transports(log, "plugins", config);

            if (!File.existsSync(Path.join(storage, "node_modules", "hap-nodejs"))) execSync(`node ${require.resolve("npm")} install --ignore-engines hap-nodejs`, { cwd: storage });

            const flags: string[] = [];

            flags.push(require.resolve("npm"));
            flags.push("install");
            flags.push("--ignore-engines");
            flags.push("--logevel=error");
            flags.push("--no-audit");

            if (plugin.identifier.startsWith("http://") || plugin.identifier.startsWith("https://")) {
                flags.push(plugin.identifier);
            } else {
                flags.push(`${plugin.identifier}@${plugin.tag}`);
            }

            const proc = spawn("node", flags, { cwd: storage });

            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");

            proc.stdout.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.debug(lines[i].trim());
                }
            });

            proc.stderr.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.error(lines[i].trim());
                }
            });

            proc.on("close", () => {
                const sandbox = Config.configureBridge(config, bridge);

                File.writeFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`), Yaml.stringify(sandbox));

                resolve();
            });
        });
    }

    public static uninstall(config: Config, bridge: BridgeConfig, plugin: PluginDetails): Promise<void> {
        return new Promise((resolve) => {
            const log = Logger("plugins");
            const storage = Path.resolve(config.storage.path as string, bridge.id);
            const flags: string[] = [];
            const current = Plugins.load(config, bridge);

            Internal.transports(log, "plugins", config);

            flags.push(require.resolve("npm"));
            flags.push("uninstall");
            flags.push("--logevel=error");
            flags.push("--no-audit");
            flags.push(plugin.identifier);

            const proc = spawn("node", flags, { cwd: storage });

            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");

            proc.stdout.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.debug(lines[i].trim());
                }
            });

            proc.stderr.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.error(lines[i].trim());
                }
            });

            proc.on("close", () => {
                const sandbox = Config.configureBridge(config, bridge);
                const changed = Plugins.load(config, bridge);
                const delta = Plugins.delta(current, changed);

                for (let i = 0; i < delta.removed.length; i += 1) {
                    let index = sandbox.platforms.findIndex((p: any) => (p.plugin_map || {}).plugin_name === delta.removed[i].identifier);

                    while (index >= 0) {
                        sandbox.platforms.splice(index, 1);
                        index = sandbox.platforms.findIndex((p: any) => (p.plugin_map || {}).plugin_name === delta.removed[i].identifier);
                    }

                    index = sandbox.accessories.findIndex((a: any) => (a.plugin_map || {}).plugin_name === delta.removed[i].identifier);

                    while (index >= 0) {
                        sandbox.accessories.splice(index, 1);
                        index = sandbox.accessories.findIndex((a: any) => (a.plugin_map || {}).plugin_name === delta.removed[i].identifier);
                    }
                }

                File.writeFileSync(Path.resolve(config.storage.path as string, `${bridge.id}.yaml`), Yaml.stringify(sandbox));

                resolve();
            });
        });
    }

    public static upgrade(config: Config, bridge: BridgeConfig, plugin: PluginDetails): Promise<void> {
        return new Promise((resolve) => {
            const log = Logger("plugins");
            const storage = Path.resolve(config.storage.path as string, bridge.id);
            const flags: string[] = [];

            Internal.transports(log, "plugins", config);

            flags.push(require.resolve("npm"));
            flags.push("install");
            flags.push("--ignore-engines");
            flags.push("--logevel=error");
            flags.push("--no-audit");
            flags.push(`${plugin.identifier}@${plugin.tag}`);

            const proc = spawn("node", flags, { cwd: storage });

            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");

            proc.stdout.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.debug(lines[i].trim());
                }
            });

            proc.stderr.on("data", (data: string) => {
                const lines = data.split("\n");

                for (let i = 0; i < lines.length; i += 1) {
                    if (lines[i].trim()) log.error(lines[i].trim());
                }
            });

            proc.on("close", () => resolve());
        });
    }
}

export default Plugins;

export {
    PluginDetails,
    PluginIdentifier,
    PluginRecord,
};
