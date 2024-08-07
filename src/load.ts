import { NestedText, NestedTextList, NestedTextDict } from "./types";

enum ParsedLineType {
    BLANK = "B",
    COMMENT = "C",
    DICTIONARY_ITEM = "D",
    INLINE = "I",
    LIST_ITEM = "L",
    STRING_ITEM = "S",
    KEY_ITEM = "K"
}

interface ParsedLine {
    column: number;
    key?: string; // For dictionary items only
    indent: number;
    line: number;
    newline: string;
    nextIndex: number;
    startIndex: number; // Start of line
    type: ParsedLineType;
    value: NestedText | null;
}

export function load(input: string): NestedText | null {
    let parsed: ParsedLine = {
        column: 1,
        indent: 0,
        line: 0,
        newline: "",
        nextIndex: 0,
        startIndex: 0,
        type: ParsedLineType.BLANK,
        value: ""
    };
    const lines = [];

    // Pass 1: parse lines into a data structure
    do {
        parsed = parseLine(
            input,
            parsed.nextIndex,
            parsed.line + 1,
            parsed.column
        );
        lines.push(parsed);
    } while (parsed.newline);

    // Pass 2: remove comments and blank lines

    for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (
            lines[i].type === ParsedLineType.BLANK ||
            lines[i].type === ParsedLineType.COMMENT
        ) {
            lines.splice(i, 1);
        }
    }

    // Pass 3: combine multi-line tokens into one and detect indentation problems
    let i = 0;

    while (i < lines.length - 1) {
        const before = lines[i];
        const after = lines[i + 1];
        let merge = false;

        if (before.type === ParsedLineType.KEY_ITEM) {
            if (after.indent < before.indent) {
                throwError(
                    before.startIndex + before.indent,
                    before,
                    "Expected value"
                );
            }

            if (after.type === before.type) {
                if (before.indent > after.indent) {
                    throwError(
                        after.startIndex,
                        after,
                        "Unexpected indentation"
                    );
                }

                if (before.indent === after.indent) {
                    merge = true;
                }
            }
        }

        if (
            before.type === ParsedLineType.STRING_ITEM &&
            after.type === before.type
        ) {
            if (before.indent < after.indent) {
                throwError(
                    after.startIndex + before.indent,
                    after,
                    "Unexpected indentation"
                );
            }

            if (before.indent > after.indent) {
                throwError(after.startIndex, after, "Unexpected indentation");
            }

            merge = true;
        }

        if (before.type === ParsedLineType.LIST_ITEM) {
            if (
                after.type === ParsedLineType.LIST_ITEM &&
                before.indent < after.indent &&
                before.value
            ) {
                throwError(
                    after.startIndex + before.indent,
                    after,
                    "Unexpected indentation"
                );
            }

            if (
                before.indent === after.indent &&
                after.type !== ParsedLineType.LIST_ITEM
            ) {
                throwError(
                    after.startIndex + after.indent,
                    after,
                    "Incorrect type embedded within a list"
                );
            }
        }

        if (merge) {
            before.value += before.newline + after.value;
            before.newline = after.newline;
            lines.splice(i + 1, 1);
        } else {
            i += 1;
        }
    }

    let result = null;

    if (!lines.length) {
        return result;
    }

    if (lines[0].indent) {
        throwError(lines[0].startIndex, lines[0], "Unexpected indentation");
    }

    // Pass 3: build data structures

    if (lines[0].type === ParsedLineType.INLINE) {
        if (lines.length > 1) {
            throwError(null, lines[1], "Unexpected line after inline");
        }

        result = lines[0].value;
    } else if (lines[0].type === ParsedLineType.STRING_ITEM) {
        result = lines[0].value;
    } else {
        result = collect(lines, 0);

        if (lines.length) {
            throwError(
                null,
                lines[0],
                "Unexpected line after dictionary or list"
            );
        }
    }

    return result;
}

