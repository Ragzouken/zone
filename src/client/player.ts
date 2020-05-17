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

        setInterval(() => {
            console.log(NETWORK[this.element.networkState], READY[this.element.readyState]);
        }, 500);
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

    get perfect() {
        return !this.hasItem || this.element.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA;
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
        
    }

    private reseek() {
        const target = this.elapsed / 1000;
        const error = Math.abs(this.element.currentTime - target);
        if (error > 0.1) this.element.currentTime = target;
    }

    private async reloadSource() {
        if (!this.item || this.reloading) return;
        this.reloading = true;

        console.log('reloading source', NETWORK[this.element.networkState], READY[this.element.readyState]);
        this.element.pause();
        this.element.src = this.item.media.source + '#t=' + this.elapsed / 1000;
        this.element.load();

        try {
            await expectMetadata(this.element);
            console.log('loaded metadata', NETWORK[this.element.networkState], READY[this.element.readyState]);
            this.reseek();
            await this.element.play();
            console.log('played', NETWORK[this.element.networkState], READY[this.element.readyState]);
        } catch (e) {
            console.log('failed', NETWORK[this.element.networkState], READY[this.element.readyState]);
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
