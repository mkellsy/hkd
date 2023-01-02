import Package from "../config/package";

interface PluginRecord {
    identifier: string;
    name: string;
    scope: string;
    version?: string;
    directory: string;
    pjson: Package;
    library: string;
}

export default PluginRecord;
