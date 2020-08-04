import { EventEmitter } from 'events';

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const clamp = (min: number, max: number, value: number) => Math.max(min, Math.min(max, value));
export const copy = <T>(object: T) => JSON.parse(JSON.stringify(object)) as T;

export function getDefault<K, V>(map: Map<K, V>, key: K, factory: (key: K) => V): V {
    let value = map.get(key);
    if (!value) {
        value = factory(key);
        map.set(key, value);
    }
    return value!;
}

export function timeToSeconds(time: string): number {
    const parts = time.split(':');

    const seconds = parseInt(parts.pop() || '0', 10);
    const minutes = parseInt(parts.pop() || '0', 10);
    const hours = parseInt(parts.pop() || '0', 10);

    return seconds + minutes * 60 + hours * 3600;
}

export type EventMap = { [event: string]: (...args: any[]) => void };

export interface TypedEventEmitter<TEventMap extends EventMap> {
    on<K extends keyof TEventMap>(event: K, callback: TEventMap[K]): this;
    off<K extends keyof TEventMap>(event: K, callback: TEventMap[K]): this;
    once<K extends keyof TEventMap>(event: K, callback: TEventMap[K]): this;
    emit<K extends keyof TEventMap>(event: K, ...args: Parameters<TEventMap[K]>): boolean;
}

export function specifically<T extends any[]>(
    emitter: EventEmitter,
    event: string,
    predicate: (...args: T) => boolean,
    callback: (...args: T) => void,
) {
    const handler = (...args: T) => {
        if (predicate(...args)) {
            emitter.removeListener(event, handler as any);
            callback(...args);
        }
    };

    emitter.on(event, handler as any);
}

export function coordsToKey(coords: number[]): string {
    return coords.join(',');
}

export class Grid<T> {
    private readonly cells = new Map<string, [number[], T]>();

    get size() {
        return this.cells.size;
    }

    clear() {
        return this.cells.clear();
    }

    has(coords: number[]) {
        return this.cells.has(coordsToKey(coords));
    }

    get(coords: number[]) {
        const [, value] = this.cells.get(coordsToKey(coords)) || [undefined, undefined];
        return value;
    }

    set(coords: number[], value: T) {
        return this.cells.set(coordsToKey(coords), [coords, value]);
    }

    delete(coords: number[]) {
        return this.cells.delete(coordsToKey(coords));
    }

    forEach(callbackfn: (value: T, coords: number[], grid: Grid<T>) => void) {
        return this.cells.forEach(([coords, value]) => callbackfn(value, coords, this));
    }

    [Symbol.iterator]() {
        return this.cells.values();
    }
}
