import { test } from "node:test";
import * as assert from "node:assert";
import { load } from "./load.js";

test("load empty file returns null", () => {
    assert.strictEqual(load(""), null);
});

test("load a file with comments and blanks returns null", () => {
    assert.strictEqual(load("# comment\n\n"), null);
});

test("array", () => {
    assert.deepStrictEqual(load("- one\n- two"), [ "one", "two" ]);
});

test("object", () => {
    assert.deepStrictEqual(load("key: value"), { key: "value" });
});
