import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import globals from 'globals'

// Flat config. Starts from vue3-essential (real bugs: unused vars in
// templates, v-for keys, reactivity mistakes) rather than the stricter
// style presets — formatting belongs to Prettier, and the style tiers
// would flood a codebase this size with noise before anyone reads the
// signal. Tighten one tier at a time once this is green in CI.
export default [
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    skipFormatting,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // Empty catch blocks are an established idiom here for
            // best-effort localStorage/clipboard access.
            'no-empty': ['error', { allowEmptyCatch: true }],
            // `_` marks deliberately ignored params/catches throughout
            // the codebase; flag every other unused binding.
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            // Multi-word rule fights the existing page names (Settings,
            // Dashboard...) registered via the router, where Vue's
            // native-tag collision concern doesn't apply.
            'vue/multi-word-component-names': 'off',
        },
    },
    {
        // Build scripts run under Node.
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'public/'],
    },
]
