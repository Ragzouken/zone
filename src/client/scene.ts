import ZoneClient from "../common/client";
import { ZoneState, UserState } from "../common/zone";
import { randomInt } from "../common/utility";
import { hslToRgb, eventToElementPixel } from "./utility";
import { EventEmitter } from "events";
import { decodeAsciiTexture } from "blitsy";

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

const recolorCanvas = document.createElement("canvas");
recolorCanvas.width = 8;
recolorCanvas.height = 8;
const recolorContext = recolorCanvas.getContext("2d")!;

function recolor(canvas: HTMLCanvasElement, color: string) {
    recolorContext.save();
    recolorContext.fillStyle = color;
    recolorContext.fillRect(0, 0, 8, 8);
    recolorContext.globalCompositeOperation = 'destination-in';
    recolorContext.drawImage(canvas, 0, 0);
    recolorContext.restore();
    return recolorContext.canvas;
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

export class SceneRenderer extends EventEmitter
{
    mediaElement?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

    constructor(
        private readonly client: ZoneClient,
        private readonly zone: ZoneState,
        private readonly getTile: (base64: string | undefined) => CanvasRenderingContext2D,
        private readonly connecting: () => boolean,
    ) {
        super();
        const renderer = document.getElementById("renderer") as HTMLCanvasElement;
        const container = renderer.parentElement!;
        const context = renderer.getContext("2d")!;
        
        const logo = document.createElement("img");
        logo.src = "zone-logo-small.png";

        const image = document.createElement("img");
        image.src = "mockup-small.png";
        image.addEventListener('load', resize);

        let scale = 1;
        let margin = 0;

        let logox = 0;
        let logoy = 0;
        let vx = .3;
        let vy = .3;
        
        const screenWidth = 14. * 8;
        const screenHeight = 8. * 8;

        function animateLogo() {
            const width = logo.naturalWidth;
            const height = logo.naturalHeight;
    
            if (logox + width + vx > screenWidth || logox + vx < 0)
                vx *= -1;
            
            if (logoy + height + vy > screenHeight || logoy + vy < 0)
                vy *= -1;
            
            logox += vx;
            logoy += vy;
        }

        const render = () => {
            window.requestAnimationFrame(render);
            const inset = margin;
            context.fillStyle = connecting() ? 'red' : 'black';
            context.fillRect(0, 0, renderer.width, renderer.height);
            context.drawImage(image, inset, inset, 128 * scale, 128 * scale);
    
            context.save();
            this.zone.users.forEach((user) => drawAvatar(user));
            this.zone.echoes.forEach((echo) => drawAvatar(echo, true));
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
                const [width, height] = getSize(this.mediaElement)
        
                const ws = screenWidth * scale / width;
                const hs = screenHeight * scale / height;
                const s = Math.min(ws, hs);
                
                const rw = Math.floor(width * s);
                const rh = Math.floor(height * s);
        
                const ox = (8+0) * scale + Math.floor((screenWidth * scale - rw) / 2.);
                const oy = (8+3) * scale + Math.floor((screenHeight * scale - rh) / 2.);
        
                context.save();
                context.globalCompositeOperation = 'screen';
                context.drawImage(this.mediaElement, inset + ox, inset + oy, rw, rh);
                context.restore();
            }
        }
        render();

        const drawAvatar = (user: UserState, echo = false) => {
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

            let tile = this.getTile(user.avatar).canvas;

            let [r, g, b] = [255, 255, 255];
            if (user.emotes && user.emotes.includes('rbw')) {
                const h = Math.abs(Math.sin(performance.now() / 600 - x / 8));
                [r, g, b] = hslToRgb(h, 1, 0.5);
                r = Math.round(r);
                g = Math.round(g);
                b = Math.round(b);
                tile = recolor(tile, `rgb(${r} ${g} ${b})`);
            }

            const spin = user.emotes && user.emotes.includes('spn');
            const da = spin ? performance.now() / 150 - x : 0;
            const sx = Math.cos(da);
            const ox = (8 - sx*8)/2;

            context.globalAlpha = echo ? 0.5 : 1;

            context.drawImage(tile, margin + (x * 8 + ox + dx) * scale, margin + (z * 8 + dy) * scale, 8 * scale * sx, 8 * scale);
        };

        function resize() {
            const width = container.clientWidth;
            const height = container.clientHeight;
    
            const inner = Math.min(width, height);
            const outer = Math.max(width, height);
            const natural = image.naturalWidth;
    
            scale = Math.floor(inner / natural);
            const frame = natural * scale;
            margin = Math.ceil((outer - frame) / 2.);
    
            renderer.width = frame + margin * 2;
            renderer.height = frame + margin * 2;
            context.imageSmoothingEnabled = false;
        }
    
        window.addEventListener('resize', resize);
        resize();

        function mouseEventToTile(event: MouseEvent) {
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
        })

        renderer.addEventListener('mouseleave', (event) => {
            this.emit('unhover', event);
        });
    }
}
