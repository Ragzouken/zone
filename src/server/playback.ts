import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { copy } from '../common/utility';
import { Media, QueueItem, QueueInfo } from '../common/zone';

export type PlaybackState = {
    current?: QueueItem;
    queue: QueueItem[];
    time: number;
};

export interface Playback {
    on(event: 'play' | 'queue' | 'unqueue', callback: (media: QueueItem) => void): this;
    on(event: 'stop', callback: () => void): this;
}

export class Playback extends EventEmitter {
    public currentItem?: QueueItem;
    public queue: QueueItem[] = [];

    private currentBeginTime: number = 0;
    private currentEndTime: number = 0;
    private checkTimeout: NodeJS.Timeout | undefined;

    private nextId = 0;

    constructor(public startDelay = 0) {
        super();
        this.clearMedia();
    }

    copyState(): PlaybackState {
        return {
            current: this.currentItem,
            queue: this.queue,
            time: this.currentTime,
        };
    }

    loadState(data: PlaybackState) {
        if (data.current) this.setMedia(data.current, data.time);
        data.queue.forEach((item) => this.queueMedia(item.media, item.info));
    }

    queueMedia(media: Media, info: QueueInfo = {}) {
        const itemId = this.nextId;
        this.nextId += 1;

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

    skip() {
        const next = this.queue.shift();
        if (next) this.playMedia(next);
        else this.clearMedia();
    }

    private playMedia(media: QueueItem) {
        this.setMedia(media, -this.startDelay);
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

    private setMedia(item: QueueItem, time = 0) {
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