function parseLine(
    input: string,
    index: number,
    line: number,
    column: number
): ParsedLine {
    let result: ParsedLine = {
        column: column,
        indent: 0,
        line: line,
        newline: "",
        nextIndex: index,
        startIndex: index,
        type: ParsedLineType.BLANK,
        value: ""
    };

    while (input[index] === " ") {
        index += 1;
        result.indent += 1;
    }

    if (isWhitespace(input[index]) && !isNewlineOrEnd(input[index])) {
        throwError(
            index,
            result,
            `Only ASCII spaces are allowed as indentation, not ${JSON.stringify(input[index])}`
        );
    }

    if (isNewlineOrEnd(input[index])) {
        return conclude(input, index, result);
    }

    if (input[index] === "#") {
        return parseComment(input, index, result);
    }

    if (input[index] === ">" && (input[index + 1] === " " || isNewlineOrEnd(input[index + 1]))) {
        return parseStringItem(input, index, result);
    }

    if (
        input[index] === "-" &&
        (input[index + 1] === " " || isNewlineOrEnd(input[index + 1]))
    ) {
        return parseListItem(input, index, result);
    }

    if (
        input[index] === ":" &&
        (input[index + 1] === " " || isNewlineOrEnd(input[index + 1]))
    ) {
        return parseKeyItem(input, index, result);
    }

    if (input[index] === "[" || input[index] === "{") {
        return parseInline(input, index, result);
    }

    if (input[index]) {
        return parseDictionaryItem(input, index, result);
    }

    result.value = null;

    return result;
}

function isNewlineOrEnd(char: string): boolean {
    return char === "\r" || char === "\n" || !char;
}

function isWhitespace(char: string): boolean {
    return /\s/.test(char);
}

function throwError(
    index: number | null,
    result: ParsedLine,
    message: string
): never {
    const line = result.line;
    let error: Error;

    if (index !== null) {
        const column = result.column + index - result.startIndex;
        error = new Error(`Line ${line}, column ${column}: ${message}`);
        (error as any).lineno = line - 1; // Odd zero-based indexing for tests
        (error as any).colno = column - 1; // Odd zero-based indexing for tests
    } else {
        error = new Error(`Line ${line}: ${message}`);
        (error as any).lineno = line - 1; // Odd zero-based indexing for tests
        (error as any).colno = null;
    }

    throw error;
}

function conclude(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    if (input[index] === "\r" && input[index + 1] === "\n") {
        result.newline = "\r\n";
        result.nextIndex = index + 2;
    } else {
        result.newline = input[index];
        result.nextIndex = index + 1;
    }

    return result;
}

function parseComment(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.COMMENT;
    index += 1;

    while (!isNewlineOrEnd(input[index])) {
        index += 1;
    }

    return conclude(input, index, result);
}

function parseStringItem(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.STRING_ITEM;
    index += 1;

    if (isNewlineOrEnd(input[index])) {
        return conclude(input, index, result);
    }

    if (input[index] !== " ") {
        throwError(index, result, "Expected space after '>'");
    }

    index += 1;

    while (!isNewlineOrEnd(input[index])) {
        result.value += input[index];
        index += 1;
    }

    return conclude(input, index, result);
}

function parseListItem(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.LIST_ITEM;
    index += 1;

    if (isNewlineOrEnd(input[index])) {
        return conclude(input, index, result);
    }

    if (input[index] !== " ") {
        throwError(index, result, "Expected space after '-'");
    }

    index += 1;

    while (!isNewlineOrEnd(input[index])) {
        result.value += input[index];
        index += 1;
    }

    return conclude(input, index, result);
}

function parseKeyItem(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.KEY_ITEM;
    index += 1;

    if (isNewlineOrEnd(input[index])) {
        return conclude(input, index, result);
    }

    if (input[index] !== " ") {
        throwError(index, result, "Expected space after ':'");
    }

    index += 1;

    while (!isNewlineOrEnd(input[index])) {
        result.value += input[index];
        index += 1;
    }

    return conclude(input, index, result);
}

