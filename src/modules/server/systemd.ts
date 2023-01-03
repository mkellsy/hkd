import File from "fs-extra";
import { execSync } from "child_process";

import Server from "./";

let LaunchDaemon: string = "";

LaunchDaemon += "[Unit]\n";
LaunchDaemon += "Description=HKD\n";
LaunchDaemon += "After=network-online.target\n";
LaunchDaemon += "\n";
LaunchDaemon += "[Service]\n";
LaunchDaemon += "Type=simple\n";
LaunchDaemon += "User=root\n";
LaunchDaemon += `ExecStart=${Server.locate("hkd") || "hkd"} start --color=full\n`;
LaunchDaemon += "Restart=always\n";
LaunchDaemon += "RestartSec=3\n";
LaunchDaemon += "KillSignal=SIGINT\n";
LaunchDaemon += "\n";
LaunchDaemon += "[Install]\n";
LaunchDaemon += "WantedBy=multi-user.target\n";
LaunchDaemon += "\n";

const ServicePath = "/etc/systemd/system/hkd.service";

export function LoadService() {
    if (File.existsSync(ServicePath)) {
        execSync("systemctl daemon-reload");
        execSync("systemctl enable hkd.service");
        execSync("systemctl start hkd.service");
    }
}

export function UnloadService() {
    if (File.existsSync(ServicePath)) {
        execSync("systemctl stop hkd.service");
        execSync("systemctl disable hkd.service");
    }
}

export function RestartService() {
    if (File.existsSync(ServicePath)) {
        execSync("systemctl stop hkd.service");
        execSync("systemctl start hkd.service");
    }
}

export {
    LaunchDaemon,
    ServicePath,
};
