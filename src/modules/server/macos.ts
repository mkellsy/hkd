import File from "fs-extra";
import { execSync } from "child_process";

import Server from "./";

let LaunchDaemon: string = "";

LaunchDaemon += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
LaunchDaemon += "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n";
LaunchDaemon += "<plist version=\"1.0\">\n";
LaunchDaemon += "    <dict>\n";
LaunchDaemon += "        <key>Label</key>\n";
LaunchDaemon += "        <string>org.hkd</string>\n";
LaunchDaemon += "        <key>UserName</key>\n";
LaunchDaemon += "        <string>root</string>\n";
LaunchDaemon += "        <key>EnvironmentVariables</key>\n";
LaunchDaemon += "        <dict>\n";
LaunchDaemon += "            <key>PATH</key>\n";
LaunchDaemon += "            <string><![CDATA[/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin]]></string>\n";
LaunchDaemon += "            <key>HOME</key>\n";
LaunchDaemon += "            <string>/var/root</string>\n";
LaunchDaemon += "            <key>USER</key>\n";
LaunchDaemon += "            <string>root</string>\n";
LaunchDaemon += "            <key>CLICOLOR</key>\n";
LaunchDaemon += "            <integer>1</integer>\n";
LaunchDaemon += "            <key>FORCE_COLOR</key>\n";
LaunchDaemon += "            <true/>\n";
LaunchDaemon += "        </dict>\n";
LaunchDaemon += "        <key>Program</key>\n";
LaunchDaemon += `       <string>${Server.locate("hkd") || "hkd"}</string>\n`;
LaunchDaemon += "        <key>ProgramArguments</key>\n";
LaunchDaemon += "        <array>\n";
LaunchDaemon += `            <string>${Server.locate("hkd") || "hkd"}</string>\n`;
LaunchDaemon += "            <string>start</string>\n";
LaunchDaemon += "            <string>--color=full</string>\n";
LaunchDaemon += "        </array>\n";
LaunchDaemon += "        <key>RunAtLoad</key>\n";
LaunchDaemon += "        <true/>\n";
LaunchDaemon += "        <key>KeepAlive</key>\n";
LaunchDaemon += "        <true/>\n";
LaunchDaemon += "        <key>SessionCreate</key>\n";
LaunchDaemon += "        <true/>\n";
LaunchDaemon += "    </dict>\n";
LaunchDaemon += "</plist>\n";

const ServicePath = "/Library/LaunchDaemons/org.hkd.plist";

export function LoadService() {
    if (File.existsSync(ServicePath)) {
        execSync(`chmod 4755 ${ServicePath}`);
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
