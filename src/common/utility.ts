export const objEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
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
