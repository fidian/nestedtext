export interface NestedTextList extends Array<NestedText> {}
export interface NestedTextDict {
    [key: string]: NestedText;
};
export type NestedText = string | NestedTextList | NestedTextDict;
export interface NestedTextParseError extends Error {
    lineno: number;
    colno: number | null;
}
export interface NestedTextDumpError extends Error {
    culprit: any;
}
