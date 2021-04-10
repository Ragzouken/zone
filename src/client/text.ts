import { Vector2, Sprite, Font, makeVector2, createContext2D, drawSprite, makeSprite, makeRect } from 'blitsy';
import { addListener } from 'process';
import { num2hex } from './utility';

const FALLBACK_CODEPOINT = '?'.codePointAt(0)!;

const REMAPPING: {[codepoint: number]: number} = {
0x0000: 0,
0x263A: 1,
0x263B: 2,
0x2665: 3,
0x2666: 4,
0x2663: 5,
0x2660: 6,
0x2022: 7,
0x25D8: 8,
0x25CB: 9,
0x25D9: 10,
0x2642: 11,
0x2640: 12,
0x266A: 13,
0x266B: 14,
0x263C: 15,

0x25BA: 16,
0x25C4: 17,
0x2195: 18,
0x203C: 19,
0x00B6: 20,
0x00A7: 21,
0x25AC: 22,
0x21A8: 23,
0x2191: 24,
0x2193: 25,
0x2192: 26,
0x2190: 27,
0x221F: 28,
0x2194: 29,
0x25B2: 30,
0x25BC: 31,

0x0020: 32,
0x0021: 33,
0x0022: 34,
0x0023: 35,
0x0024: 36,
0x0025: 37,
0x0026: 38,
0x0027: 39,
0x0028: 40,
0x0029: 41,
0x002A: 42,
0x002B: 43,
0x002C: 44,
0x002D: 45,
0x002E: 46,
0x002F: 47,

0x0030: 48,
0x0031: 49,
0x0032: 50,
0x0033: 51,
0x0034: 52,
0x0035: 53,
0x0036: 54,
0x0037: 55,
0x0038: 56,
0x0039: 57,
0x003A: 58,
0x003B: 59,
0x003C: 60,
0x003D: 61,
0x003E: 62,
0x003F: 63,

0x0040: 64,
0x0041: 65,
0x0042: 66,
0x0043: 67,
0x0044: 68,
0x0045: 69,
0x0046: 70,
0x0047: 71,
0x0048: 72,
0x0049: 73,
0x004A: 74,
0x004B: 75,
0x004C: 76,
0x004D: 77,
0x004E: 78,
0x004F: 79,

0x0050: 80,
0x0051: 81,
0x0052: 82,
0x0053: 83,
0x0054: 84,
0x0055: 85,
0x0056: 86,
0x0057: 87,
0x0058: 88,
0x0059: 89,
0x005A: 90,
0x005B: 91,
0x005C: 92,
0x005D: 93,
0x005E: 94,
0x005F: 95,

0x0060: 96,
0x0061: 97,
0x0062: 98,
0x0063: 99,
0x0064: 100,
0x0065: 101,
0x0066: 102,
0x0067: 103,
0x0068: 104,
0x0069: 105,
0x006A: 106,
0x006B: 107,
0x006C: 108,
0x006D: 109,
0x006E: 110,
0x006F: 111,

0x0070: 112,
0x0071: 113,
0x0072: 114,
0x0073: 115,
0x0074: 116,
0x0075: 117,
0x0076: 118,
0x0077: 119,
0x0078: 120,
0x0079: 121,
0x007A: 122,
0x007B: 123,
0x007C: 124,
0x007D: 125,
0x007E: 126,
0x2302: 127,

0x00C7: 128,
0x00FC: 129,
0x00E9: 130,
0x00E2: 131,
0x00E4: 132,
0x00E0: 133,
0x00E5: 134,
0x00E7: 135,
0x00EA: 136,
0x00EB: 137,
0x00E8: 138,
0x00EF: 139,
0x00EE: 140,
0x00EC: 141,
0x00C4: 142,
0x00C5: 143,

0x00C9: 144,
0x00E6: 145,
0x00C6: 146,
0x00F4: 147,
0x00F6: 148,
0x00F2: 149,
0x00FB: 150,
0x00F9: 151,
0x00FF: 152,
0x00D6: 153,
0x00DC: 154,
0x00A2: 155,
0x00A3: 156,
0x00A5: 157,
0x20A7: 158,
0x0192: 159,

0x00E1: 160,
0x00ED: 161,
0x00F3: 162,
0x00FA: 163,
0x00F1: 164,
0x00D1: 165,
0x00AA: 166,
0x00BA: 167,
0x00BF: 168,
0x2310: 169,
0x00AC: 170,
0x00BD: 171,
0x00BC: 172,
0x00A1: 173,
0x00AB: 174,
0x00BB: 175,

0x2591: 176,
0x2592: 177,
0x2593: 178,
0x2502: 179,
0x2524: 180,
0x2561: 181,
0x2562: 182,
0x2556: 183,
0x2555: 184,
0x2563: 185,
0x2551: 186,
0x2557: 187,
0x255D: 188,
0x255C: 189,
0x255B: 190,
0x2510: 191,

0x2514: 192,
0x2534: 193,
0x252C: 194,
0x251C: 195,
0x2500: 196,
0x253C: 197,
0x255E: 198,
0x255F: 199,
0x255A: 200,
0x2554: 201,
0x2569: 202,
0x2566: 203,
0x2560: 204,
0x2550: 205,
0x256C: 206,
0x2567: 207,

0x2568: 208,
0x2564: 209,
0x2565: 210,
0x2559: 211,
0x2558: 212,
0x2552: 213,
0x2553: 214,
0x256B: 215,
0x256A: 216,
0x2518: 217,
0x250C: 218,
0x2588: 219,
0x2584: 220,
0x258C: 221,
0x2590: 222,
0x2580: 223,

0x03B1: 224,
0x00DF: 225,
0x0393: 226,
0x03C0: 227,
0x03A3: 228,
0x03C3: 229,
0x00B5: 230,
0x03C4: 231,
0x03A6: 232,
0x0398: 233,
0x03A9: 234,
0x03B4: 235,
0x221E: 236,
0x03C6: 237,
0x03B5: 238,
0x2229: 239,

0x2261: 240,
0x00B1: 241,
0x2265: 242,
0x2264: 243,
0x2320: 244,
0x2321: 245,
0x00F7: 246,
0x2248: 247,
0x00B0: 248,
0x2219: 249,
0x00B7: 250,
0x221A: 251,
0x207F: 252,
0x00B2: 253,
0x25A0: 254,
0x00A0: 255,
}

