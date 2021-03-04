import ZoneClient from '../common/client';
import { ZoneState, UserState } from '../common/zone';
import { randomInt } from '../common/utility';
import { hslToRgb, eventToElementPixel } from './utility';
import { EventEmitter } from 'events';
import { createCanvas, createContext2D, decodeAsciiTexture, encodeTexture } from 'blitsy';
import { Player } from './player';

export const avatarImage = decodeAsciiTexture(
    `
___XX___
___XX___
___XX___
__XXXX__
_XXXXXX_
X_XXXX_X
__X__X__
__X__X__
`,
    'X',
);

const recolorBatchImage = createContext2D(8 * 256, 8);
const recolorBatchColor = createContext2D(8 * 256, 8);

type BatchRecolorItem = { 
    canvas: HTMLCanvasElement;
    color: string;
    callback: (index: number) => void;
}

function batchRecolor(items: BatchRecolorItem[]) {
    recolorBatchColor.clearRect(0, 0, 8 * 256, 8);
    recolorBatchImage.clearRect(0, 0, 8 * 256, 8);
    recolorBatchColor.globalCompositeOperation = 'source-over';

    items.forEach(({ canvas, color }, i) => {
        recolorBatchColor.fillStyle = color;
        recolorBatchColor.fillRect(i * 8, 0, 8, 8);
        recolorBatchImage.drawImage(canvas, i * 8, 0);
    });
    recolorBatchColor.globalCompositeOperation = 'destination-in';
    recolorBatchColor.drawImage(recolorBatchImage.canvas, 0, 0);

    items.forEach((item, i) => item.callback(i));
}

const isVideo = (element: HTMLElement | undefined): element is HTMLVideoElement => element?.nodeName === 'VIDEO';
const isCanvas = (element: HTMLElement | undefined): element is HTMLCanvasElement => element?.nodeName === 'CANVAS';
const isImage = (element: HTMLElement | undefined): element is HTMLImageElement => element?.nodeName === 'IMG';

function getSize(element: HTMLElement) {
    if (isVideo(element)) {
        return [element.videoWidth, element.videoHeight];
    } else if (isCanvas(element)) {
        return [element.width, element.height];
    } else if (isImage(element)) {
        return [element.naturalWidth, element.naturalHeight];
    } else {
        return [0, 0];
    }
}

export class SceneRenderer extends EventEmitter {
    mediaElement?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

    render: () => void;

    constructor(
        private readonly client: ZoneClient,
        private readonly zone: ZoneState,
        private readonly getTile: (base64: string | undefined) => CanvasRenderingContext2D,
        private readonly connecting: () => boolean,
        private readonly getStatus: () => string | undefined,
        private readonly player: Player,
    ) {
        super();
        const renderer = document.getElementById('renderer') as HTMLCanvasElement;
        const container = renderer.parentElement!;
        const context = renderer.getContext('2d')!;

        const logo = document.createElement('img');
        logo.src = 'zone-logo-small.png';

        const image = document.createElement('img');
        image.src = 'mockup-small.png';
        image.addEventListener('load', resize);

        let scale = 1;
        let margin = 0;

        let logox = 0;
        let logoy = 0;
        let vx = 0.3;
        let vy = 0.3;

        const screenWidth = 14 * 8;
        const screenHeight = 8 * 8;

        function animateLogo() {
            const width = logo.naturalWidth;
            const height = logo.naturalHeight;

            if (logox + width + vx > screenWidth || logox + vx < 0) vx *= -1;

            if (logoy + height + vy > screenHeight || logoy + vy < 0) vy *= -1;

            logox += vx;
            logoy += vy;
        }

        let subtitles: string[] = [];
        player.on('subtitles', (lines) => {
            subtitles = lines.slice().join('\n').split('\n').reverse();
        });

        this.render = () => {
            const inset = margin;
            context.fillStyle = connecting() ? 'red' : 'black';
            context.fillRect(0, 0, renderer.width, renderer.height);
            context.drawImage(image, inset, inset, 128 * scale, 128 * scale);

            context.save();
            context.translate(margin, margin);
            context.scale(scale, scale);

            const prepareAvatar = (user: UserState, ghost: boolean) => {
                if (!user.position) return;

                let [r, g, b] = [255, 255, 255];

                if (user.emotes && user.emotes.includes('rbw')) {
                    const h = Math.abs(Math.sin(performance.now() / 600 - user.position![0] / 8));
                    [r, g, b] = hslToRgb(h, 1, 0.5);
                    r = Math.round(r);
                    g = Math.round(g);
                    b = Math.round(b);
                }

                pairs.push({
                    canvas: this.getTile(user.avatar).canvas,
                    color: `rgb(${r} ${g} ${b})`,
                    callback: (i) => drawAvatar(user, ghost, i),
                });
            }

            const pairs: BatchRecolorItem[] = [];
            this.zone.users.forEach((user) => prepareAvatar(user, false));
            this.zone.echoes.forEach((echo) => prepareAvatar(echo, true));
            batchRecolor(pairs);

            context.restore();

            if (!this.mediaElement) {
                animateLogo();
                context.drawImage(
                    logo,
                    inset + 8 * scale + logox * scale,
                    inset + 8 * scale + (logoy + 3) * scale,
                    logo.naturalWidth * scale,
                    logo.naturalHeight * scale,
                );
            } else {
                const [width, height] = getSize(this.mediaElement);

                const ws = (screenWidth * scale) / width;
                const hs = (screenHeight * scale) / height;
                const s = Math.min(ws, hs);

                const rw = Math.floor(width * s);
                const rh = Math.floor(height * s);

                const ox = (8 + 0) * scale + Math.floor((screenWidth * scale - rw) / 2);
                const oy = (8 + 3) * scale + Math.floor((screenHeight * scale - rh) / 2);

                const state = getStatus();
                if (state) {
                    context.font = `${4 * scale}px ascii_small_simple`;
                    context.fillStyle = 'gray';
                    context.fillText(
                        state,
                        margin + (8 + 1) * scale,
                        margin + (8 + 3) * scale + (screenHeight - 1) * scale,
                    );
                }

                context.save();
                context.globalCompositeOperation = 'screen';
                context.drawImage(this.mediaElement, inset + ox, inset + oy, rw, rh);
                context.restore();

                context.save();
                context.globalCompositeOperation = 'source-over'
                context.font = `${2 * scale}px ascii_small_simple`;
                context.textAlign = 'center';
                context.fillStyle = 'black';
                subtitles.forEach((line, i) => {
                    const measure = context.measureText(line);
                    const tx = margin + (8 + 1) * scale + screenWidth * scale * 0.5;
                    const ty = margin + (8 + 3) * scale + (screenHeight - 1) * scale - 2 * scale * i;

                    const border = scale * .5;
                    const xMin = tx - measure.actualBoundingBoxLeft - border;
                    const xMax = tx + measure.actualBoundingBoxRight + border;
                    const yMin = ty - measure.actualBoundingBoxAscent - border;
                    const yMax = ty - measure.actualBoundingBoxDescent + border;

                    context.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);
                });
                context.fillStyle = 'gray';
                subtitles.forEach((line, i) => {
                    const tx = margin + (8 + 1) * scale + screenWidth * scale * 0.5;
                    const ty = margin + (8 + 3) * scale + (screenHeight - 1) * scale - 2 * scale * i;
                    context.fillText(line, tx, ty);
                });
                context.restore();
            }
        };

