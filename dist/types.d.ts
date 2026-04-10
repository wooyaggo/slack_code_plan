export interface SlackFile {
    id: string;
    name: string;
    mimetype: string;
    filetype: string;
    url_private_download: string;
    size: number;
}
export interface SlackMessage {
    text: string;
    user: string;
    ts: string;
    thread_ts?: string;
    channel: string;
    files?: SlackFile[];
}
export interface ClassifyResult {
    type: "qa" | "chat";
    summary: string;
    urgency: "low" | "medium" | "high";
}
export interface ProcessedAttachment {
    original_name: string;
    local_path: string;
    mimetype: string;
    is_image: boolean;
    content?: string;
}
export interface AgentSession {
    session_id: string;
    thread_ts: string;
    channel: string;
    status: "active" | "idle" | "closed";
    created_at: number;
}