export type Page = Glyph[];

export interface Glyph {
    position: Vector2;
    sprite: Sprite;
    color: number;
    offset: Vector2;
    hidden: boolean;
    styles: Map<string, unknown>;
}

export function computeLineWidth(font: Font, line: string): number {
    let width = 0;
    for (const char of line) {
        const code = char.codePointAt(0)!;
        const fontchar = font.characters.get(code);
        if (fontchar) {
            width += fontchar.spacing;
        }
    }
    return width;
}

export function makeGlyph(
    position: Vector2,
    sprite: Sprite,
    color = 0xffffff,
    offset = makeVector2(0, 0),
    hidden = true,
    styles = new Map<string, unknown>(),
): Glyph {
    return { position, sprite, color, offset, hidden, styles };
}

// TODO: the only reason this is a class rn is it needs those two canvases for
// blending properly...
export class PageRenderer {
    public readonly pageImage: CanvasImageSource;
    private readonly pageContext: CanvasRenderingContext2D;
    private readonly bufferContext: CanvasRenderingContext2D;

    constructor(private readonly width: number, private readonly height: number) {
        this.pageContext = createContext2D(width, height);
        this.bufferContext = createContext2D(width, height);
        this.pageImage = this.pageContext.canvas;
    }

    /**
     * Render a page of glyphs to the pageImage, offset by (px, py).
     * @param page glyphs to be rendered.
     * @param px horizontal offset in pixels.
     * @param py verticle offest in pixels.
     */
    public renderPage(page: Page, px: number, py: number): void {
        this.pageContext.clearRect(0, 0, this.width, this.height);
        this.bufferContext.clearRect(0, 0, this.width, this.height);

        for (const glyph of page) {
            if (glyph.hidden) continue;

            // padding + position + offset
            const dx = px + glyph.position.x + glyph.offset.x;
            const dy = py + glyph.position.y + glyph.offset.y;

            // draw tint layer
            this.pageContext.fillStyle = num2hex(glyph.color);
            this.pageContext.fillRect(dx, dy, glyph.sprite.rect.w, glyph.sprite.rect.h);

            // draw text layer
            drawSprite(this.bufferContext, glyph.sprite, dx, dy);
        }

        // draw text layer in tint color
        this.pageContext.globalCompositeOperation = 'destination-in';
        this.pageContext.drawImage(this.bufferContext.canvas, 0, 0);
        this.pageContext.globalCompositeOperation = 'source-over';
    }
}

