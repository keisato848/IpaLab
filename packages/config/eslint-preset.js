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
        // button 要素には必ず type を明示する (submit/reset/button)
        "react/button-has-type": "error",
        // select/input 等のフォームコントロールはアクセシブル名が必要
        "jsx-a11y/control-has-associated-label": [
            "warn",
            {
                labelAttributes: ["aria-label", "aria-labelledby", "title"],
                controlComponents: [],
                ignoreElements: ["audio", "canvas", "embed", "input", "textarea", "tr", "video"],
                ignoreRoles: ["grid", "listbox", "menu", "menubar", "radiogroup", "row", "tablist", "toolbar", "tree", "treegrid"],
                depth: 5,
            },
        ],
    },
};
