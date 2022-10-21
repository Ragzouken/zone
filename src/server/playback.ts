import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Media, QueueItem, QueueInfo } from './zone';
import { Library } from './libraries';

export const copy = <T>(object: T) => JSON.parse(JSON.stringify(object)) as T;

export type PlaybackState = {
    current?: QueueItem;
    queue: QueueItem[];
    time: number;
    nextId: number;
};

export interface Playback {
    on(event: 'play' | 'queue' | 'unqueue' | 'finish' | 'failed' | 'waiting', callback: (media: QueueItem) => void): this;
    on(event: 'stop', callback: () => void): this;
}

export class Playback extends EventEmitter {
    public currentItem?: QueueItem;
    public queue: QueueItem[] = [];

    private currentBeginTime: number = 0;
    private currentEndTime: number = 0;
    private checkTimeout: NodeJS.Timeout | undefined;

    private nextId = 0;

    constructor(private readonly libraries = new Map<string, Library>()) {
        super();
        this.clearMedia();
    }

    copyState(): PlaybackState {
        return {
            current: this.currentItem,
            queue: this.queue,
            time: this.currentTime,
            nextId: this.nextId,
        };
    }

    loadState(data: PlaybackState) {
        if (data.current) this.playMedia(data.current, data.time);
        data.queue.forEach((item) => this.queueMedia(item.media, item.info, item.itemId));
        this.nextId = data.nextId || 0;
    }

    queueMedia(media: Media, info: QueueInfo = {}, itemId?: number) {
        if (itemId === undefined) {
            itemId = this.nextId;
            this.nextId += 1;
        }

        const queued = { media, info, itemId };
        this.queue.push(queued);
        this.emit('queue', queued);
        this.check();
    }

    unqueue(item: QueueItem) {
        const index = this.queue.indexOf(item);
        if (index >= 0) {
            this.queue.splice(index, 1);
            this.emit('unqueue', item);
        }
    }

    get playing() {
        return this.remainingTime > 0;
    }

    get currentTime() {
        return performance.now() - this.currentBeginTime;
    }

    get remainingTime() {
        return Math.max(0, this.currentEndTime - performance.now());
    }

    async skip() {
        if (this.currentItem) this.emit('finish', this.currentItem);

        if (this.queue.length === 0) {
            this.clearMedia();
        } else {
            const next = this.queue[0];
            const library = this.libraries.get(next.media.library || "");
            const status = library ? await library.getStatus(next.media.mediaId) : 'available';
            if (status === 'available') {
                this.queue.shift();
                this.playMedia(next);
            } else if (status === 'requested') {
                this.clearMedia();
                if (this.checkTimeout) clearTimeout(this.checkTimeout);
                this.checkTimeout = setTimeout(() => this.check(), 500);
                this.emit('waiting', next);
            } else if (library && status === 'none') {
                library.request(next.media.mediaId);
            } else {
                this.queue.shift();
                this.playMedia(next);
                this.emit('failed', next);
            }
        }
    }

    private clearMedia() {
        if (this.currentItem) this.emit('stop');
        this.setTime(0);
        this.currentItem = undefined;
    }

    private check() {
        if (this.playing) {
            if (this.checkTimeout) clearTimeout(this.checkTimeout);
            this.checkTimeout = setTimeout(() => this.check(), this.remainingTime);
        } else {
            this.skip();
        }
    }

    private playMedia(item: QueueItem, time = 0) {
        this.currentItem = item;
        this.setTime(item.media.duration, time);
        this.emit('play', copy(item));
    }

    private setTime(duration: number, time = 0) {
        this.currentBeginTime = performance.now() - time;
        this.currentEndTime = this.currentBeginTime + duration;
        if (duration > 0) this.check();
    }
}

export default Playback;
