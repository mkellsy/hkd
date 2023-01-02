interface Package {
    name: string;
    version: string;
    keywords?: string[];
    exports?: string | Record<string, string | Record<string, string>>
    main?: string;
    type?: "module" | "commonjs";
    engines?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

export default Package;
