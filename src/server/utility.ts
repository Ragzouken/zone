import fetch from 'node-fetch';
import * as HTMLParser from 'node-html-parser';

export function objEqual(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function copy<T>(object: T): T {
    return JSON.parse(JSON.stringify(object));
}

export function timeToSeconds(time: string): number {
    const parts = time.split(':');

    const seconds = parseInt(parts.pop() || '0', 10);
    const minutes = parseInt(parts.pop() || '0', 10);
    const hours = parseInt(parts.pop() || '0', 10);

    return seconds + minutes * 60 + hours * 3600;
}

export async function fetchJson(url: string) {
    const json = await fetch(url).then((r) => r.text());
    return JSON.parse(json);
}

export async function fetchDom(url: string): Promise<HTMLParser.HTMLElement> {
    const address = encodeURI(url);
    const response = await fetch(address);
    const html = await response.text();
    return HTMLParser.parse(html) as HTMLParser.HTMLElement;
}

export function getDefault<K, V>(map: Map<K, V>, key: K, factory: (key: K) => V): V {
    let value = map.get(key);
    if (!value) {
        value = factory(key);
        map.set(key, value);
    }
    return value!;
}

export function copyObjectKeys(object: any, keys: string[]) {
    const copy: any = {};
    for (const key of keys) if (object[key] !== undefined) copy[key] = object[key];
    return copy;
}
