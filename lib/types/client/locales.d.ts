/** Locale namespace owned by this plugin's card. */
export declare const NS = "dshMermaid";
/** Chinese dictionary; the key set is the source of truth. */
export declare const zh: {
    preparing: string;
    running: string;
    copy: string;
    copied: string;
    footnotes: string;
    zoomIn: string;
    zoomOut: string;
    reset: string;
};
/** Every key the card translates. */
export type MermaidKey = keyof typeof zh;
/** English dictionary; completeness is checked against {@link MermaidKey}. */
export declare const en: {
    preparing: string;
    running: string;
    copy: string;
    copied: string;
    footnotes: string;
    zoomIn: string;
    zoomOut: string;
    reset: string;
};
