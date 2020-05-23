import * as tmp from 'tmp';
import { unlink } from 'fs';

tmp.setGracefulCleanup();

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
            resolve(path);
        });
    });
}

export async function killCacheFile(path: string) {
    unlink(path, console.log);
}