function isDictionaryKeyChar(char: string, next: string): boolean {
    if (isNewlineOrEnd(char)) {
        return false;
    }

    if (char === ':') {
        if (next === ' ' || isNewlineOrEnd(next)) {
            return false;
        }
    }

    return true;
}

function parseDictionaryItem(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.DICTIONARY_ITEM;
    let key = "";

    while (isDictionaryKeyChar(input[index], input[index + 1])) {
        key += input[index];
        index += 1;
    }

    result.key = key.trim();

    if (input[index] !== ":") {
        throwError(result.startIndex + result.indent, result, "Expected ':'");
    }

    index += 1;

    if (input[index] === " ") {
        index += 1;

        while (!isNewlineOrEnd(input[index])) {
            result.value += input[index];
            index += 1;
        }
    } else if (!isNewlineOrEnd(input[index])) {
        throwError(index, result, "Expected space after key");
    } else {
        result.value = null;
    }

    return conclude(input, index, result);
}

function parseInline(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    result.type = ParsedLineType.INLINE;

    if (input[index] === "[") {
        const { value, nextIndex } = parseInlineList(input, index, result);
        result.value = value;
        result.nextIndex = nextIndex;
    } else {
        const { value, nextIndex } = parseInlineDict(input, index, result);
        result.value = value;
        result.nextIndex = nextIndex;
    }

    if (!isNewlineOrEnd(input[result.nextIndex])) {
        throwError(result.nextIndex, result, "Expected newline or end of file");
    }

    return conclude(input, result.nextIndex, result);
}

function parseInlineList(
    input: string,
    index: number,
    result: ParsedLine
): { value: NestedTextList; nextIndex: number } {
    const value: NestedTextList = [];
    index += 1;

    if (input[index] === "]") {
        return { value, nextIndex: index + 1 };
    }

    while (true) {
        const { str, nextIndex } = parseInlineString(input, index, ",[]{}");
        let v: NestedText = str;
        index = nextIndex;

        if (input[index] === "[" && !str) {
            const { value: inlineList, nextIndex } = parseInlineList(
                input,
                index,
                result
            );
            index = nextIndex;
            v = inlineList;
        } else if (input[index] === "{" && !str) {
            const { value: inlineDict, nextIndex } = parseInlineDict(
                input,
                index,
                result
            );
            index = nextIndex;
            v = inlineDict;
        } else if ("[{}".indexOf(input[index]) >= 0) {
            throwError(index, result, `Unexpected '${input[index]}'`);
        }

        value.push(v);

        if (input[index] === "]") {
            index += 1;

            while (
                isWhitespace(input[index]) &&
                !isNewlineOrEnd(input[index])
            ) {
                index += 1;
            }

            return { value, nextIndex: index };
        }

        if (input[index] !== ",") {
            throwError(index, result, "Expected ',' or ']'");
        }

        index += 1;
    }
}

function parseInlineDict(
    input: string,
    index: number,
    result: ParsedLine
): { value: NestedTextDict; nextIndex: number } {
    const value: NestedTextDict = {};
    const prohibited = ",[]{}:";
    index += 1;

    if (input[index] === "}") {
        return { value, nextIndex: index + 1 };
    }

    while (true) {
        const { str: key, nextIndex: next1 } = parseInlineString(
            input,
            index,
            prohibited
        );
        index = next1;

        if (input[index] !== ":") {
            throwError(index, result, "Expected ':'");
        }

        index += 1;
        const { str, nextIndex: next2 } = parseInlineString(
            input,
            index,
            prohibited
        );
        index = next2;
        let v: NestedText = str;

        if (input[index] === "[" && !str) {
            const { value: inlineArray, nextIndex } = parseInlineList(
                input,
                index,
                result
            );
            index = nextIndex;
            v = inlineArray;
        } else if (input[index] === "{" && !str) {
            const { value: inlineDict, nextIndex } = parseInlineDict(
                input,
                index,
                result
            );
            index = nextIndex;
            v = inlineDict;
        } else if ("[]{".indexOf(input[index]) >= 0) {
            throwError(index, result, `Unexpected '${input[index]}'`);
        }

        value[key] = v;

        if (input[index] === "}") {
            index += 1;

            while (
                isWhitespace(input[index]) &&
                !isNewlineOrEnd(input[index])
            ) {
                index += 1;
            }

            return { value, nextIndex: index };
        }

        if (input[index] !== ",") {
            throwError(index, result, "Expected ',' or '}'");
        }

        index += 1;
    }
}