export function scriptToPages(script: string, context: LayoutContext, styleHandler = defaultStyleHandler) {
    const tokens = tokeniseScript(script);
    const commands = tokensToCommands(tokens);
    return commandsToPages(commands, context, styleHandler);
}

export type Token = [TokenType, ...string[]];
export type TokenType = 'text' | 'markup';

export type Command = GlyphCommand | BreakCommand | StyleCommand | IconCommand;
export type CommandType = 'glyph' | 'break' | 'style' | 'icon';

export type GlyphCommand = { type: 'glyph'; char: string; breakable: boolean };
export type BreakCommand = { type: 'break'; target: BreakTarget };
export type StyleCommand = { type: 'style'; style: string };
export type IconCommand = { type: 'icon'; icon: HTMLCanvasElement };
export type BreakTarget = 'line' | 'page';

export type LayoutContext = { font: Font; lineWidth: number; lineCount: number };
export type StyleHandler = (styles: Map<string, unknown>, style: string) => void;

export type ArrayPredicate<T> = (element: T, index: number) => boolean;

function find<T>(array: T[], start: number, step: number, predicate: ArrayPredicate<T>): [T, number] | undefined {
    for (let i = start; 0 <= i && i < array.length; i += step) {
        if (predicate(array[i], i)) {
            return [array[i], i];
        }
    }
}

/**
 * Segment the given array into contiguous runs of elements that are not
 * considered breakable.
 */
export function filterToSpans<T>(array: T[], breakable: ArrayPredicate<T>): T[][] {
    const spans: T[][] = [];
    let buffer: T[] = [];

    array.forEach((element, index) => {
        if (!breakable(element, index)) {
            buffer.push(element);
        } else if (buffer.length > 0) {
            spans.push(buffer);
            buffer = [];
        }
    });

    if (buffer.length > 0) {
        spans.push(buffer);
    }

    return spans;
}

export const defaultStyleHandler: StyleHandler = (styles, style) => {
    if (style.substr(0, 1) === '+') {
        styles.set(style.substring(1), true);
    } else if (style.substr(0, 1) === '-') {
        styles.delete(style.substring(1));
    } else if (style.includes('=')) {
        const [key, val] = style.split(/\s*=\s*/);
        styles.set(key, val);
    }
};

export function commandsToPages(
    commands: Command[],
    layout: LayoutContext,
    styleHandler: StyleHandler = defaultStyleHandler,
): Page[] {
    commandsBreakLongSpans(commands, layout);

    const styles = new Map<string, unknown>();
    const pages: Page[] = [];
    let page: Page = [];
    let currLine = 0;

    function newPage() {
        pages.push(page);
        page = [];
        currLine = 0;
    }

    function endPage() {
        do {
            endLine();
        } while (currLine % layout.lineCount !== 0);
    }

    function endLine() {
        currLine += 1;
        if (currLine === layout.lineCount) newPage();
    }

    function doBreak(target: BreakTarget) {
        if (target === 'line') endLine();
        else if (target === 'page') endPage();
    }

    function findNextBreakIndex(): number | undefined {
        let width = 0;

        const isBreakableGlyph = (command: Command) => command.type === 'glyph' && command.breakable;

        for (let i = 0; i < commands.length; ++i) {
            const command = commands[i];
            if (command.type === 'break') return i;
            if (command.type === 'style') continue;

            const size = command.type === 'icon'
                       ? command.icon.width
                       : computeLineWidth(layout.font, command.char);

            width += size;
            // if we overshot, look backward for last possible breakable glyph
            if (width > layout.lineWidth) {
                const result = find(commands, i, -1, isBreakableGlyph);

                if (result) return result[1];
            }
        }
    }

    function addGlyph(command: GlyphCommand, offset: number): number {
        let codepoint = command.char.codePointAt(0)!;
        if (REMAPPING[codepoint] !== undefined) codepoint = REMAPPING[codepoint];

        const char = layout.font.characters.get(codepoint) || layout.font.characters.get(FALLBACK_CODEPOINT)!;
        const pos = makeVector2(offset, currLine * (layout.font.lineHeight + 4));
        const glyph = makeGlyph(pos, char.sprite);

        glyph.styles = new Map(styles.entries());

        page.push(glyph);
        return char.spacing;
    }

    function addIcon(command: IconCommand, offset: number): number {
        const pos = makeVector2(offset+1, currLine * (layout.font.lineHeight + 4));
        const glyph = makeGlyph(pos, makeSprite(command.icon, makeRect(0, 0, 8, 8)));
        glyph.styles = new Map(styles.entries());

        page.push(glyph);
        return command.icon.width+1;
    }

    // tslint:disable-next-line:no-shadowed-variable
    function generateGlyphLine(commands: Command[]) {
        let offset = 0;
        for (const command of commands) {
            if (command.type === 'glyph') {
                offset += addGlyph(command, offset);
            } else if (command.type === 'icon') {
                offset += addIcon(command, offset);
            } else if (command.type === 'style') {
                styleHandler(styles, command.style);
            }
        }
    }

    let index: number | undefined;

    // tslint:disable-next-line:no-conditional-assignment
    while ((index = findNextBreakIndex()) !== undefined) {
        generateGlyphLine(commands.slice(0, index));
        commands = commands.slice(index);

        const command = commands[0];
        if (command.type === 'break') {
            doBreak(command.target);
            commands.shift();
        } else {
            if (command.type === 'glyph' && command.char === ' ') {
                commands.shift();
            }
            endLine();
        }
    }

    generateGlyphLine(commands);
    endPage();

    return pages;
}

