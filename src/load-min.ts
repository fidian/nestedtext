import { NestedText, NestedTextList, NestedTextDict } from "./types";

enum ParsedLineType {
    BLANK = "B",
    COMMENT = "C",
    DICTIONARY_ITEM = "D",
    LIST_ITEM = "L",
    STRING_ITEM = "S"
}

interface ParsedLine {
    column: number;
    key?: string; // For dictionary items only
    indent: number;
    line: number;
    nextIndex: number;
    startIndex: number; // Start of line
    type: ParsedLineType;
    value: NestedText | null;
}

export function loadMin(input: string): NestedText | null {
    let parsed: ParsedLine = {
        column: 1,
        indent: 0,
        line: 0,
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
    } while (parsed.nextIndex < input.length);

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

        if (
            before.type === ParsedLineType.STRING_ITEM &&
            after.type === before.type
        ) {
            if (before.indent < after.indent) {
                throwError(
                    after.startIndex + before.indent,
                    after
                );
            }

            if (before.indent > after.indent) {
                throwError(after.startIndex, after);
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
                    after
                );
            }

            if (
                before.indent === after.indent &&
                after.type !== ParsedLineType.LIST_ITEM
            ) {
                throwError(
                    after.startIndex + after.indent,
                    after
                );
            }
        }

        if (merge) {
            before.value += "\n" + after.value;
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
        throwError(lines[0].startIndex, lines[0]);
    }

    // Pass 3: build data structures

    if (lines[0].type === ParsedLineType.STRING_ITEM) {
        result = lines[0].value;
    } else {
        result = collect(lines, 0);

        if (lines.length) {
            throwError(
                null,
                lines[0]
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
            result
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

    if (input[index] === "[" || input[index] === "{") {
        throwError(index, result);
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
    result: ParsedLine
): never {
    let message = `Line ${result.line}`;

    if (index !== null) {
        message += `, column ${result.column + index - result.startIndex}`;
    }

    throw new Error(message);
}

function conclude(
    input: string,
    index: number,
    result: ParsedLine
): ParsedLine {
    if (input[index] === "\r" && input[index + 1] === "\n") {
        result.nextIndex = index + 2;
    } else {
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
        throwError(index, result);
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
        throwError(index, result);
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
        throwError(result.startIndex + result.indent, result);
    }

    index += 1;

    if (input[index] === " ") {
        index += 1;

        while (!isNewlineOrEnd(input[index])) {
            result.value += input[index];
            index += 1;
        }
    } else if (!isNewlineOrEnd(input[index])) {
        throwError(index, result);
    } else {
        result.value = null;
    }

    return conclude(input, index, result);
}

function collect(lines: ParsedLine[], indentLevel: number): NestedText {
    let result: NestedText;

    if (lines[0].type === ParsedLineType.LIST_ITEM) {
        result = collectIntoList(lines, indentLevel);
    } else if (
        lines[0].type === ParsedLineType.DICTIONARY_ITEM
    ) {
        result = collectIntoDictionary(lines, indentLevel);
    } else if (
        lines[0].type === ParsedLineType.STRING_ITEM
    ) {
        result = lines.shift()!.value!;
    } else {
        throwError(
            lines[0].startIndex,
            lines[0]
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
            throwError(line.startIndex, line);
        }

        let v = lines.shift()!.value!;

        if (!v && lines[0] && lines[0].indent > line.indent) {
            v = collect(lines, lines[0].indent);

            if (lines[0] && lines[0].indent > indentLevel) {
                throwError(
                    lines[0].startIndex,
                    lines[0]
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
            } else {
                throwError(
                    lines[0].startIndex,
                    lines[0]
                );
            }

            if (value === null && lines[0] && lines[0].indent > indentLevel) {
                value = collect(lines, lines[0].indent);

                if (lines[0] && lines[0].indent > indentLevel) {
                    throwError(
                        lines[0].startIndex,
                        lines[0]
                    );
                }
            }

            if (result.hasOwnProperty(key)) {
                throwError(keyLine.startIndex + keyLine.indent, keyLine);
            }

            result[key] = value || "";
        } else {
            throwError(lines[0].startIndex, lines[0]);
        }
    }

    return result;
}
