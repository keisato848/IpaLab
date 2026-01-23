module.exports = {
    extends: ["eslint:recommended", "prettier"],
    env: {
        node: true,
        es2020: true,
    },
    ignorePatterns: ["dist", "node_modules"],
    rules: {
        "no-console": ["warn", { allow: ["warn", "error"] }],
    },
};
