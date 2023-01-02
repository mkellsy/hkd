import { NodeVM } from "vm2";

import ExtendedLogger from "../logger/extended";
import Instance from "../bridge/instance";

interface Sandbox {
    vm: NodeVM;
    bridge?: Instance;
    start?: (bridge: Instance, log: ExtendedLogger) => void;
}

export default Sandbox;
