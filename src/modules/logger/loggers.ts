import ExtendedLogger from "./extended";
import Log from "./log";

interface Loggers {
    [key: string]: ExtendedLogger | Log;
}

export default Loggers;
