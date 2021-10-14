import fetch, { HeadersInit } from "node-fetch";

export class Library {
    private headers?: HeadersInit;

    constructor(
        readonly prefix: string,
        readonly endpoint: string,
        readonly auth?: string,
    ) {
        this.headers = this.auth ? { "Authorization": this.auth } : undefined;
    }

    async search(query: string) {
        return fetch(`${this.endpoint}${query}`, { headers: this.headers }).then((r) => r.json());
    }

    async getMeta(mediaId: string) {
        return fetch(`${this.endpoint}/${mediaId}`, { headers: this.headers }).then((r) => r.json());
    }

    async getStatus(mediaId: string) {
        return fetch(`${this.endpoint}/${mediaId}/status`, { headers: this.headers }).then((r) => r.json());
    }

    async getProgress(mediaId: string) {
        return fetch(`${this.endpoint}/${mediaId}/progress`, { headers: this.headers }).then((r) => r.json());
    }

    async request(mediaId: string) {
        return fetch(`${this.endpoint}/${mediaId}/request`, { method: "POST", headers: this.headers });
    }
};

export async function libraryToQueueableMedia(library: Library, mediaId: string) {
    const media = await library.getMeta(mediaId);
    media.library = library.prefix;
    await library.request(mediaId);
    return media;
}
