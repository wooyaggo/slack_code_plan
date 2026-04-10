import type { ClassifyResult } from "./types";
export declare function recordMissedExample(text: string): Promise<void>;
export declare function classifyMessage(text: string, attachmentNames?: string[]): Promise<ClassifyResult>;
