import Path from "path";
import File from "fs-extra";

import { PromptModule } from "inquirer";

import Config, { BridgeConfig } from "../config";

const reserved = [
    "new",
    "add",
    "bridge",
    "bridges",
    "library",
    "advanced",
];

export async function create(prompt: PromptModule, config: Config, name?: string, child?: boolean, port?: number, pin?: string, autostart?: number, advertiser?: string): Promise<BridgeConfig> {
    let id = Config.sanitize(name || "");

    if (id
     && name
     && reserved.indexOf(id) === -1
     && port
     && config.bridges.findIndex((entry) => entry.id === id) === -1
     && config.bridges.findIndex((entry) => entry.port === port) === -1) {

        return {
            id,
            name,
            type: "bridge",
            child: child || false,
            port,
            pin: pin || "0314-5154",
            username: Config.uuid(),
            autostart: autostart || 0,
            advertiser,
        }
    }

    const questions = [{
        type: "input",
        name: "name",
        message: "enter a name for this bridge",
        validate: (value: string | undefined) => {
            if (!value || value === "") return "a name is required";
            if (reserved.indexOf(Config.sanitize(value) as string) >= 0) return "name reserved please choose a different name";
            if (config.bridges.findIndex((entry) => entry.id === Config.sanitize(value)) >= 0) return "bridge name must be uniqie";

            return true;
        },
    }, {
        type: "list",
        name: "type",
        message: "select a bridgetype",
        choices: [
            { name: "Bridge", value: "bridge" },
            { name: "Development", value: "development" },
        ],
    }, {
        type: "input",
        name: "project",
        message: "set your project path",
        when: (answers: Record<string, any>) => answers.type === "development",
        validate: (value: string | undefined) => {
            if (!value) return "a projact path is required";
            if (!File.existsSync(Path.join(value || "", "package.json"))) return "invalid project path";

            return true;
        },
    }, {
        type: "confirm",
        name: "child",
        message: "create as a child bridge",
        default: false,
     }, {
        type: "number",
        name: "port",
        when: (answers: Record<string, any>) => !answers.child,
        default: () => {
            port = port || 5100;

            if (config.hub.port === port) port += 10;

            while (config.bridges.findIndex((entry) => parseInt(`${entry.port}`, 10) === port) >= 0) port += 10;

            return `${port}`;
        },
        message: "enter the port for the bridge",
        validate: (value: number | undefined) => {
            if (!value || Number.isNaN(value)) return "invalid port number";
            if (value < 1 || value > 65535) return "select a port between 1 and 65535";
            if (config.bridges.findIndex((entry) => entry.port === value) >= 0) return "port is already in use";

            return true;
        },
    }, {
        type: "input",
        name: "pin",
        message: "enter a pin for the bridge",
        when: (answers: Record<string, any>) => !answers.child,
        default: "0314-5154",
    }, {
        type: "list",
        name: "advertiser",
        message: "Please select an advertiser",
        when: (answers: Record<string, any>) => !answers.child,
        default: "bonjour",
        choices: [
            { name: "Bonjour", value: "bonjour" }, 
            { name: "Ciao", value: "ciao" },
        ],
    }, {
        type: "number",
        name: "autostart",
        default: "0",
        message: "delay the start of the bridge (in seconds)?",
        validate: (value: number | undefined) => {
            if (!value || Number.isNaN(value)) return "invalid number";
            if (value < -1 || value > 500) return "select a port between -1 and 500";

            return true;
        },
    }];

    const input = (await prompt(questions)) as Record<string, any>;

    if (input.child) {
        return {
            id: Config.sanitize(input.name) as string,
            name: input.name,
            type: input.type,
            child: true,
            autostart: parseInt(input.autostart, 10),
            project: input.project,
        }
    }

    return {
        id: Config.sanitize(input.name) as string,
        name: input.name,
        type: input.type,
        child: false,
        port: parseInt(input.port, 10),
        pin: input.pin,
        username: Config.uuid(),
        autostart: parseInt(input.autostart, 0),
        advertiser: input.advertiser,
        project: input.project,
    }
}
