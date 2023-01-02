import Colors from "colors";

function random(text: string): string {
    return [
        Colors.cyan,
        Colors.magenta,
        Colors.blue,
        Colors.yellow,
        Colors.green,
        Colors.red,
    ][Math.floor(Math.random() * 6)](text);
}

export default random;
