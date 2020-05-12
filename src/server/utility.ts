import fetch, { RequestInit } from 'node-fetch';
import * as HTMLParser from 'node-html-parser';

export function timeToSeconds(time: string): number {
    const parts = time.split(':');

    const seconds = parseInt(parts.pop() || '0', 10);
    const minutes = parseInt(parts.pop() || '0', 10);
    const hours = parseInt(parts.pop() || '0', 10);

    return seconds + minutes * 60 + hours * 3600;
}

export async function fetchJson(url: string) {
    return await fetch(url).then((r) => r.json());
}

export async function fetchDom(url: string, init?: RequestInit): Promise<HTMLParser.HTMLElement> {
    const address = encodeURI(url);
    const response = await fetch(address, init);
    const html = await response.text();
    return HTMLParser.parse(html) as HTMLParser.HTMLElement;
}
