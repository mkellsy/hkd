function filterConfig(value: { [key: string]: any }): void {
    if (value) {
        const keys = Object.keys(value);

        for (let i = 0; i < keys.length; i += 1) {
            if (value[keys[i]] === null || value[keys[i]] === "") {
                delete value[keys[i]];
            } else if (Object.prototype.toString.call(value[keys[i]]) === "[object Object]" && Object.entries(value[keys[i]]).length === 0) {
                delete value[keys[i]];
            } else if (Object.prototype.toString.call(value[keys[i]]) === "[object Object]") {
                filterConfig(value[keys[i]] as { [key: string]: any });
            } else if (Array.isArray(value[keys[i]]) && (value[keys[i]] as { [key: string]: any }[]).length === 0) {
                delete value[keys[i]];
            } else if (Array.isArray(value[keys[i]])) {
                filterConfig(value[keys[i]] as { [key: string]: any }[]);
            }
        }
    }
}

export default filterConfig;
