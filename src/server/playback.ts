import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { copy } from './utility';
import { UserId } from './zone';

export type PlayableSource = { type: string };

export interface PlayableMetadata {
    title: string;
    duration: number;
}

export interface PlayableMedia<TSource extends PlayableSource = PlayableSource> {
    source: TSource;
    details: PlayableMetadata;
}

export type QueueInfo = { userId?: UserId; ip?: unknown };
export type QueueItem = { media: PlayableMedia; info: QueueInfo };

export type PlaybackState = {
    current?: QueueItem;
    queue: QueueItem[];
    time: number;
};

export interface Playback {
    on(event: 'play' | 'queue', callback: (media: QueueItem) => void): this;
    on(event: 'stop', callback: () => void): this;
}

export class Playback extends EventEmitter {
    public currentItem?: QueueItem;
    public queue: QueueItem[] = [];
    public paddingTime = 0;

    private currentBeginTime: number = 0;
    private currentEndTime: number = 0;
    private checkTimeout: NodeJS.Timeout | undefined;

    constructor() {
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

    queueMedia(media: PlayableMedia, info: QueueInfo = {}) {
        const queued = { media, info };
        this.queue.push(queued);
        this.emit('queue', queued);
        this.check();
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
        this.setMedia(media, 0);
    }

    private clearMedia() {
        if (this.currentItem) this.emit('stop');
        this.setTime(0);
        this.currentItem = undefined;
    }

    private check() {
        if (this.playing) {
            if (this.checkTimeout) clearTimeout(this.checkTimeout);
            this.checkTimeout = setTimeout(() => this.check(), this.remainingTime + this.paddingTime);
        } else {
            this.skip();
        }
    }

    private setMedia(item: QueueItem, time = 0) {
        this.currentItem = item;
        this.setTime(item.media.details.duration, time);
        this.emit('play', copy(item));
    }

    private setTime(duration: number, time = 0) {
        this.currentBeginTime = performance.now() - time;
        this.currentEndTime = this.currentBeginTime + duration;
        if (duration > 0) this.check();
    }
}

export default Playback;
