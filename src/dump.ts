import { NestedText, NestedTextDict, NestedTextList } from "./types";

export interface DumpOptions {
    indent?: string;
    newline?: string;
}

export function dump(content: NestedText, options: DumpOptions = {}): string {
    options = {
        indent: options.indent || "    ",
        newline: options.newline || "\n"
    };

    return dumpValue(content, "", options, content);
}

function hasNewlines(content: string) {
    return content.includes("\n") || content.includes("\r");
}

function mapLines(content: string, indent: string, options: DumpOptions, token: string): string {
    const lines = content.split(/\r?\n|\r/);

    return lines.map((item) => `${indent}${token}${item ? ' ' : ''}${item}${options.newline}`).join('');
}

function throwError(culprit: any, message: string): never {
    const error = new Error(message);
    (error as any).culprit = culprit;
    throw error;
}

function dumpValue(
    value: NestedText,
    indent: string,
    options: DumpOptions,
    culprit: NestedText
): string {
    if (Array.isArray(value)) {
        return dumpArray(value, indent, options);
    }

    if (typeof value === "object" && value !== null) {
        return dumpObject(value, indent, options);
    }

    if (typeof value === "string") {
        return dumpString(value, indent, options);
    }

    throwError(culprit, "Invalid value");
}

function dumpString(value: string, indent: string, options: DumpOptions): string {
    if (hasNewlines(value)) {
        return mapLines(value, indent, options, '>');
    }

    if (value) {
        return `${indent}> ${value}${options.newline}`;
    }

    return `${indent}>${options.newline}`;
}

function dumpArray(
    value: NestedTextList,
    indent: string,
    options: DumpOptions
): string {
    if (value.length === 0) {
        return `${indent}[]${options.newline}`;
    }

    return value
        .map((item) => {
            if (typeof item === "string" && !hasNewlines(item)) {
                if (item) {
                    return `${indent}- ${item}${options.newline}`;
                }

                return `${indent}-${options.newline}`;
            }

            return `${indent}-${options.newline}${dumpValue(item, indent + options.indent, options, item)}`;
        })
        .join('');
}

function dumpObject(
    value: NestedTextDict,
    indent: string,
    options: DumpOptions
): string {
    if (Object.keys(value).length === 0) {
        return `${indent}{}${options.newline}`;
    }

    return Object.entries(value)
        .map(([key, item]) => {
            if (hasNewlines(key) || key === '' || /^[[{\s]/.test(key) || /[-#>:] /.test(key)) {
                const keyStr = mapLines(key, indent, options, ':');
                const valueStr = dumpValue(
                    item,
                    indent + options.indent,
                    options,
                    key
                );

                return `${keyStr}${valueStr}`;
            }

            if (typeof item !== "string" || hasNewlines(item)) {
                const keyStr = `${indent}${key}:${options.newline}`;
                const valueStr = dumpValue(
                    item,
                    indent + options.indent,
                    options,
                    key
                );

                return `${keyStr}${valueStr}`;
            }

            if (item) {
                return `${indent}${key}: ${item}${options.newline}`;
            }

            return `${indent}${key}:${options.newline}`;
        })
        .join('');
}
