import fetch, { HeadersInit } from "node-fetch";

export class Library {
    private headers?: HeadersInit;

    constructor(
        readonly remote: string,
        readonly local?: string,
        readonly auth?: string,
    ) {
        this.local ||= this.remote;
        this.headers = this.auth ? { "Authorization": this.auth } : undefined;
    }

    async search(query: string) {
        return fetch(`${this.local}${query}`, { headers: this.headers }).then((r) => r.json());
    }

    async getMeta(mediaId: string) {
        return fetch(`${this.local}/${mediaId}`, { headers: this.headers }).then((r) => r.json());
    }

    async getStatus(mediaId: string) {
        return fetch(`${this.local}/${mediaId}/status`, { headers: this.headers }).then((r) => r.json());
    }

    async request(mediaId: string) {
        return fetch(`${this.local}/${mediaId}/request`, { method: "POST", headers: this.headers });
    }
};

export async function libraryToQueueableMedia(library: Library, videoId: string) {
    const media = await library.getMeta(videoId);
    media.getStatus = () => library.getStatus(videoId);
    media.request = () => library.request(videoId);
    await media.request();
    return media;
}
