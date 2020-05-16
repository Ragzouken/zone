import { QueueItem } from "../server/playback";
import { EventEmitter } from "events";

export class Player extends EventEmitter {
    private item?: QueueItem;
    private itemPlayStart = 0;

    constructor(private readonly element: HTMLVideoElement) {
        super();

        this.element.addEventListener('loadeddata', () => this.reseek());
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

    private reseek() {
        this.element.currentTime = this.elapsed / 1000;
    }

    private reloadSource() {
        if (!this.item) return;

        this.element.pause();
        this.element.src = this.item.media.source;
        this.element.load();
        this.reseek();
        this.element.play().catch(() => setTimeout(() => this.reloadSource(), 200));
    }

    private removeSource() {
        this.element.pause();
        this.element.removeAttribute('src');
        this.element.load();
    }
}
