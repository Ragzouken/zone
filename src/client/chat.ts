import { createContext2D, decodeFont, fonts, makeVector2 } from 'blitsy';
import { Page, scriptToPages, getPageHeight, PageRenderer } from './text';
import { hex2rgb, rgb2num, hslToRgb, randomInt } from './utility';

const font = decodeFont(fonts['ascii-small']);
const layout = { font, lineWidth: 240, lineCount: 9999 };

export class ChatPanel {
    public readonly context = createContext2D(256, 256);
    public chatPages: Page[] = [];

    private pageRenderer = new PageRenderer(256, 256);

    public log(text: string) {
        this.chatPages.push(scriptToPages(text, layout)[0]);
        this.chatPages = this.chatPages.slice(-32);
    }

    public render() {
        this.context.clearRect(0, 0, 256, 256);
        let bottom = 256 - 4;
        for (let i = this.chatPages.length - 1; i >= 0 && bottom >= 0; --i) {
            const page = this.chatPages[i];
            const messageHeight = getPageHeight(page, font);

            const y = bottom - messageHeight;

            animatePage(page);
            this.pageRenderer.renderPage(page, 8, y);
            this.context.drawImage(this.pageRenderer.pageImage, 0, 0);
            bottom = y;
        }
    }
}

export function animatePage(page: Page) {
    page.forEach((glyph, i) => {
        glyph.hidden = false;
        if (glyph.styles.has('r')) glyph.hidden = false;
        if (glyph.styles.has('clr')) {
            const hex = glyph.styles.get('clr') as string;
            const rgb = hex2rgb(hex);
            glyph.color = rgb2num(...rgb);
        }
        if (glyph.styles.has('shk')) glyph.offset = makeVector2(randomInt(-1, 1), randomInt(-1, 1));
        if (glyph.styles.has('wvy')) glyph.offset.y = (Math.sin(i + (performance.now() * 5) / 1000) * 3) | 0;
        if (glyph.styles.has('rbw')) {
            const h = Math.abs(Math.sin(performance.now() / 600 - i / 8));
            const [r, g, b] = hslToRgb(h, 1, 0.5);
            glyph.color = rgb2num(r, g, b);
        }
    });
}
