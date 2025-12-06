import globals from "globals";

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // jQuery
        $: "readonly",
        jQuery: "readonly",
        // SillyTavern globals
        SillyTavern: "readonly",
        toastr: "readonly",
      }
    },
    rules: {
      // Possible errors
      "no-console": "off",
      "no-debugger": "warn",
      "no-duplicate-case": "error",
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-irregular-whitespace": "error",
      "no-unreachable": "error",
      
      // Best practices
      "curly": ["error", "multi-line"],
      "eqeqeq": ["error", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-return-assign": "error",
      "no-useless-concat": "error",
      "no-useless-escape": "error",
      "no-useless-return": "error",
      
      // Variables
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-use-before-define": ["error", { "functions": false, "classes": false }],
      "no-shadow": "warn",
      
      // Style (minimal - not enforcing formatting)
      "no-lonely-if": "warn",
      "no-unneeded-ternary": "warn",
      "prefer-const": "warn",
      "no-var": "error",
    }
  },
  {
    ignores: [
      "node_modules/",
      "*.json",
      "*.css",
      "*.html"
    ]
  }
];
