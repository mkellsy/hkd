import NodeCache from "node-cache";

import {
    existsSync,
    readFileSync,
    writeFileSync,
} from "fs";

import { createCipheriv, createDecipheriv } from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import { join } from "path";

import CacheRecord from "./record";

const client = new NodeCache();

let storage: string | undefined;

class Cache {
    static get<T>(key: string): T | undefined {
        const value = client.get(key);

        if (value === undefined) return undefined;

        return value as T;
    }

    static set<T>(key: string, value: T, ttl: number) {
        const results = client.set(key, value, ttl * 60);

        Cache.save();

        return results;
    }

    static remove(key: string) {
        client.del(key);

        Cache.save();
    }

    static load(path: string) {
        storage = path;

        if (existsSync(join(storage, "cache"))) {
            const now = (new Date()).getTime();
            const cipher = createDecipheriv("aes-256-cbc", "jB862gBM2dk3!^0XY@xIwM1631Ue7zqo", "XT2IN0SK62F1DK5G");

            const content = readFileSync(join(storage, "cache"));

            const decompressed = gunzipSync(content);
            const decrypted = cipher.update(decompressed.toString(), "hex", "utf8") + cipher.final("utf8");
            const cache = JSON.parse(decrypted) as CacheRecord[];

            for (let i = 0; i < cache.length; i += 1) {
                const ttl = (cache[i].ttl || 0 - now) / 1000;

                if (ttl > 0) client.set(cache[i].key, cache[i].value, ttl);
            }
        }
    }

    static save() {
        if (storage && existsSync(storage)) {
            const cache: CacheRecord[] = [];
            const keys = client.keys();

            for (let i = 0; i < keys.length; i += 1) {
                cache.push({ key: keys[i], value: client.get(keys[i]), ttl: client.getTtl(keys[i]) });
            }

            const cipher = createCipheriv("aes-256-cbc", "jB862gBM2dk3!^0XY@xIwM1631Ue7zqo", "XT2IN0SK62F1DK5G");
            const content = cipher.update(JSON.stringify(cache), "utf8", "hex") + cipher.final("hex");
            const compressed = gzipSync(content);

            writeFileSync(join(storage, "cache"), compressed);
        }
    }
}

export default Cache;
export { CacheRecord };
