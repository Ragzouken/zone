import { QueueItem } from '../server/playback';
import { EventEmitter } from 'events';

export const NETWORK = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE']; 
export const READY = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];

export async function expectMetadata(element: HTMLMediaElement) {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject('timeout'), 2000);
        element.addEventListener('loadedmetadata', resolve, { once: true });
    });
}

export class Player extends EventEmitter {
    private item?: QueueItem;
    private itemPlayStart = 0;
    private reloading = false;

    constructor(private readonly element: HTMLVideoElement) {
        super();

        let lastUnstall = performance.now();
        setInterval(() => {
            if (this.reloading || !this.hasItem) return;
            
            if (this.element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                lastUnstall = performance.now();
            } else if (performance.now() - lastUnstall > 500) {
                this.reloadSource();
            }
        }, 100);
    }

    get playingItem() {
        return this.item;
    }

    get hasItem() {
        return this.item !== undefined;
    }

    get hasVideo() {
        return this.item && !this.item.media.source.endsWith('.mp3');
    }

    get duration() {
        return this.item?.media.duration || 0;
    }

    get elapsed() {
        return this.hasItem ? performance.now() - this.itemPlayStart : 0;
    }

    get status() {
        const network = NETWORK[this.element.networkState];
        const ready = READY[this.element.readyState];
        return `${network} / ${ready}`;
    }

    set volume(value: number) {
        this.element.volume = value;
    }

    setPlaying(item: QueueItem, seek: number) {
        this.itemPlayStart = performance.now() - seek;

        if (item !== this.item) {
            this.item = item;
            this.reloadSource();
        } else {
            this.reseek();
        }
    }

    stopPlaying() {
        this.item = undefined;
        this.itemPlayStart = performance.now();

        this.removeSource();
    }

    forceRetry() {
        console.log(this.status);
        this.reloadSource();
    }

    private reseek() {
        const target = this.elapsed / 1000;
        const error = Math.abs(this.element.currentTime - target);
        if (error > 0.1) this.element.currentTime = target;
    }

    private async reloadSource() {
        if (!this.item || this.reloading) return;
        this.reloading = true;

        console.log('reloading source', this.status);
        const waiter = expectMetadata(this.element);
        this.element.pause();
        this.element.src = this.item.media.source + '#t=' + this.elapsed / 1000;
        this.element.load();

        try {
            await waiter;
            this.reseek();
            await this.element.play();
            this.reloading = false;
        } catch (e) {
            this.reloading = false;
            console.log('source failed', this.status, e);
            this.reloadSource();
        } finally {
            this.reloading = false;
        }
    }

    private removeSource() {
        this.element.pause();
        this.element.removeAttribute('src');
        this.element.load();
    }
}
