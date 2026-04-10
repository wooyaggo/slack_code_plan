import type { AgentSession, ProcessedAttachment } from "./types";
export declare function createSession(threadTs: string, channel: string, message: string, attachments: ProcessedAttachment[]): Promise<string>;
export declare function continueSession(threadTs: string, message: string, attachments: ProcessedAttachment[]): Promise<string>;
export declare function getSession(threadTs: string): AgentSession | undefined;
export declare function closeSession(threadTs: string): void;
