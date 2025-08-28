import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

export default {
    input: 'src/main.tsx',             // make this your CLI entry
    output: {
        file: 'dist/cli.js',            // matches package.json "bin"
        format: 'esm',
        sourcemap: true,
        banner: '#!/usr/bin/env node'   // required for CLI
    },
    external: [
        'node:fs','node:fs/promises','node:path','node:os','node:process','node:child_process',
        'react','react/jsx-runtime','ink','ink-text-input',
        'fs','path','os'
    ],
    plugins: [
        json(),
        typescript({ tsconfig: './tsconfig.json' }),
    ]
};
