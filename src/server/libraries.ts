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

    async request(method: string, url: string, body?: any): Promise<any> {
        return fetch(url, { method, headers: this.headers, body }).then(async (response) => {
            if (response.ok) {
                return response.json().catch(() => {});
            } else {
                throw new Error(await response.text());
            }
        });
    }

    async search(query: string) {
        return this.request("GET", `${this.endpoint}${query}`);
    }

    async getMeta(mediaId: string) {
        return this.request("GET", `${this.endpoint}/${mediaId}`);
    }

    async getStatus(mediaId: string) {
        return this.request("GET", `${this.endpoint}/${mediaId}/status`);
    }

    async requestMedia(mediaId: string) {
        return this.request("POST", `${this.endpoint}/${mediaId}/request`);
    }
};

export async function libraryToQueueableMedia(library: Library, mediaId: string) {
    const media = await library.getMeta(mediaId);
    media.library = library.prefix;
    await library.requestMedia(mediaId);
    return media;
}
