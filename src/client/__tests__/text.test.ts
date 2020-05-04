import {
    tokeniseScript,
    Token,
    tokensToCommands,
    GlyphCommand,
    commandsToPages,
    commandsBreakLongSpans,
    filterToSpans,
} from '../text';
import { makeVector2, MAGENTA_SPRITE_4X4, Font, FontCharacter } from 'blitsy';

const font = makeTestFont();
const tinyPage = { font, lineWidth: 12, lineCount: 2 };
const smallPage = { font, lineWidth: 40, lineCount: 2 };
const normalPage = { font, lineWidth: 192, lineCount: 2 };

const filterToSpansTests: [string, RegExp, string[]][] = [
    ['test span split', / /, ['test', 'span', 'split']],
    ['test span   split', / /, ['test', 'span', 'split']],
    ['test123span444split', /\d/, ['test', 'span', 'split']],
];

test.each(filterToSpansTests)('filterToSpans', (input: string, pattern: RegExp, expectedSpans: string[]) => {
    const predicate = (char: string) => pattern.test(char);
    const spans = filterToSpans(input.split(''), predicate).map((span) => span.join(''));
    expect(spans).toEqual(expectedSpans);
});

type TokeniseTestCase = [string, Token[]];

const tokeniseTests: TokeniseTestCase[] = [
    ['hello', [['text', 'hello']]],
    [
        'hello{el}joe',
        [
            ['text', 'hello'],
            ['markup', 'el'],
            ['text', 'joe'],
        ],
    ],
    [
        '{el}hello{ep}robert',
        [
            ['markup', 'el'],
            ['text', 'hello'],
            ['markup', 'ep'],
            ['text', 'robert'],
        ],
    ],
    [
        'hello{ep}my name is mark{el}',
        [
            ['text', 'hello'],
            ['markup', 'ep'],
            ['text', 'my name is mark'],
            ['markup', 'el'],
        ],
    ],
    [
        'hello{test}joe',
        [
            ['text', 'hello'],
            ['markup', 'test'],
            ['text', 'joe'],
        ],
    ],
];

test.each(tokeniseTests)('tokenise as expected', (script, expectedTokens) => {
    expect(tokeniseScript(script)).toEqual(expectedTokens);
});

describe('commands from tokens', () => {
    const tokens = tokeniseScript("hello what's new");
    const commands = tokensToCommands(tokens);

    const glyphs = commands.filter(({ type }) => type === 'glyph') as GlyphCommand[];

    test('only spaces breakable', () => {
        glyphs.forEach(({ char, breakable }) => {
            expect((char !== ' ') === !breakable).toBeTruthy();
        });
    });
});

function scriptToIntermediates(script: string) {
    const tokens = tokeniseScript(script);
    const commands = tokensToCommands(tokens);
    const glyphs = commands.filter(({ type }) => type === 'glyph') as GlyphCommand[];
    return { tokens, commands, glyphs };
}

describe('commands to layout', () => {
    const breaks: [string, number][] = [
        ["damn that's a long line", 4],
        ['woahlongword', 12],
        ['hello woahlongword', 13],
        ['woahlo{el}ngword', 0],
    ];

    test.each(breaks)('breaking spans', (line, expectedBreakables) => {
        const intermediates = scriptToIntermediates(line);
        commandsBreakLongSpans(intermediates.commands, smallPage);
        const actualBreakables = intermediates.glyphs.filter(({ breakable }) => breakable).length;
        expect(actualBreakables).toBe(expectedBreakables);
    });
});

describe('layout glyphs', () => {
    {
        const tokens = tokeniseScript('hel{el}lo');
        const [page] = commandsToPages(tokensToCommands(tokens), normalPage);

        test('first glyph 0,0', () => expect(page[0].position).toEqual(makeVector2(0, 0)));
        test('next line height', () => expect(page[3].position).toEqual(makeVector2(0, font.lineHeight + 4)));
    }

    test('wordwrap on spaces', () => {
        const tokens = tokeniseScript('h lo');
        const [page] = commandsToPages(tokensToCommands(tokens), tinyPage);

        expect(page[1].position).toEqual(makeVector2(0, font.lineHeight + 4));
    });

    test('preserve unwrapped spaces', () => {
        const tokens = tokeniseScript('h   o');
        const [page] = commandsToPages(tokensToCommands(tokens), normalPage);

        expect(page.length).toEqual(5);
    });

    test('strip markup', () => {
        const tokens = tokeniseScript('h{el}e{bla}la{el}');
        const [page] = commandsToPages(tokensToCommands(tokens), normalPage);

        expect(page.length).toEqual(4);
    });

    test('markup break up words', () => {
        const tokens = tokeniseScript('hello he{bla}llo');
        const commands = tokensToCommands(tokens);
        const [page] = commandsToPages(commands, smallPage);

        expect(page[5].position).toEqual(makeVector2(0, font.lineHeight + 4));
    });
});

function makeTestFont(): Font {
    const font: Font = {
        name: 'test font',
        lineHeight: 4,
        characters: new Map<number, FontCharacter>(),
    };

    for (let i = 0; i < 256; ++i) {
        font.characters.set(i, {
            codepoint: i,
            sprite: MAGENTA_SPRITE_4X4,
            offset: makeVector2(0, 0),
            spacing: 4,
        });
    }
    return font;
}
