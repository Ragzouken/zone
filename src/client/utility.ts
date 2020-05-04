import { rgbaToColor } from 'blitsy';
import { UserId } from './client';

export type PlayableSource = { type: string };
export interface PlayableMetadata {
    title: string;
    duration: number;
}
export interface PlayableMedia<TSource extends PlayableSource = PlayableSource> {
    source: TSource;
    details: PlayableMetadata;
}
export type QueueInfo = { userId: UserId };
export type QueueItem = { media: PlayableMedia; info: QueueInfo };

export const objEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const clamp = (min: number, max: number, value: number) => Math.max(min, Math.min(max, value));

export function fakedownToTag(text: string, fd: string, tag: string) {
    const pattern = new RegExp(`${fd}([^${fd}]+)${fd}`, 'g');
    return text.replace(pattern, `{+${tag}}$1{-${tag}}`);
}

const pad2 = (part: number) => (part.toString().length >= 2 ? part.toString() : '0' + part.toString());
export function secondsToTime(seconds: number) {
    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);

    return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

export function recolor(context: CanvasRenderingContext2D) {
    withPixels(context, (pixels) => {
        for (let i = 0; i < pixels.length; ++i)
            if (pixels[i] === 0xffffffff) pixels[i] = rgbaToColor({ r: 128, g: 159, b: 255, a: 255 });
    });
}

// source : https://gist.github.com/mjackson/5311256
export function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

export function hslToRgb(h: number, s: number, l: number) {
    let r;
    let g;
    let b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}

export function withPixels(context: CanvasRenderingContext2D, action: (pixels: Uint32Array) => void) {
    const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    action(new Uint32Array(image.data.buffer));
    context.putImageData(image, 0, 0);
}

export function num2hex(value: number): string {
    return rgb2hex(num2rgb(value));
}

export function rgb2num(r: number, g: number, b: number, a: number = 255) {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function num2rgb(value: number): [number, number, number] {
    const r = (value >> 0) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = (value >> 16) & 0xff;

    return [r, g, b];
}

export function rgb2hex(color: [number, number, number]): string {
    const [r, g, b] = color;
    let rs = r.toString(16);
    let gs = g.toString(16);
    let bs = b.toString(16);

    if (rs.length < 2) {
        rs = '0' + rs;
    }
    if (gs.length < 2) {
        gs = '0' + gs;
    }
    if (bs.length < 2) {
        bs = '0' + bs;
    }

    return `#${rs}${gs}${bs}`;
}

export function hex2rgb(color: string): [number, number, number] {
    const matches = color.match(/^#([0-9a-f]{6})$/i);

    if (matches) {
        const match = matches[1];

        return [parseInt(match.substr(0, 2), 16), parseInt(match.substr(2, 2), 16), parseInt(match.substr(4, 2), 16)];
    }

    return [0, 0, 0];
}

export function getDefault<K, V>(map: Map<K, V>, key: K, factory: (key: K) => V): V {
    let value = map.get(key);
    if (!value) {
        value = factory(key);
        map.set(key, value);
    }
    return value!;
}

export function eventToElementPixel(event: PointerEvent, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.x, event.clientY - rect.y];
}
