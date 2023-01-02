import File from "fs-extra";
import { execSync } from "child_process";

import Server from "./";

let LaunchDaemon: string = "";

LaunchDaemon += "[Unit]";
LaunchDaemon += "Description=HKD";
LaunchDaemon += "After=network-online.target";
LaunchDaemon += "";
LaunchDaemon += "[Service]";
LaunchDaemon += "Type=simple";
LaunchDaemon += "User=root";
LaunchDaemon += `ExecStart=${Server.locate("hkd") || "hkd"} start`;
LaunchDaemon += "Restart=always";
LaunchDaemon += "RestartSec=3";
LaunchDaemon += "KillSignal=SIGINT";
LaunchDaemon += "";
LaunchDaemon += "[Install]";
LaunchDaemon += "WantedBy=multi-user.target";
LaunchDaemon += "";

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
