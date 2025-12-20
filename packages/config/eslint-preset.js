module.exports = {
    extends: ["next/core-web-vitals", "prettier"],
    settings: {
        next: {
            rootDir: ["apps/*/"],
        },
    },
    rules: {
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "@next/next/no-html-link-for-pages": "off",
    },
};
