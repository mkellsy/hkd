interface CacheRecord {
    key: string;
    value: unknown;
    ttl: number | undefined;
}

export default CacheRecord;
