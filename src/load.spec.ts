import test from "ava";
import { load } from "./load";

test("load empty file returns null", (t) => {
    t.is(load(""), null);
});

test("load a file with comments and blanks returns null", (t) => {
    t.is(load("    # comment\n  \n"), null);
});

test("array", (t) => {
    t.deepEqual(load("- one\n- two"), [ "one", "two" ]);
});

test("object", (t) => {
    t.deepEqual(load("key: value"), { key: "value" });
});
