import * as tmp from 'tmp';

tmp.setGracefulCleanup();
const removes = new Map<string, () => void>();

export async function getCacheFile(prefix: string, postfix: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            discardDescriptor: true,
            mode: 0o644,
            prefix,
            postfix,
        };

        tmp.file(options, (err, path, _, remove) => {
            if (err) reject(err);

            removes.set(path, remove);
            resolve(path);
        });
    });
}

export async function killCacheFile(path: string) {
    const remove = removes.get(path);
    if (remove) remove();
    removes.delete(path);
}
