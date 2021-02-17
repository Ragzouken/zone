import { performance } from 'perf_hooks';
import { copy, sleep } from '../utility';

test('sleep', async () => {
    const target = 1;
    const begin = performance.now();
    await sleep(target * 1000);
    const duration = (performance.now() - begin) / 1000;
    expect(duration).toBeCloseTo(target, 0);
});

test('copy', () => {
    const obj = { hello: 'hello', count: 0 };
    const copied = copy(obj);
    expect(copied).toEqual(obj);
    copied.hello = 'goodbye';
    expect(copied).not.toEqual(obj);
});
