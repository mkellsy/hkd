import { PromptModule } from "inquirer";

import Config, { HubConfig } from "../config";

export async function initilize(prompt: PromptModule, config: Config, port?: number, pin?: string, autostart?: number, advertiser?: string): Promise<HubConfig> {
    if (port && config.bridges.findIndex((entry) => entry.port === port) === -1) {
        return {
            port,
            pin: pin || "0314-5154",
            username: Config.uuid(),
            autostart: autostart || 0,
            advertiser: advertiser || "bonjour",
        }
    }

    const questions = [{
        type: "number",
        name: "port",
        default: 5100,
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
        default: "0314-5154",
    }, {
        type: "list",
        name: "advertiser",
        message: "Please select an advertiser",
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

    return {
        port: parseInt(input.port, 10),
        pin: input.pin,
        username: Config.uuid(),
        autostart: parseInt(input.autostart, 0),
        advertiser: input.advertiser,
    }
}
