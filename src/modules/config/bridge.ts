interface BridgeConfig {
    id: string;
    name: string;
    type: string;
    child: boolean;
    port?: number;
    pin?: string;
    username?: string;
    advertiser?: string;
    autostart: number;
    project?: string;
}

export default BridgeConfig;
