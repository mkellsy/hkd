import File from "fs-extra";
import { execSync } from "child_process";

import Server from "./";

let LaunchDaemon: string = "";

LaunchDaemon += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>";
LaunchDaemon += "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">";
LaunchDaemon += "<plist version=\"1.0\">";
LaunchDaemon += "    <dict>";
LaunchDaemon += "        <key>Label</key>";
LaunchDaemon += "        <string>org.hkd.hub</string>";
LaunchDaemon += "        <key>EnvironmentVariables</key>";
LaunchDaemon += "        <dict>";
LaunchDaemon += "            <key>PATH</key>";
LaunchDaemon += "            <string><![CDATA[/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin]]></string>";
LaunchDaemon += "            <key>HOME</key>";
LaunchDaemon += "            <string>/var/root</string>";
LaunchDaemon += "        </dict>";
LaunchDaemon += "        <key>Program</key>";
LaunchDaemon += `       <string>${Server.locate("hkd") || "hkd"}</string>`;
LaunchDaemon += "        <key>ProgramArguments</key>";
LaunchDaemon += "        <array>";
LaunchDaemon += `            <string>${Server.locate("hkd") || "hkd"}</string>`;
LaunchDaemon += "            <string>start</string>";
LaunchDaemon += "        </array>";
LaunchDaemon += "        <key>RunAtLoad</key>";
LaunchDaemon += "        <true/>";
LaunchDaemon += "        <key>KeepAlive</key>";
LaunchDaemon += "        <true/>";
LaunchDaemon += "        <key>SessionCreate</key>";
LaunchDaemon += "        <true/>";
LaunchDaemon += "    </dict>";
LaunchDaemon += "</plist>";

const ServicePath = "/Library/LaunchDaemons/org.hkd.plist";

export function LoadService() {
    if (File.existsSync(ServicePath)) {
        execSync(`launchctl load -w ${ServicePath}`);
    }
}

export function UnloadService() {
    if (File.existsSync(ServicePath)) {
        execSync(`launchctl unload ${ServicePath}`);
    }
}

export function RestartService() {
    if (File.existsSync(ServicePath)) {
        execSync(`launchctl unload ${ServicePath}`);
        execSync(`launchctl load -w ${ServicePath}`);
    }
}

export {
    LaunchDaemon,
    ServicePath,
};
