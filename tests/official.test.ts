import { basename, join } from "path";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import test from "ava";
import { DumpOptions, dump, load } from "../src/index";

const basePath = join(process.cwd(), "tests/official_tests/test_cases");
const dirs = readdirSync(basePath);

for (const dir of dirs) {
    const resolved = join(basePath, dir);
    if (statSync(resolved).isDirectory()) {
        if (existsSync(join(resolved, "load_in.nt"))) {
            testLoad(resolved);
        }

        if (existsSync(join(resolved, "dump_in.json"))) {
            testDump(resolved);
        }
    }
}

function testLoad(dir) {
    const nt = readFileSync(join(dir, "load_in.nt"), "utf8");

    if (existsSync(join(dir, "load_out.json"))) {
        const json = require(join(dir, "load_out.json"));
        test(`${basename(dir)}: load produces JSON`, (t) => {
            t.notThrows(() => {
                const result = load(nt);

                t.deepEqual(result, json);
            });
        });
    } else {
        const err = require(join(dir, "load_err.json"));

        test(`${basename(dir)}: load produces error`, (t) => {
            try {
                load(nt);
                t.fail('No error was thrown');
            } catch (e) {
                t.is(e.lineno, err.lineno);
                t.is(e.colno, err.colno);
            }
        });
    }
}

function testDump(dir) {
    const json = require(join(dir, "dump_in.json"));

    if (existsSync(join(dir, "dump_out.nt"))) {
        const nt = readFileSync(join(dir, "dump_out.nt"), "utf8");
        test(`${basename(dir)}: dump produces NestedText`, (t) => {
            const options: DumpOptions = {};

            // string_8 has no way to detect the end of line marker from the input JSON.
            if (nt.indexOf('\r\n') !== -1) {
                options.newline = '\r\n';
            } else if (nt.indexOf('\r') !== -1) {
                options.newline = '\r';
            }

            t.is(dump(json, options), nt);
        });
    } else {
        const err = require(join(dir, "dump_err.json"));

        test(`${basename(dir)}: dump produces error`, (t) => {
            try {
                dump(json);
                t.fail(`${dir}: dump produces an error`);
            } catch (e) {
                t.deepEqual(e.culprit, err.culprit);
            }
        });
    }
}
