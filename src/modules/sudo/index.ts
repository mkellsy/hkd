export default function () {
    switch (process.platform) {
        case "darwin":
            return process.env.USER === "root";

        case "linux":
        case "freebsd":
        case "openbsd":
            return process.env.USER === "root";

        default:
            return true;
    }
}
