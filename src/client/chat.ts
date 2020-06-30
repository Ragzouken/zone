import { createContext2D, decodeFont, fonts, makeVector2, imageToContext } from 'blitsy';
import { Page, scriptToPages, getPageHeight, PageRenderer } from './text';
import { hex2rgb, rgb2num, hslToRgb } from './utility';
import { randomInt } from '../common/utility';

const font = decodeFont(fonts['ascii-small']);
const layout = { font, lineWidth: 240, lineCount: 9999 };

export function filterDrawable(text: string) {
    return [...text].map((char) => ((char.codePointAt(0) || 0) < 256 ? char : '?')).join('');
}

export class ChatPanel {
    public readonly context = createContext2D(256, 256);
    public chatPages: Page[] = [];

    private pageRenderer = new PageRenderer(256, 256);
    private cached = new Map<Page, CanvasImageSource>();
    private timers = new Map<Page, number>();

    constructor(public previewTime = 5000) {
    }

    public status(text: string) {
        this.log('{clr=#FF00FF}! ' + text);
    }

    public log(text: string) {
        text = filterDrawable(text);
        const page = scriptToPages(text, layout)[0];
        this.timers.set(page, performance.now() + this.previewTime);

        this.chatPages.push(page);
        this.chatPages.slice(0, -32).forEach((page) => this.cached.delete(page));
        this.chatPages = this.chatPages.slice(-32);
    }

    public render(full: boolean) {
        this.context.clearRect(0, 0, 256, 256);
        const now = performance.now();
        let bottom = 256 - 4;
        for (let i = this.chatPages.length - 1; i >= 0 && bottom >= 0; --i) {
            const page = this.chatPages[i];
            const messageHeight = getPageHeight(page, font);
            const y = bottom - messageHeight;

            if (!full) {
                const expiry = this.timers.get(page) || 0;
                if (expiry < now) break;
            }

            let render = this.cached.get(page);
            if (!render) {
                const animated = animatePage(page);
                this.pageRenderer.renderPage(page, 8, 8);
                render = this.pageRenderer.pageImage;
                if (!animated) this.cached.set(page, imageToContext(render as any).canvas);
            }
            
            this.context.drawImage(render, 0, y-8);
            bottom = y;
        }
    }
}

export function animatePage(page: Page) {
    let animated = false;
    page.forEach((glyph, i) => {
        glyph.hidden = false;
        if (glyph.styles.has('r')) glyph.hidden = false;
        if (glyph.styles.has('clr')) {
            const hex = glyph.styles.get('clr') as string;
            const rgb = hex2rgb(hex);
            glyph.color = rgb2num(...rgb);
        }
        if (glyph.styles.has('shk')) {
            animated = true;
            glyph.offset = makeVector2(randomInt(-1, 1), randomInt(-1, 1));
        }
        if (glyph.styles.has('wvy')) {
            animated = true;
            glyph.offset.y = (Math.sin(i + (performance.now() * 5) / 1000) * 3) | 0;
        }
        if (glyph.styles.has('rbw')) {
            animated = true;
            const h = Math.abs(Math.sin(performance.now() / 600 - i / 8));
            const [r, g, b] = hslToRgb(h, 1, 0.5);
            glyph.color = rgb2num(r, g, b);
        }
    });
    return animated;
}
