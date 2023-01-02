const { join } = require("path");

module.exports = {
    parser: "@typescript-eslint/parser",
    extends: [
        "airbnb-typescript/base",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    ignorePatterns: ["bin/", "dist/", "test/", "scripts/", "**/.eslintrc.js", "**/jest.config.ts", "**/jest-mongodb-config.js"],
    parserOptions: {
        project: join(__dirname, "tsconfig.json"),
        ecmaVersion: 2018,
        sourceType: "module",
        noWatch: true,
    },
    rules: {
        quotes: ["error", "double"],
        "@typescript-eslint/quotes": ["error", "double"],
        indent: ["error", 4, { "SwitchCase": 1 }],
        "@typescript-eslint/indent": ["error", 4],
        "linebreak-style": ["error", "unix"],
        "comma-dangle": ["error", "always-multiline"],
        "max-len": ["error", { "code": 220 }],
        "no-loop-func": "off",
        "no-await-in-loop": "off",
        "no-param-reassign": "off",
        "spaced-comment": "off",
        "no-console": "off",
        "default-case": "off",
        "no-new": "off",
        "@typescript-eslint/no-loop-func": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "class-methods-use-this": "off",
        "import/extensions": "off",
        "import/no-cycle": "off",
        "import/no-extraneous-dependencies": "off"
    },
    overrides: [
        {
            files: ["*.test.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
            },
        },
        {
            files: ["src/services/hub.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/ban-ts-comment": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
            },
        }, {
            files: ["src/services/bridge.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/ban-ts-comment": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
            },
        }, {
            files: ["src/services/accessories.ts"],
            rules: {
                "@typescript-eslint/ban-ts-comment": "off",
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
            },
        }, {
            files: ["src/services/plugins.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
                "@typescript-eslint/no-unsafe-call": "off",
            },
        }, {
            files: ["src/services/manager.ts"],
            rules: {
                "@typescript-eslint/ban-ts-comment": "off",
            },
        }, {
            files: ["src/controllers/bridges.ts"],
            rules: {
                "@typescript-eslint/no-unsafe-call": "off",
                "@typescript-eslint/no-unsafe-assignment": "off",
                "@typescript-eslint/no-unsafe-member-access": "off",
            },
        },
    ],
};
