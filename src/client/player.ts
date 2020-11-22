import { EventEmitter } from 'events';
import { sleep } from '../common/utility';
import { QueueItem } from '../common/zone';

export const NETWORK = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];
export const READY = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];

export async function expectMetadata(element: HTMLMediaElement) {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject('timeout'), 30 * 1000);
        element.addEventListener('loadedmetadata', resolve, { once: true });
        element.addEventListener('error', reject, { once: true });
    });
}

export interface Player {
    on(type: 'subtitles', callback: (lines: string[]) => void): this;
}

const STALL_TIMEOUT = 500;

export class Player extends EventEmitter {
    private item?: QueueItem;
    private itemPlayStart = 0;
    private reloading?: object;
    private startedPlaying = false;

    private source: HTMLSourceElement;
    private subtrack: HTMLTrackElement;

    constructor(private readonly element: HTMLVideoElement) {
        super();

        this.source = document.createElement('source');
        element.appendChild(this.source);
        this.subtrack = document.createElement('track');

        let lastUnstall = performance.now();
        let stallTimeout = STALL_TIMEOUT;
        setInterval(() => {
            if (!this.startedPlaying) return;

            const state = this.element.readyState;

            if (state >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                lastUnstall = performance.now();
            } else if (state >= HTMLMediaElement.HAVE_METADATA && performance.now() - lastUnstall > stallTimeout) {
                this.forceRetry('stalling');
                stallTimeout += STALL_TIMEOUT;
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

    get remaining() {
        return Math.max(0, this.duration - this.elapsed);
    }

    get status() {
        if (!this.item) {
            return 'done';
        } else if (this.element.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
            return 'no source';
        } else if (this.element.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
            return this.elapsed < 0 ? 'ready' : 'playing';
        } else if (this.element.readyState >= HTMLMediaElement.HAVE_METADATA) {
            return 'loading video';
        } else if (this.element.readyState === HTMLMediaElement.HAVE_NOTHING) {
            return 'loading metadata';
        } else {
            return 'loading video';
        }
    }

    get problem() {
        return this.status !== 'done'
            && this.status !== 'ready'
            && this.status !== 'playing';
    }

    get volume() {
        return this.element.volume;
    }

    set volume(value: number) {
        this.element.volume = value;
    }

    setPlaying(item: QueueItem, seek: number) {
        this.itemPlayStart = performance.now() - seek;

        if (item !== this.item) {
            this.item = item;
            this.removeSource();
            this.reloadSource();
        } else {
            this.reseek();
        }
    }

    stopPlaying() {
        this.item = undefined;
        this.itemPlayStart = performance.now();

        this.element.pause();
        this.removeSource();
    }

    forceRetry(reason: string) {
        console.log('forcing retry', reason, this.status);
        this.removeSource();
        this.reloadSource();
    }

    private reseek() {
        const target = this.elapsed / 1000;
        const error = Math.abs(this.element.currentTime - target);
        if (error > 0.1) this.element.currentTime = target;
    }

    private reloadSubtitles() {
        if (!this.item?.media.subtitle) return;

        this.subtrack = document.createElement('track');
        this.subtrack.kind = 'subtitles';
        this.subtrack.label = 'english';
        this.subtrack.src = this.item.media.subtitle;
        this.element.appendChild(this.subtrack);
        this.element.textTracks[0].mode = 'showing';

        this.subtrack.addEventListener('cuechange', (event) => {
            if (!this.subtrack) return;
            const cues = Array.from(this.subtrack.track.activeCues || []) as VTTCue[];
            const lines = cues.map((cue) => cue.text);
            this.emit('subtitles', lines);
        });
    }

    private async reloadSource(force = false) {
        if (!this.item || (!force && !!this.reloading)) return;
        this.removeSource();

        const token = {};
        this.startedPlaying = false;
        this.reloading = token;

        const done = () => {
            if (this.reloading === token) this.reloading = undefined;
        };

        this.reloadSubtitles();

        this.element.pause();
        const waiter = expectMetadata(this.element);
        this.source = document.createElement('source');
        this.source.src = this.item.media.source;
        this.element.appendChild(this.source);
        this.element.load();

        try {
            await waiter;
            if (this.elapsed < 0) await sleep(-this.elapsed);
            this.reseek();
            await this.element.play();
            this.startedPlaying = true;
            done();
        } catch (e) {
            console.log('source failed', this.status, e);
            if (this.reloading === token) {
                await sleep(500);
                this.reloadSource(true);
            }
        } finally {
            done();
        }
    }

    private removeSource() {
        this.reloading = undefined;
        this.startedPlaying = false;

        if (this.source.parentElement) this.element.removeChild(this.source);
        if (this.subtrack.parentElement) this.element.removeChild(this.subtrack);
    }
}
