import { QueueItem } from '../server/playback';
import { EventEmitter } from 'events';

export const NETWORK = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE']; 
export const READY = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];

export class Player extends EventEmitter {
    private item?: QueueItem;
    private itemPlayStart = 0;

    private retry = false;

    constructor(private readonly element: HTMLVideoElement) {
        super();

        this.element.addEventListener('loadeddata', () => this.reseek());
        this.element.addEventListener('error', () => (this.retry = true));
        this.element.addEventListener('ended', () => (this.retry = true));

        const test = (name: string) => {
            this.element.addEventListener(name, (e: any) => {
                console.log(name, NETWORK[this.element.networkState], READY[this.element.readyState], e);
            });
        }

        test('error');
        test('ended');
        test('waiting');

        setInterval(() => {
            if (this.retry) this.reloadSource();
        }, 200);

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
        this.retry = true;
    }

    private reseek() {
        const target = this.elapsed / 1000;
        const error = Math.abs(this.element.currentTime - target);
        if (error > 0.1) this.element.currentTime = target;
    }

    private reloadSource() {
        this.retry = false;
        if (!this.item) return;

        console.log('reloading source');
        this.element.pause();
        this.element.src = this.item.media.source + '#t=' + this.elapsed / 1000;
        this.element.load();
        this.reseek();
        this.element.play().catch(() => {
            console.log('play failed', NETWORK[this.element.networkState], READY[this.element.readyState]);
            (this.retry = true);
        });
    }

    private removeSource() {
        this.element.pause();
        this.element.removeAttribute('src');
        this.element.load();
    }
}
