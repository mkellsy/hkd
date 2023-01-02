interface BridgeConfig {
    id: string;
    name: string;
    type: string;
    port: number;
    pin: string;
    username: string;
    advertiser: "ciao" | "bonjour";
    autostart: number;
    project?: string;
}

export default BridgeConfig;
