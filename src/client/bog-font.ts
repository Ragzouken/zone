import { Font, FontCharacter, FontData, FontDataUniform } from 'blitsy';

import { makeRect, makeSprite, makeVector2 } from 'blitsy/lib/sprite';

export function decodeFontHack(fontData: FontDataUniform): Font {
    const characters = new Map<number, FontCharacter>();

    const img = document.createElement("img");
    img.src = fontData.atlas.data;

    const width = fontData.charWidth;
    const height = fontData.charHeight;
    const offset = makeVector2(0, 0);
    const spacing = fontData.charWidth;

    const cols = fontData.atlas.width / width;

    fontData.index.forEach((codepoint: number, i: number) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const rect = makeRect(col * width, row * height, width, height);
        const sprite = makeSprite(img, rect);
        characters.set(codepoint, { codepoint, sprite, offset, spacing });
    });

    return { name: fontData.name, lineHeight: height, characters };
}

export default {"_type":"font","format":"U","name":"ascii_small","charWidth":6,"charHeight":8,"index":[32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,161,162,163,165,167,170,171,172,182,183,186,187,191,198,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,248,249,250,251,252,253,254,255,257,275,297,299,333,338,339,361,363,373,375,7809,7811,7813,7838,7869,7923,7929,8216,8217,8218,8220,8221,8222,8230,8249,8250,8254,8364,8592,8593,8594,8595,8943,12290,12296,12297,12298,12299,12300,12301,12302,12303,12304,12305,12316,12448,12450,12452,12454,12456,12458,12459,12461,12463,12465,12467,12469,12471,12473,12475,12477,12479,12481,12484,12486,12488,12490,12491,12492,12493,12494,12495,12498,12501,12504,12507,12510,12511,12512,12513,12514,12516,12518,12520,12521,12522,12523,12524,12525,12527,12528,12529,12530,12531,12540,42891,42892,129970,129971,129985,129986,129987,129989,129990,129991,129992],"atlas":{"_type":"texture","format":"M1","width":6,"height":1992,"data":"data:image/png;base64,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"}} as FontData;