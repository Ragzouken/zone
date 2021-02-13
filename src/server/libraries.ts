import fetch from "node-fetch";

export async function libraryMediaMeta(origin: string, mediaId: string, auth?: string) {
    const headers = auth ? { "Authorization": auth } : undefined;
    return fetch(`${origin}/${mediaId}`, { headers }).then((r) => r.json());
}

export async function libraryMediaRequest(origin: string, mediaId: string, auth?: string) {
    const headers = auth ? { "Authorization": auth } : undefined;
    return fetch(`${origin}/${mediaId}/request`, { method: "POST", headers });
}

export async function libraryMediaStatus(origin: string, mediaId: string, auth?: string) {
    const headers = auth ? { "Authorization": auth } : undefined;
    return fetch(`${origin}/${mediaId}/status`, { headers }).then((r) => r.json());
}

export async function libraryToQueueableMedia(origin: string, videoId: string, auth?: string) {
    const media = await libraryMediaMeta(origin, videoId, auth);
    media.getStatus = () => libraryMediaMeta(origin, videoId);
    media.request = () => libraryMediaRequest(origin, videoId, auth);
    await media.request();
    return media;
}
