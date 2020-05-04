import { performance } from 'perf_hooks';
import { timeToSeconds, copy, sleep } from '../utility';

const TIMES: [string, number][] = [
    ['1:32:10', 5530],
    ['01:32:10', 5530],
    ['00:51:11', 3071],
    ['0:51:11', 3071],
    ['51:11', 3071],
    ['01:0:00', 3600],
    ['01:00', 60],
    ['1', 1],
    [':', 0],
    ['::', 0],
];

test('sleep', async () => {
    const target = 1;
    const begin = performance.now();
    await sleep(target * 1000);
    const duration = (performance.now() - begin) / 1000;
    expect(duration).toBeCloseTo(target, 0);
});

test.each(TIMES)('timeToSeconds', async (time, seconds) => {
    expect(timeToSeconds(time)).toEqual(seconds);
});

test('copy', () => {
    const obj = { hello: 'hello', count: 0 };
    const copied = copy(obj);
    expect(copied).toEqual(obj);
    copied.hello = 'goodbye';
    expect(copied).not.toEqual(obj);
});