/**
 * Find spans of unbreakable commands that are too long to fit within a page
 * width and amend those spans so that breaking permitted in all positions.
 */
export function commandsBreakLongSpans(commands: Command[], context: LayoutContext): void {
    const canBreak = (command: Command) => command.type === 'break' || (command.type === 'glyph' && command.breakable);

    const spans = filterToSpans(commands, canBreak);

    for (const span of spans) {
        const glyphs = span.filter((command) => command.type === 'glyph') as GlyphCommand[];
        const charWidths = glyphs.map((command) => computeLineWidth(context.font, command.char));
        const spanWidth = charWidths.reduce((x, y) => x + y, 0);

        if (spanWidth > context.lineWidth) {
            for (const command of glyphs) command.breakable = true;
        }
    }
}

export const icons = new Map<string, HTMLCanvasElement>();

export function tokensToCommands(tokens: Token[]): Command[] {
    const commands: Command[] = [];

    function handleToken([type, buffer]: Token) {
        if (type === 'text') handleText(buffer);
        else if (type === 'markup') handleMarkup(buffer);
    }

    function handleText(buffer: string) {
        for (const char of buffer) {
            const breakable = char === ' ';
            commands.push({ type: 'glyph', char, breakable });
        }
    }

    function handleMarkup(buffer: string) {
        if (buffer === 'ep') commands.push({ type: 'break', target: 'page' });
        else if (buffer === 'el') commands.push({ type: 'break', target: 'line' });
        else if (buffer.startsWith('icon:')) {
            const id = buffer.split(':')[1];
            const icon = icons.get(id) || createContext2D(32, 4).canvas;
            commands.push({ type: 'icon', icon });
        } else commands.push({ type: 'style', style: buffer });
    }

    tokens.forEach(handleToken);

    return commands;
}

export function tokeniseScript(script: string): Token[] {
    const tokens: Token[] = [];
    let buffer = '';
    let braceDepth = 0;

    function openBrace() {
        if (braceDepth === 0) flushBuffer();
        braceDepth += 1;
    }

    function closeBrace() {
        if (braceDepth === 1) flushBuffer();
        braceDepth -= 1;
    }

    function newLine() {
        flushBuffer();
        tokens.push(['markup', 'el']);
    }

    function flushBuffer() {
        if (buffer.length === 0) return;
        const type = braceDepth > 0 ? 'markup' : 'text';
        tokens.push([type, buffer]);
        buffer = '';
    }

    const actions: { [char: string]: () => void } = {
        '{': openBrace,
        '}': closeBrace,
        '\n': newLine,
    };

    for (const char of script) {
        if (char in actions) actions[char]();
        else buffer += char;
    }

    flushBuffer();

    return tokens;
}

export function getPageHeight(page: Page, font: Font) {
    if (page.length === 0) return 0;

    let ymin = page[0].position.y;
    let ymax = ymin;

    page.forEach((char) => {
        ymin = Math.min(ymin, char.position.y);
        ymax = Math.max(ymax, char.position.y);
    });

    ymax += font.lineHeight + 4;

    return ymax - ymin;
}
