import { EventEmitter } from 'events';
import { sleep } from './utility';

declare const YT: any;
declare global {
    interface Window {
        onYouTubePlayerAPIReady: () => void;
    }
}

export type YoutubeError = {
    code: number;
    reason: string;
};

export declare interface YoutubePlayer {
    on(event: 'error', listener: (error: YoutubeError) => void): this;
}

export class YoutubePlayer extends EventEmitter {
    private currentVideo: string | undefined;
    private startSeconds = 0;
    private retries = 0;

    constructor(public readonly player: any) {
        super();

        this.player.addEventListener('onError', (e: any) => this.onError(e));
    }

    public get video() {
        return this.currentVideo;
    }
    public get time(): number {
        return this.player.getCurrentTime();
    }
    public get duration(): number {
        return this.player.getDuration();
    }
    public get volume(): number {
        return this.player.getVolume();
    }
    public set volume(value: number) {
        this.player.setVolume(value);
    }

    public get playing() {
        return this.player.getPlayerState() === 1;
    }

    public playVideoById(videoId: string, startSeconds = 0, forceReload = false) {
        this.retries = 0;

        if (videoId !== this.currentVideo || forceReload) {
            this.currentVideo = videoId;
            this.startSeconds = startSeconds;
            this.player.loadVideoById({ videoId, startSeconds });
        } else {
            const delay = Math.abs(startSeconds - this.time);
            if (delay > 0.5) {
                this.startSeconds = startSeconds;
                this.player.seekTo(startSeconds, true);
            }
        }
    }

    public stop() {
        this.player.stopVideo();
    }

    private async onError(event: any) {
        const error = errorEventToYoutubeError(event);

        if (this.retries >= 3) {
            this.emit('error', error);
        } else {
            await sleep(500);
            this.retries += 1;
            this.player.loadVideoById({
                videoId: this.video,
                startSeconds: this.startSeconds,
            });
        }
    }
}

export function loadYoutube(id: string, width: number, height: number): Promise<YoutubePlayer> {
    return new Promise((resolve, reject) => {
        window.onYouTubePlayerAPIReady = () => {
            delete window.onYouTubePlayerAPIReady;
            const player = new YT.Player(id, {
                width: width.toString(),
                height: height.toString(),
                playerVars: {
                    controls: '0',
                    iv_load_policy: '3',
                    disablekb: '1',
                },
                events: {
                    onReady: () => resolve(new YoutubePlayer(player)),
                    onError: () => reject('youtube error :('),
                    onStateChange: (event: any) => console.log(`YT STATE: ${event.data}`),
                },
            });
        };

        const tag = document.createElement('script');
        tag.onerror = () => console.log('youtube error :(');
        tag.src = 'https://www.youtube.com/player_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
    });
}

// from https://developers.google.com/youtube/iframe_api_reference
const CODE_REASONS = new Map<number, string>();
CODE_REASONS.set(2, 'invalid parameter');
CODE_REASONS.set(5, 'HTML5 player error');
CODE_REASONS.set(100, 'video not found');
CODE_REASONS.set(101, 'video unembeddable');
CODE_REASONS.set(150, CODE_REASONS.get(101)!);

function errorEventToYoutubeError(event: any): YoutubeError {
    return { code: event.data, reason: CODE_REASONS.get(event.data) || 'unknown' };
}
