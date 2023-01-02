import ServiceConfig from "./service";
import StorageConfig from "./storage";

interface ApplicationConfig {
    version: string;
    service: ServiceConfig;
    storage: StorageConfig;
    homebridge: string;
}

export default ApplicationConfig;
