export interface NestedTextList extends Array<NestedText> {}
export interface NestedTextDict {
    [key: string]: NestedText;
};
export type NestedText = string | NestedTextList | NestedTextDict;
