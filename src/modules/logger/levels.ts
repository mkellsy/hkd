import Colors from "colors";

function levels(value: string): string {
    switch (value.toLowerCase()) {
        case "error":
            return `${Colors.red("ERROR")} `;

        case "warn":
            return `${Colors.yellow("WARNING")} `;

        case "debug":
            return `${Colors.blue("DEBUG")} `;

        default:
            return "";
    }
}

export default levels;
