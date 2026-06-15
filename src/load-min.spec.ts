import { test } from "node:test";
import * as assert from "node:assert";
import { loadMin } from "./load-min.js";

test("load empty file returns null", () => {
    assert.strictEqual(loadMin(""), null);
});

test("load a file with comments and blanks returns null", () => {
    assert.strictEqual(loadMin("    # comment\n  \n"), null);
});

test("array", () => {
    assert.deepStrictEqual(loadMin("- one\n- two"), [ "one", "two" ]);
});

test("object", () => {
    assert.deepStrictEqual(loadMin("key: value"), { key: "value" });
});

test("website example", () => {
    assert.deepStrictEqual(loadMin(`default repository: home
report style: tree
compact format: {repo}: {size:{fmt}}.  Last back up: {last_create:ddd, MMM DD}.
normal format: {host:<8} {user:<5} {config:<9} {size:<8.2b} {last_create:ddd, MMM DD}
date format: D MMMM YYYY
size format: .2b

repositories:
    # only the composite repositories need be included
    home:
        children: rsync borgbase
    caches:
        children: cache cache@media cache@files
    servers:
        children:
            - root@dev~root
            - root@mail~root
            - root@media~root
            - root@web~root
    all:
        children: home caches servers`), {
        "default repository": "home",
        "report style": "tree",
        "compact format": "{repo}: {size:{fmt}}.  Last back up: {last_create:ddd, MMM DD}.",
        "normal format": "{host:<8} {user:<5} {config:<9} {size:<8.2b} {last_create:ddd, MMM DD}",
        "date format": "D MMMM YYYY",
        "size format": ".2b",
        "repositories": {
            "home": {
                "children": "rsync borgbase"
            },
            "caches": {
                "children": "cache cache@media cache@files"
            },
            "servers": {
                "children": [
                    "root@dev~root",
                    "root@mail~root",
                    "root@media~root",
                    "root@web~root"
                ]
            },
            "all": {
                "children": "home caches servers"
            }
        }
    });
});

test("website example for indentation", () => {
    assert.deepStrictEqual(loadMin(`Name 1: Value 1
Name 2:
    Name 2a: Value 2a
    Name 2b: Value 2b
Name 3:
    - Value 3a
    - Value 3b
Name 4:
    > Value 4 line 1
    > Value 4 line 2`), {
        "Name 1": "Value 1",
        "Name 2": {
            "Name 2a": "Value 2a",
            "Name 2b": "Value 2b"
        },
        "Name 3": [ "Value 3a", "Value 3b" ],
        "Name 4": "Value 4 line 1\nValue 4 line 2"
    });
});
