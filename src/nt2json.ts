#!/usr/bin/env bash

import { load } from './load.js';
import readInput from 'read-input';

const files = [];

if (process.argv.length > 2) {
    files.push(process.argv[2]);
}

readInput(files).then((res) => {
    const input = res.files[0].data.toString();
    const output = load(input);
    console.log(JSON.stringify(output, null, 4));
}).catch((err) => {
    console.error(err.message);

    if (process.env.DEBUG) {
        console.error(err.stack);
    }

    process.exit(1);
});
