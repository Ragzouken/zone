import { Vector2, Sprite, Font, makeVector2, createContext2D, drawSprite } from 'blitsy';
import { num2hex } from './utility';

const FALLBACK_CODEPOINT = '?'.codePointAt(0)!;

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

export type Command = GlyphCommand | BreakCommand | StyleCommand;
export type CommandType = 'glyph' | 'break' | 'style';

export type GlyphCommand = { type: 'glyph'; char: string; breakable: boolean };
export type BreakCommand = { type: 'break'; target: BreakTarget };
export type StyleCommand = { type: 'style'; style: string };
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

            width += computeLineWidth(layout.font, command.char);
            // if we overshot, look backward for last possible breakable glyph
            if (width > layout.lineWidth) {
                const result = find(commands, i, -1, isBreakableGlyph);

                if (result) return result[1];
            }
        }
    }

    function addGlyph(command: GlyphCommand, offset: number): number {
        const codepoint = command.char.codePointAt(0)!;
        const char = layout.font.characters.get(codepoint) || layout.font.characters.get(FALLBACK_CODEPOINT)!;
        const pos = makeVector2(offset, currLine * (layout.font.lineHeight + 4));
        const glyph = makeGlyph(pos, char.sprite);

        glyph.styles = new Map(styles.entries());

        page.push(glyph);
        return char.spacing;
    }

    // tslint:disable-next-line:no-shadowed-variable
    function generateGlyphLine(commands: Command[]) {
        let offset = 0;
        for (const command of commands) {
            if (command.type === 'glyph') {
                offset += addGlyph(command, offset);
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
        else commands.push({ type: 'style', style: buffer });
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
