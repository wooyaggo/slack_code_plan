import type { ProcessedAttachment, SlackFile } from "./types";
export declare function downloadFiles(files: SlackFile[], threadTs: string): Promise<ProcessedAttachment[]>;
export declare function cleanupFiles(threadTs: string): Promise<void>;
