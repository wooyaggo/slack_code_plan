export declare function postStatus(channel: string, threadTs: string, text: string): Promise<string>;
export declare function updateStatus(channel: string, messageTs: string, text: string): Promise<void>;
export declare function replyToThread(channel: string, threadTs: string, text: string): Promise<void>;
export declare function uploadSnippet(channel: string, threadTs: string, content: string, filename: string): Promise<void>;
export declare function postError(channel: string, threadTs: string, error: string): Promise<void>;
