#!/usr/bin/env bash

import { dump } from './dump.js';
import readInput from 'read-input';

const files = [];

if (process.argv.length > 2) {
    files.push(process.argv[2]);
}

readInput(files).then((res) => {
    const input = JSON.parse(res.files[0].data.toString());
    const output = dump(input);
    console.log(output);
}).catch((err) => {
    console.error(err.message);

    if (process.env.DEBUG) {
        console.error(err.stack);
    }

    process.exit(1);
});