function parseInlineString(
    input: string,
    index: number,
    prohibited: string
): { str: string; nextIndex: number } {
    let value = "";

    while (
        prohibited.indexOf(input[index]) === -1 &&
        !isNewlineOrEnd(input[index])
    ) {
        value += input[index];
        index += 1;
    }

    return { str: value.trim(), nextIndex: index };
}

function collect(lines: ParsedLine[], indentLevel: number): NestedText {
    let result: NestedText;

    if (lines[0].type === ParsedLineType.LIST_ITEM) {
        result = collectIntoList(lines, indentLevel);
    } else if (
        lines[0].type === ParsedLineType.DICTIONARY_ITEM ||
        lines[0].type === ParsedLineType.KEY_ITEM
    ) {
        result = collectIntoDictionary(lines, indentLevel);
    } else if (
        lines[0].type === ParsedLineType.STRING_ITEM ||
        lines[0].type === ParsedLineType.INLINE
    ) {
        result = lines.shift()!.value!;
    } else {
        throwError(
            lines[0].startIndex,
            lines[0],
            "Expected dictionary, list, string, or inline"
        );
    }

    return result;
}

function collectIntoList(
    lines: ParsedLine[],
    indentLevel: number
): NestedTextList {
    const result: NestedTextList = [];

    while (lines.length) {
        const line = lines[0];

        if (line.indent < indentLevel) {
            return result;
        }

        if (line.type !== ParsedLineType.LIST_ITEM) {
            console.log(JSON.stringify(line), indentLevel);
            throwError(line.startIndex, line, "Expected list item");
        }

        let v = lines.shift()!.value!;

        if (!v && lines[0] && lines[0].indent > line.indent) {
            v = collect(lines, lines[0].indent);

            if (lines[0] && lines[0].indent > indentLevel) {
                throwError(
                    lines[0].startIndex,
                    lines[0],
                    "Unexpected indentation"
                );
            }
        }

        result.push(v);
    }

    return result;
}

function collectIntoDictionary(
    lines: ParsedLine[],
    indentLevel: number
): NestedTextDict {
    const result: NestedTextDict = {};

    while (lines.length) {
        if (lines[0].indent < indentLevel) {
            return result;
        }

        if (lines[0].indent === indentLevel) {
            let keyLine = lines[0];
            let key = null;
            let value = null;

            if (lines[0].type === ParsedLineType.DICTIONARY_ITEM) {
                lines.shift();
                key = keyLine.key!;
                value = keyLine.value;
            } else if (lines[0].type === ParsedLineType.KEY_ITEM) {
                lines.shift();
                key = keyLine.value! as string;
            } else {
                throwError(
                    lines[0].startIndex,
                    lines[0],
                    "Expected dictionary key"
                );
            }

            if (value === null && lines[0] && lines[0].indent > indentLevel) {
                value = collect(lines, lines[0].indent);

                if (lines[0] && lines[0].indent > indentLevel) {
                    throwError(
                        lines[0].startIndex,
                        lines[0],
                        "Unexpected indentation"
                    );
                }
            }

            if (result.hasOwnProperty(key)) {
                throwError(keyLine.startIndex + keyLine.indent, keyLine, `Duplicate key '${key}'`);
            }

            result[key] = value || "";
        } else {
            throwError(lines[0].startIndex, lines[0], "Unexpected indentation");
        }
    }

    return result;
}
