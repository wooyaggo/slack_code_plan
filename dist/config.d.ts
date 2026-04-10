interface Config {
    slack: {
        botToken: string;
        appToken: string;
        botUserId: string;
    };
    project: {
        root: string;
        tmpDir: string;
    };
    classifier: {
        model: string;
    };
    session: {
        model: string;
        maxIdleMinutes: number;
    };
}
export declare function loadConfig(): Config | null;
export declare function getConfig(): Config;
export {};
