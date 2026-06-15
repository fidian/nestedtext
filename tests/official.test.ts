import { basename, join } from "node:path";
import { access, constants, readdir, stat, readFile } from "fs/promises";
import { test } from "node:test";
import * as assert from "node:assert";
import { dump, load } from "../src/index.js";
import type { DumpOptions } from "../src/index.js";

const basePath = join(process.cwd(), "tests/official_tests/test_cases");
const dirs = await readdir(basePath);

for (const dir of dirs) {
    const resolved = join(basePath, dir);
    if ((await stat(resolved)).isDirectory()) {
        try {
            await access(join(resolved, "load_in.nt"), constants.F_OK);
            await testLoad(resolved);
        } catch (_ignore) {}

        try {
            await access(join(resolved, "dump_in.json"), constants.F_OK);
            await testDump(resolved);
        } catch (_ignore) {}
    }
}

async function testLoad(dir: string) {
    const nt = await readFile(join(dir, "load_in.nt"), "utf8");

    try {
        await access(join(dir, "load_out.json"), constants.F_OK);
        const json = await loadJson(join(dir, "load_out.json"));
        test(`${basename(dir)}: load produces JSON`, () => {
            const result = load(nt);
            assert.deepStrictEqual(result, json);
        });
    } catch (_ignore) {
        const err = await loadJson(join(dir, "load_err.json"));

        test(`${basename(dir)}: load produces error`, () => {
            try {
                load(nt);
            } catch (e: any) {
                assert.strictEqual(e.lineno, err.lineno);
                assert.strictEqual(e.colno, err.colno);
                return;
            }
            assert.fail('No error was thrown');
        });
    }
}

async function testDump(dir: string) {
    const json = await loadJson(join(dir, "dump_in.json"));

    try {
        await access(join(dir, "dump_out.nt"), constants.F_OK);
        const nt = await readFile(join(dir, "dump_out.nt"), "utf8");
        test(`${basename(dir)}: dump produces NestedText`, () => {
            const options: DumpOptions = {};

            // string_8 has no way to detect the end of line marker from the
            // input JSON.
            // https://github.com/KenKundert/nestedtext_tests/issues/11
            // It is supposed to be system-dependent and string_8 needs
            // updating.
            // https://github.com/KenKundert/nestedtext_tests/issues/5#issuecomment-2276809952
            if (nt.indexOf('\r\n') !== -1) {
                options.newline = '\r\n';
            }

            assert.strictEqual(dump(json, options), nt);
        });
    } catch (_ignore) {
        const err = await loadJson(join(dir, "dump_err.json"));

        test(`${basename(dir)}: dump produces error`, () => {
            try {
                dump(json);
            } catch (e: any) {
                assert.deepStrictEqual(e.culprit, err.culprit);
                return;
            }

            assert.fail(`${dir}: dump did not produce an error`);
        });
    }
}

async function loadJson(path: string) {
    const json = await readFile(path, "utf8");
    return JSON.parse(json);
}