        const drawAvatar = (user: UserState, echo: boolean, index: number) => {
            if (!user.position) return;

            const [x, y, z] = user.position;
            if (x < 0 || z < 0 || x > 15 || z > 15) return;

            let [dy, dx] = [0, 0];
            if (user.emotes && user.emotes.includes('shk')) {
                dy += randomInt(-2, 2);
                dx += randomInt(-2, 2);
            }

            if (user.emotes && user.emotes.includes('wvy')) {
                dy -= 1 + Math.sin(performance.now() / 250 - x / 2) * 1;
            }

            const spin = user.emotes && user.emotes.includes('spn');

            context.save();
            context.globalAlpha = echo ? 0.5 : 1;
            context.translate(x * 8 + dx + 4, z * 8 + dy);
            if (spin) {
                const da = performance.now() / 150 - x;
                const sx = Math.cos(da);
                context.scale(sx, 1);
            }

            context.drawImage(
                recolorBatchColor.canvas, 
                index * 8, 0, 8, 8,
                -4, 0, 8, 8,
            );
            context.restore();
        };

        function resize() {
            const width = container.clientWidth;
            const height = container.clientHeight;

            const inner = Math.min(width, height);
            const outer = Math.max(width, height);
            const natural = image.naturalWidth;

            scale = Math.max(1, Math.floor(inner / natural));
            const frame = natural * scale;
            margin = Math.ceil((outer - frame) / 2);

            renderer.width = frame + margin * 2;
            renderer.height = frame + margin * 2;
            context.imageSmoothingEnabled = false;
        }

        window.addEventListener('resize', resize);
        resize();

        function mouseEventToTile(event: MouseEvent | Touch) {
            const [mx, my] = eventToElementPixel(event, renderer);
            const [sx, sy] = [mx - margin, my - margin];
            const inv = 1 / (8 * scale);
            const [tx, ty] = [Math.floor(sx * inv), Math.floor(sy * inv)];

            return [tx, ty];
        }

        renderer.addEventListener('click', (event) => {
            this.emit('click', event, mouseEventToTile(event));
        });

        renderer.addEventListener('mousemove', (event) => {
            this.emit('hover', event, mouseEventToTile(event));
        });

        renderer.addEventListener('mouseleave', (event) => {
            this.emit('unhover', event);
        });

        renderer.addEventListener('touchstart', (event) => {
            this.emit('click', event, mouseEventToTile(event.touches[0]));
        });

        let touchedTile: number[] | undefined;
        renderer.addEventListener('touchmove', (event) => {
            const [nx, ny] = mouseEventToTile(event.touches[0]);

            if (!touchedTile || touchedTile[0] !== nx || touchedTile[1] !== ny) {
                touchedTile = [nx, ny];
                this.emit('click', event, [nx, ny]);
            }
        });

        renderer.addEventListener('touchend', (event) => {
            touchedTile = undefined;
        });
    }
}
