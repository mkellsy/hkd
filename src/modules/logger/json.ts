import Utility from "util";

function json(value: any, length?: number): void {
    console.log("");
    console.log(Utility.inspect(value, { colors: true, maxStringLength: length || 100 }));
    console.log("");
}

export default json;
