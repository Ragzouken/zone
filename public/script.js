(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.zone = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function base64ToUint8(base64) {
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8ClampedArray(new ArrayBuffer(rawLength));
    for (var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}
exports.base64ToUint8 = base64ToUint8;
function uint8ToBase64(u8Arr) {
    var CHUNK_SIZE = 0x8000; // arbitrary number
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    while (index < length) {
        var slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}
exports.uint8ToBase64 = uint8ToBase64;

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAGENTA_CANVAS_4X4 = createCanvas(4, 4);
var context = exports.MAGENTA_CANVAS_4X4.getContext('2d');
context.fillStyle = '#FF00FF';
context.fillRect(0, 0, 4, 4);
/**
 * Create a new html canvas.
 * @param width canvas width in pixels.
 * @param height canvas height in pixels.
 */
function createCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
exports.createCanvas = createCanvas;
/**
 * Create a new canvas and get a 2d rendering context from it.
 * @param width canvas width in pixels.
 * @param height canvas height in pixels.
 */
function createContext2D(width, height) {
    var canvas = createCanvas(width, height);
    return canvas.getContext('2d');
}
exports.createContext2D = createContext2D;

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function colorToHex(color) {
    color = (color | 0xff000000) >>> 0;
    var abgrHex = color.toString(16);
    return abgrHex.substr(6, 2) + abgrHex.substr(4, 2) + abgrHex.substr(2, 2);
}
exports.colorToHex = colorToHex;
function colorToRgba(color) {
    return { r: (color >> 0) & 0xff, g: (color >> 8) & 0xff, b: (color >> 16) & 0xff, a: (color >> 24) & 0xff };
}
exports.colorToRgba = colorToRgba;
function rgbaToColor(rgba) {
    var r = rgba.r, g = rgba.g, b = rgba.b, a = rgba.a;
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
exports.rgbaToColor = rgbaToColor;
function rgbToHex(rgba) {
    return colorToHex(rgbaToColor(rgba));
}
exports.rgbToHex = rgbToHex;
function hexToRgb(hex) {
    var bgrHex = hex.substr(4, 2) + hex.substr(2, 2) + hex.substr(0, 2);
    return colorToRgba(parseInt(bgrHex, 16) | 0xff000000);
}
exports.hexToRgb = hexToRgb;
function hexToColor(hex) {
    return rgbaToColor(hexToRgb(hex));
}
exports.hexToColor = hexToColor;

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sprite_1 = require("./sprite");
var texture_1 = require("./texture");
exports.EMPTY_FONT = {
    name: 'empty',
    lineHeight: 0,
    characters: new Map(),
};
function decodeFontUniform(fontData) {
    var characters = new Map();
    var atlas = texture_1.decodeTexture(fontData.atlas);
    var width = fontData.charWidth;
    var height = fontData.charHeight;
    var offset = sprite_1.makeVector2(0, 0);
    var spacing = fontData.charWidth;
    var cols = fontData.atlas.width / width;
    fontData.index.forEach(function (codepoint, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var rect = sprite_1.makeRect(col * width, row * height, width, height);
        var sprite = sprite_1.makeSprite(atlas.canvas, rect);
        characters.set(codepoint, { codepoint: codepoint, sprite: sprite, offset: offset, spacing: spacing });
    });
    return { name: fontData.name, lineHeight: height, characters: characters };
}
exports.decodeFontUniform = decodeFontUniform;
function decodeFont(fontData) {
    return decodeFontUniform(fontData);
}
exports.decodeFont = decodeFont;

},{"./sprite":8,"./texture":9}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = { "_type": "font", "format": "U", "name": "ascii_small", "charWidth": 6, "charHeight": 8, "index": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255], "atlas": { "_type": "texture", "format": "M1", "width": 6, "height": 2048, "data": "AAAAAAAAnGiLqsgBnK/6os8BAOX7PocAAEBxHAIACMchvo8AAML5PsIBAAAwDAAA///P8///AOBJkgcA/x+2bfj/AA6zksQAnChyCIcACIYijGMAMEuztG0AgMrZnAoABMPxHEMAEMZ5HAYBCOcjPocAFEVRFEABvKqyKIoCnMhQmMgBAAAAgOcBCOcjPodwCOcjCIIACIIgPocAAIL5GAIAAML4DAIAAAAIguADAEX5FAUACMJxvg8Avs9xCAIAAAAAAAAACMchCIAAti0BAAAAAOVTlE8BBCcwkIMApgkhhCwDhKIQqsQCDEMAAAAACEEQBIEABIIgCEIAAMX5HAUAAIL4CAIAAAAAAMMQAAD4AAAAAAAAAMMAAAghhAAAnCirpsgBCIMgCMIBnAhihOADnAhyoMgBEEZJPgQBviB4oMgBGCF4osgBPgghBEEAnChyosgBnCjyIMQAAMAwAMMAAMAwAMMQEEIIBAIBAOADgA8ABAKBEEIAnAhiCIAAnKirusABnCiKvigCnih6ougBnCgIgsgBniiKougBviB4guADviB4giAAnCjoosgDoij6oigCHIIgCMIBIAiCosgBoqQYiiQCgiAIguADoq2KoigCoqnKoigCnCiKosgBnih6giAAnCiKqsQCnih6kigCnChwoMgBPoIgCIIAoiiKosgBoiiKIoUAoqiqqkoBokghlCgCoihSCIIAHoQQguABHEEQBMEBgEAgEAgAHARBEMQBCCUCAAAAAAAAAAD8DIMAAAAAAMCBvMgDguCJougBAMCJgsgBIMiLosgDAMCJnsABGEF4BEEAAMCLIg9yguBIkiQBCIAgCIIBEIBBECQxgiAphiIBCIIgCIIBAGCpqigCAOBIkiQBAMCJosgBAOCJougJAMCLosiDAKCRBOEAAMAJHMgBAOERBIUAACBJkkYBACCKIoUAACCKqk8BACBJjCQBACBJEocYAOBBjOABGEEYBIEBCIIgCIIgDATBEMQAlAIAAAAACGeLog8AnCgIIocwEiBJkkYBMMCJnsABHMCBvMgDFMCBvMgDDMCBvMgDHMWBvMgDACcKIocwHMCJnsABFMCJnsABDMCJnsABFIAgCIIBCAUgCIIBBIAgCIIBFIBQoi8CHMXZoi8CMOALnuADAOChvsIDvKL4iqIDHMBIksQAFMBIksQABsBIksQAHCBJkkYBBiBJkkYBFCBJEocYEiNJksQAFCBJksQAAMIJAocAGEl4BKkDIoX4iI8AhqJYuiQBEIpwCKIQGMCBvMgDGIAgCIIBGMBIksQAGCBJkkYBlAI4kiQBlAJIliYBHMiLPMADjCRJDOABCIAwgsgBAOALggAAAPCDIAAAgqRwIoQDgqTQKg4CCIAgHIcAAEBKJAAAACCREgAAKlABKlABaqVWaqVW1a/+1a/+CIIgCIIgCII8CIIgACBJkiMIiqIsiqIoAAA8iqIowIM8CIIgyoIsiqIoiqIoiqIowIMsiqIoyoI8AAAAiqI8AAAAyIM8AAAAAAA8CIIgCILgAAAACIL8AAAAAAD8CIIgCILgCIIgAAD8AAAACIL8CIIgCI7gCIIgiqLoiqIoii74AAAAgC/oiqIoyg78AAAAwA/siqIoii7oiqIowA/8AAAAyg7siqIoyA/8AAAAiqL8AAAAwA/8CIIgAAD8iqIoiqL4AAAAAAAAAAD8AAAAAPD/AAAAwP//AAAA////AAD8////APD/////wP//////////////QRAEQRAEwzAMwzAMx3Ecx3Ecz/M8z/M83/d93/d9gCM5kuQIniQIgiAAgE9RFEUBFMCBvMgDAMBLEgMAACBJkiMIAEApCIIAHMKJHMIBjCR5ksQAACeKFGUDjEAgnMQAAECpKgUAAMKpKocAACd4AgcAACNJkgQAgAd4gAcAAMIhAAcAAgMxAuABAPAfWRj8APDjZgj+CIIgiEIAFMCJosgB3/d93/d9z/M8z/M8x3Ecx3EcwzAMwzAMQRAEQRAEFCBJkkYBBkI4AAAAAAB40/zx0i9JvwQA" } };

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var canvas_1 = require("./canvas");
function imageToContext(image) {
    var context = canvas_1.createContext2D(image.width, image.height);
    context.drawImage(image, 0, 0);
    return context;
}
exports.imageToContext = imageToContext;

},{"./canvas":2}],7:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./canvas"));
__export(require("./sprite"));
__export(require("./image"));
__export(require("./texture"));
__export(require("./font"));
__export(require("./color"));
var ascii_small_font_1 = require("./fonts/ascii-small-font");
exports.fonts = {
    'ascii-small': ascii_small_font_1.default,
};

},{"./canvas":2,"./color":3,"./font":4,"./fonts/ascii-small-font":5,"./image":6,"./sprite":8,"./texture":9}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var canvas_1 = require("./canvas");
exports.MAGENTA_SPRITE_4X4 = imageToSprite(canvas_1.MAGENTA_CANVAS_4X4);
function makeVector2(x, y) {
    return { x: x, y: y };
}
exports.makeVector2 = makeVector2;
function makeRect(x, y, w, h) {
    return { x: x, y: y, w: w, h: h };
}
exports.makeRect = makeRect;
function makeSprite(image, rect) {
    return { image: image, rect: rect };
}
exports.makeSprite = makeSprite;
function imageToSprite(image) {
    return { image: image, rect: makeRect(0, 0, image.width, image.height) };
}
exports.imageToSprite = imageToSprite;
function spriteToCanvas(sprite) {
    var context = canvas_1.createContext2D(sprite.rect.w, sprite.rect.h);
    drawSprite(context, sprite, 0, 0);
    return context.canvas;
}
exports.spriteToCanvas = spriteToCanvas;
function drawSprite(context, sprite, x, y) {
    var _a = [sprite.rect.x, sprite.rect.y], sx = _a[0], sy = _a[1];
    var _b = [sprite.rect.w, sprite.rect.h], sw = _b[0], sh = _b[1];
    context.drawImage(sprite.image, sx, sy, sw, sh, x, y, sw, sh);
}
exports.drawSprite = drawSprite;

},{"./canvas":2}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var base64_1 = require("./base64");
var canvas_1 = require("./canvas");
exports.decodeRGBA8 = function (data, pixels) { return pixels.set(data); };
exports.encodeRGBA8 = function (pixels) { return pixels; };
exports.decodeR8 = function (data, pixels) {
    for (var i = 0; i < data.length; ++i) {
        pixels[i * 4] = data[i];
    }
};
exports.encodeR8 = function (pixels) {
    var data = new Uint8ClampedArray(pixels.length / 4);
    for (var i = 0; i < data.length; ++i) {
        data[i] = pixels[i * 4];
    }
    return data;
};
exports.decodeR4 = function (data, pixels) {
    for (var i = 0; i < data.length; ++i) {
        // tslint:disable-next-line:no-bitwise
        pixels[i * 8 + 0] = (data[i] >>> 4) * 16;
        // tslint:disable-next-line:no-bitwise
        pixels[i * 8 + 4] = (data[i] & 15) * 16;
    }
};
exports.encodeR4 = function (pixels) {
    var data = new Uint8ClampedArray(pixels.length / 8);
    for (var i = 0; i < data.length; ++i) {
        data[i] =
            // tslint:disable-next-line:no-bitwise
            ((pixels[i * 8 + 0] / 16) << 4) |
                // tslint:disable-next-line:no-bitwise
                ((pixels[i * 8 + 4] / 16) & 15);
    }
    return data;
};
var white = 0xffffffff;
var clear = 0x00000000;
exports.decodeM1 = function (data, pixels) {
    var pixels32 = new Uint32Array(pixels.buffer);
    for (var i = 0; i < data.length; ++i) {
        for (var bit = 0; bit < 8; ++bit) {
            if (i * 8 + bit < pixels32.length) {
                // tslint:disable-next-line:no-bitwise
                var on = (data[i] >> bit) & 1;
                pixels32[i * 8 + bit] = on ? white : clear;
            }
        }
    }
};
exports.encodeM1 = function (pixels) {
    var pixels32 = new Uint32Array(pixels.buffer);
    var data = new Uint8ClampedArray(Math.ceil(pixels32.length / 8));
    for (var i = 0; i < data.length; ++i) {
        var byte = 0;
        for (var bit = 0; bit < 8; ++bit) {
            // tslint:disable-next-line:no-bitwise
            byte <<= 1;
            // tslint:disable-next-line:no-bitwise
            byte |= pixels32[i * 8 + (7 - bit)] > 0 ? 1 : 0;
        }
        data[i] = byte;
    }
    return data;
};
exports.formats = {
    RGBA8: { decode: exports.decodeRGBA8, encode: exports.encodeRGBA8 },
    R8: { decode: exports.decodeR8, encode: exports.encodeR8 },
    R4: { decode: exports.decodeR4, encode: exports.encodeR4 },
    M1: { decode: exports.decodeM1, encode: exports.encodeM1 },
};
function encodeTexture(context, format) {
    var encoder = exports.formats[format].encode;
    var _a = [context.canvas.width, context.canvas.height], width = _a[0], height = _a[1];
    var pixels = context.getImageData(0, 0, width, height).data;
    var data = base64_1.uint8ToBase64(encoder(pixels));
    return { _type: 'texture', format: format, width: width, height: height, data: data };
}
exports.encodeTexture = encodeTexture;
function decodeTexture(texture) {
    var decoder = exports.formats[texture.format].decode;
    var context = canvas_1.createContext2D(texture.width, texture.height);
    context.clearRect(0, 0, texture.width, texture.height);
    var image = context.getImageData(0, 0, texture.width, texture.height);
    decoder(base64_1.base64ToUint8(texture.data), image.data);
    context.putImageData(image, 0, 0);
    return context;
}
exports.decodeTexture = decodeTexture;
function decodeAsciiTexture(ascii, solid) {
    if (solid === void 0) { solid = '1'; }
    ascii = ascii.trim();
    var rows = ascii.split('\n');
    ascii = ascii.replace(/\n/g, '');
    var _a = [rows[0].length, rows.length], width = _a[0], height = _a[1];
    var context = canvas_1.createContext2D(width, height);
    var image = context.createImageData(width, height);
    var colors = new Uint32Array(image.data.buffer);
    colors.set(Array.from(ascii).map(function (c) { return (c === solid ? white : clear); }));
    context.putImageData(image, 0, 0);
    return context;
}
exports.decodeAsciiTexture = decodeAsciiTexture;

},{"./base64":1,"./canvas":2}],10:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blitsy_1 = require("blitsy");
const text_1 = require("./text");
const utility_1 = require("./utility");
const font = blitsy_1.decodeFont(blitsy_1.fonts['ascii-small']);
const layout = { font, lineWidth: 240, lineCount: 9999 };
class ChatPanel {
    constructor() {
        this.context = blitsy_1.createContext2D(256, 256);
        this.chatPages = [];
        this.pageRenderer = new text_1.PageRenderer(256, 256);
    }
    log(text) {
        this.chatPages.push(text_1.scriptToPages(text, layout)[0]);
        this.chatPages = this.chatPages.slice(-32);
    }
    render() {
        this.context.clearRect(0, 0, 256, 256);
        let bottom = 256 - 4;
        for (let i = this.chatPages.length - 1; i >= 0 && bottom >= 0; --i) {
            const page = this.chatPages[i];
            const messageHeight = text_1.getPageHeight(page, font);
            const y = bottom - messageHeight;
            animatePage(page);
            this.pageRenderer.renderPage(page, 8, y);
            this.context.drawImage(this.pageRenderer.pageImage, 0, 0);
            bottom = y;
        }
    }
}
exports.ChatPanel = ChatPanel;
function animatePage(page) {
    page.forEach((glyph, i) => {
        glyph.hidden = false;
        if (glyph.styles.has('r'))
            glyph.hidden = false;
        if (glyph.styles.has('clr')) {
            const hex = glyph.styles.get('clr');
            const rgb = utility_1.hex2rgb(hex);
            glyph.color = utility_1.rgb2num(...rgb);
        }
        if (glyph.styles.has('shk'))
            glyph.offset = blitsy_1.makeVector2(utility_1.randomInt(-1, 1), utility_1.randomInt(-1, 1));
        if (glyph.styles.has('wvy'))
            glyph.offset.y = (Math.sin(i + (performance.now() * 5) / 1000) * 3) | 0;
        if (glyph.styles.has('rbw')) {
            const h = Math.abs(Math.sin(performance.now() / 600 - i / 8));
            const [r, g, b] = utility_1.hslToRgb(h, 1, 0.5);
            glyph.color = utility_1.rgb2num(r, g, b);
        }
    });
}
exports.animatePage = animatePage;

},{"./text":15,"./utility":16,"blitsy":7}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utility_1 = require("./utility");
const messaging_1 = require("./messaging");
class ZoneState {
    constructor() {
        this.users = new Map();
    }
    reset() {
        this.users.clear();
    }
    getUser(userId) {
        return utility_1.getDefault(this.users, userId, () => ({ userId, emotes: [] }));
    }
}
exports.ZoneState = ZoneState;
class ZoneClient {
    constructor() {
        this.zone = new ZoneState();
        this.messaging = new messaging_1.WebSocketMessaging();
    }
    get localUser() {
        return this.zone.getUser(this.localUserId);
    }
}
exports.ZoneClient = ZoneClient;

},{"./messaging":14,"./utility":16}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blitsy = require("blitsy");
const utility_1 = require("./utility");
const text_1 = require("./text");
const youtube_1 = require("./youtube");
const chat_1 = require("./chat");
const client_1 = require("./client");
exports.client = new client_1.ZoneClient();
let player;
async function start() {
    player = await youtube_1.loadYoutube('youtube', 448, 252);
    await load();
}
start();
const avatarImage = blitsy.decodeAsciiTexture(`
___XX___
___XX___
___XX___
__XXXX__
_XXXXXX_
X_XXXX_X
__X__X__
__X__X__
`, 'X');
const floorTile = blitsy.decodeAsciiTexture(`
________
_X_X_X_X
________
__X_____
________
X_X_X_X_
________
_____X__
`, 'X');
const brickTile = blitsy.decodeAsciiTexture(`
###_####
###_####
###_####
________
#######_
#######_
#######_
________
`, '#');
utility_1.recolor(floorTile);
utility_1.recolor(brickTile);
const roomBackground = blitsy.createContext2D(128, 128);
drawRoomBackground(roomBackground);
function drawRoomBackground(room) {
    room.fillStyle = 'rgb(0, 82, 204)';
    room.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 16; ++x) {
        for (let y = 0; y < 10; ++y) {
            room.drawImage(brickTile.canvas, x * 8, y * 8);
        }
        for (let y = 10; y < 16; ++y) {
            room.drawImage(floorTile.canvas, x * 8, y * 8);
        }
    }
    room.fillStyle = 'rgb(0, 0, 0)';
    room.globalAlpha = 0.75;
    room.fillRect(0, 0, 128, 128);
}
const avatarTiles = new Map();
avatarTiles.set(undefined, avatarImage);
function decodeBase64(data) {
    const texture = {
        _type: 'texture',
        format: 'M1',
        width: 8,
        height: 8,
        data,
    };
    return blitsy.decodeTexture(texture);
}
function getTile(base64) {
    if (!base64)
        return;
    let tile = avatarTiles.get(base64);
    if (!tile) {
        try {
            tile = decodeBase64(base64);
            avatarTiles.set(base64, tile);
        }
        catch (e) {
            console.log('fucked up avatar', base64);
        }
    }
    return tile;
}
const recolorBuffer = blitsy.createContext2D(8, 8);
function recolored(tile, color) {
    recolorBuffer.clearRect(0, 0, 8, 8);
    recolorBuffer.fillStyle = utility_1.num2hex(color);
    recolorBuffer.fillRect(0, 0, 8, 8);
    recolorBuffer.globalCompositeOperation = 'destination-in';
    recolorBuffer.drawImage(tile.canvas, 0, 0);
    recolorBuffer.globalCompositeOperation = 'source-over';
    return recolorBuffer;
}
function notify(title, body, tag) {
    if ('Notification' in window && Notification.permission === 'granted' && !document.hasFocus()) {
        const notification = new Notification(title, { body, tag, renotify: true, icon: './avatar.png' });
    }
}
const font = blitsy.decodeFont(blitsy.fonts['ascii-small']);
const layout = { font, lineWidth: 240, lineCount: 9999 };
function parseFakedown(text) {
    text = utility_1.fakedownToTag(text, '##', 'shk');
    text = utility_1.fakedownToTag(text, '~~', 'wvy');
    text = utility_1.fakedownToTag(text, '==', 'rbw');
    return text;
}
const chat = new chat_1.ChatPanel();
function setVolume(volume) {
    player.volume = volume;
    localStorage.setItem('volume', volume.toString());
}
let localName = localStorage.getItem('name') || '';
function rename(name) {
    localStorage.setItem('name', name);
    localName = name;
    exports.client.messaging.send('name', { name });
}
async function load() {
    setVolume(parseInt(localStorage.getItem('volume') || '100', 10));
    const youtube = document.querySelector('#youtube');
    const archive = document.querySelector('#archive');
    const httpvideo = document.querySelector('#http-video');
    const joinName = document.querySelector('#join-name');
    const chatInput = document.querySelector('#chat-input');
    joinName.value = localName;
    let queue = [];
    let currentPlayMessage;
    let currentPlayStart;
    function getUsername(userId) {
        return exports.client.zone.getUser(userId).name || userId;
    }
    let showQueue = false;
    let remember;
    exports.client.messaging.on('open', async () => {
        queue.length = 0;
        exports.client.zone.reset();
        exports.client.messaging.send('join', { name: localName, token: exports.client.localToken, password: exports.client.joinPassword });
    });
    exports.client.messaging.on('close', async (code) => {
        remember = exports.client.localUser;
        if (code <= 1001)
            return;
        await utility_1.sleep(100);
        exports.client.messaging.reconnect();
    });
    exports.client.messaging.setHandler('reject', () => {
        chat.log('{clr=#FF00FF}! enter server password with /password)');
    });
    exports.client.messaging.setHandler('heartbeat', () => { });
    exports.client.messaging.setHandler('assign', (message) => {
        if (remember) {
            if (remember.position)
                exports.client.messaging.send('move', { position: remember.position });
            if (remember.avatar) {
                exports.client.messaging.send('avatar', { data: remember.avatar });
                exports.client.messaging.send('emotes', { emotes: remember.emotes });
            }
        }
        exports.client.localUserId = message.userId;
        exports.client.localToken = message.token;
    });
    exports.client.messaging.setHandler('queue', (message) => {
        if (message.items.length === 1) {
            const item = message.items[0];
            const { title, duration } = item.media.details;
            const username = getUsername(item.info.userId);
            const time = utility_1.secondsToTime(duration / 1000);
            chat.log(`{clr=#00FFFF}+ ${title} (${time}) added by {clr=#FF0000}${username}`);
        }
        queue.push(...message.items);
    });
    exports.client.messaging.setHandler('play', (message) => {
        if (!message.item) {
            archive.src = '';
            player === null || player === void 0 ? void 0 : player.stop();
            httpvideo.pause();
            httpvideo.src = '';
            currentPlayMessage = undefined;
            return;
        }
        const { source, details } = message.item.media;
        chat.log(`{clr=#00FFFF}> ${details.title} (${utility_1.secondsToTime(details.duration / 1000)})`);
        queue = queue.filter((item) => !utility_1.objEqual(item.media.source, source));
        const time = message.time || 0;
        const seconds = time / 1000;
        if (source.type === 'youtube') {
            player.playVideoById(source.videoId, seconds);
        }
        else if (source.type === 'archive') {
            const corsProxy = 'https://zone-cors.glitch.me';
            const src = source.src.replace('embed', 'download');
            httpvideo.src = `${corsProxy}/${src}`;
            httpvideo.currentTime = seconds;
            httpvideo.play();
            // archive.src = ((source as any).src).replace('download', 'embed') + `?autoplay=1&start=${seconds}`;
        }
        else {
            chat.log(`{clr=#FF00FF}! unsupported media type`);
            exports.client.messaging.send('error', { source });
        }
        currentPlayMessage = message;
        currentPlayStart = performance.now() - time;
    });
    exports.client.messaging.setHandler('users', (message) => {
        chat.log('{clr=#00FF00}*** connected ***');
        if (!remember)
            listHelp();
        exports.client.zone.users.clear();
        message.users.forEach((user) => {
            exports.client.zone.users.set(user.userId, user);
        });
        listUsers();
    });
    exports.client.messaging.setHandler('leave', (message) => {
        const username = getUsername(message.userId);
        chat.log(`{clr=#FF00FF}! {clr=#FF0000}${username}{clr=#FF00FF} left`);
        exports.client.zone.users.delete(message.userId);
    });
    exports.client.messaging.setHandler('move', (message) => {
        const user = exports.client.zone.getUser(message.userId);
        if (user !== exports.client.localUser || !user.position)
            user.position = message.position;
    });
    exports.client.messaging.setHandler('avatar', (message) => {
        exports.client.zone.getUser(message.userId).avatar = message.data;
        if (message.userId === exports.client.localUserId)
            localStorage.setItem('avatar', message.data);
        if (!avatarTiles.has(message.data)) {
            try {
                avatarTiles.set(message.data, decodeBase64(message.data));
            }
            catch (e) {
                console.log('fucked up avatar', getUsername(message.userId));
            }
        }
    });
    exports.client.messaging.setHandler('emotes', (message) => {
        exports.client.zone.getUser(message.userId).emotes = message.emotes;
    });
    exports.client.messaging.setHandler('chat', (message) => {
        const name = getUsername(message.userId);
        chat.log(`{clr=#FF0000}${name}:{-clr} ${message.text}`);
        if (message.userId !== exports.client.localUserId) {
            notify(name, message.text, 'chat');
        }
    });
    exports.client.messaging.setHandler('status', (message) => chat.log(`{clr=#FF00FF}! ${message.text}`));
    exports.client.messaging.setHandler('name', (message) => {
        const next = message.name;
        if (message.userId === exports.client.localUserId) {
            chat.log(`{clr=#FF00FF}! you are {clr=#FF0000}${next}`);
        }
        else if (!exports.client.zone.users.has(message.userId)) {
            chat.log(`{clr=#FF00FF}! {clr=#FF0000}${next} {clr=#FF00FF}joined`);
        }
        else {
            const prev = getUsername(message.userId);
            chat.log(`{clr=#FF00FF}! {clr=#FF0000}${prev}{clr=#FF00FF} is now {clr=#FF0000}${next}`);
        }
        exports.client.zone.getUser(message.userId).name = message.name;
    });
    let lastSearchResults = [];
    exports.client.messaging.setHandler('search', (message) => {
        const { results } = message;
        lastSearchResults = results;
        const lines = results
            .slice(0, 5)
            .map((media) => media.details)
            .map(({ title, duration }, i) => `${i + 1}. ${title} (${utility_1.secondsToTime(duration / 1000)})`);
        chat.log('{clr=#FFFF00}? queue Search result with /result n\n{clr=#00FFFF}' + lines.join('\n'));
    });
    setInterval(() => exports.client.messaging.send('heartbeat', {}), 30 * 1000);
    window.onbeforeunload = () => exports.client.messaging.disconnect();
    player.on('error', () => exports.client.messaging.send('error', { source: { type: 'youtube', videoId: player.video } }));
    function move(dx, dy) {
        const user = exports.client.localUser;
        if (user.position) {
            user.position[0] = utility_1.clamp(0, 15, user.position[0] + dx);
            user.position[1] = utility_1.clamp(0, 15, user.position[1] + dy);
        }
        else {
            user.position = [utility_1.randomInt(0, 15), 15];
        }
        exports.client.messaging.send('move', { position: user.position });
        if (!user.avatar) {
            // send saved avatar
            const data = localStorage.getItem('avatar');
            if (data)
                exports.client.messaging.send('avatar', { data });
        }
    }
    function listUsers() {
        const named = Array.from(exports.client.zone.users.values()).filter((user) => !!user.name);
        if (named.length === 0) {
            chat.log('{clr=#FF00FF}! no other users');
        }
        else {
            const names = named.map((user) => user.name);
            const line = names.join('{clr=#FF00FF}, {clr=#FF0000}');
            chat.log(`{clr=#FF00FF}! ${names.length} users: {clr=#FF0000}${line}`);
        }
    }
    const help = [
        'press tab: toggle typing/controls',
        'press q: toggle queue',
        'press 1/2/3: toggle emotes',
        '/youtube videoId',
        '/search query terms',
        '/lucky search terms',
        '/skip',
        '/avatar',
        '/users',
        '/name',
        '/notify',
        '/volume 100',
        '/resync',
    ].join('\n');
    function listHelp() {
        chat.log('{clr=#FFFF00}? /help\n' + help);
    }
    function playFromSearchResult(args) {
        const index = parseInt(args, 10) - 1;
        if (isNaN(index))
            chat.log(`{clr=#FF00FF}! did not understand '${args}' as a number`);
        else if (!lastSearchResults || index < 0 || index >= lastSearchResults.length)
            chat.log(`{clr=#FF00FF}! there is no #${index + 1} search result`);
        else
            exports.client.messaging.send('youtube', { videoId: lastSearchResults[index].source.videoId });
    }
    const avatarPanel = document.querySelector('#avatar-panel');
    const avatarPaint = document.querySelector('#avatar-paint');
    const avatarUpdate = document.querySelector('#avatar-update');
    const avatarCancel = document.querySelector('#avatar-cancel');
    const avatarContext = avatarPaint.getContext('2d');
    function openAvatarEditor() {
        const avatar = getTile(exports.client.localUser.avatar) || avatarImage;
        avatarContext.clearRect(0, 0, 8, 8);
        avatarContext.drawImage(avatar.canvas, 0, 0);
        avatarPanel.hidden = false;
    }
    avatarPaint.addEventListener('pointerdown', (event) => {
        const scaling = 8 / avatarPaint.clientWidth;
        const [cx, cy] = utility_1.eventToElementPixel(event, avatarPaint);
        const [px, py] = [Math.floor(cx * scaling), Math.floor(cy * scaling)];
        utility_1.withPixels(avatarContext, (pixels) => {
            pixels[py * 8 + px] = 0xffffffff - pixels[py * 8 + px];
        });
    });
    avatarUpdate.addEventListener('click', () => {
        const data = blitsy.encodeTexture(avatarContext, 'M1').data;
        exports.client.messaging.send('avatar', { data });
    });
    avatarCancel.addEventListener('click', () => (avatarPanel.hidden = true));
    const chatCommands = new Map();
    chatCommands.set('search', (query) => exports.client.messaging.send('search', { query }));
    chatCommands.set('youtube', (videoId) => exports.client.messaging.send('youtube', { videoId }));
    chatCommands.set('skip', (password) => {
        if (currentPlayMessage)
            exports.client.messaging.send('skip', { password, source: currentPlayMessage.item.media.source });
    });
    chatCommands.set('password', (args) => (exports.client.joinPassword = args));
    chatCommands.set('users', () => listUsers());
    chatCommands.set('help', () => listHelp());
    chatCommands.set('result', playFromSearchResult);
    chatCommands.set('lucky', (query) => exports.client.messaging.send('search', { query, lucky: true }));
    chatCommands.set('reboot', (password) => exports.client.messaging.send('reboot', { password }));
    chatCommands.set('avatar', (data) => {
        if (data.trim().length === 0) {
            openAvatarEditor();
        }
        else {
            exports.client.messaging.send('avatar', { data });
        }
    });
    chatCommands.set('avatar2', (args) => {
        const ascii = args.replace(/\s+/g, '\n');
        const avatar = blitsy.decodeAsciiTexture(ascii, '1');
        const data = blitsy.encodeTexture(avatar, 'M1').data;
        exports.client.messaging.send('avatar', { data });
    });
    chatCommands.set('volume', (args) => setVolume(parseInt(args.trim(), 10)));
    chatCommands.set('resync', () => exports.client.messaging.send('resync', {}));
    chatCommands.set('notify', async () => {
        const permission = await Notification.requestPermission();
        chat.log(`{clr=#FF00FF}! notifications ${permission}`);
    });
    chatCommands.set('name', rename);
    chatCommands.set('archive', (path) => exports.client.messaging.send('archive', { path }));
    function toggleEmote(emote) {
        const emotes = exports.client.localUser.emotes;
        if (emotes.includes(emote))
            exports.client.messaging.send('emotes', { emotes: emotes.filter((e) => e !== emote) });
        else
            exports.client.messaging.send('emotes', { emotes: emotes.concat([emote]) });
    }
    const gameKeys = new Map();
    gameKeys.set('Tab', () => chatInput.focus());
    gameKeys.set('1', () => toggleEmote('wvy'));
    gameKeys.set('2', () => toggleEmote('shk'));
    gameKeys.set('3', () => toggleEmote('rbw'));
    gameKeys.set('q', () => (showQueue = !showQueue));
    gameKeys.set('ArrowLeft', () => move(-1, 0));
    gameKeys.set('ArrowRight', () => move(1, 0));
    gameKeys.set('ArrowDown', () => move(0, 1));
    gameKeys.set('ArrowUp', () => move(0, -1));
    function sendChat() {
        const line = chatInput.value;
        const slash = line.match(/^\/(\w+)(.*)/);
        if (slash) {
            const command = chatCommands.get(slash[1]);
            if (command) {
                command(slash[2].trim());
            }
            else {
                chat.log(`{clr=#FF00FF}! no command /${slash[1]}`);
                listHelp();
            }
        }
        else if (line.length > 0) {
            exports.client.messaging.send('chat', { text: parseFakedown(line) });
        }
        chatInput.value = '';
    }
    document.addEventListener('keydown', (event) => {
        const typing = document.activeElement.tagName === 'INPUT';
        if (typing) {
            if (event.key === 'Tab' || event.key === 'Escape') {
                chatInput.blur();
                event.preventDefault();
            }
            else if (event.key === 'Enter') {
                sendChat();
            }
        }
        else if (!typing) {
            const func = gameKeys.get(event.key);
            if (func) {
                func();
                event.stopPropagation();
                event.preventDefault();
            }
        }
    });
    const chatContext = document.querySelector('#chat-canvas').getContext('2d');
    chatContext.imageSmoothingEnabled = false;
    const sceneContext = document.querySelector('#scene-canvas').getContext('2d');
    sceneContext.imageSmoothingEnabled = false;
    const pageRenderer = new text_1.PageRenderer(256, 256);
    const zoneLogo = document.querySelector('#zone-logo');
    function drawZone() {
        var _a;
        sceneContext.clearRect(0, 0, 512, 512);
        sceneContext.drawImage(roomBackground.canvas, 0, 0, 512, 512);
        exports.client.zone.users.forEach((user) => {
            const { position, emotes, avatar } = user;
            if (!position)
                return;
            let dx = 0;
            let dy = 0;
            if (emotes && emotes.includes('shk')) {
                dx += utility_1.randomInt(-8, 8);
                dy += utility_1.randomInt(-8, 8);
            }
            if (emotes && emotes.includes('wvy')) {
                dy += Math.sin(performance.now() / 250 - position[0] / 2) * 4;
            }
            let [r, g, b] = [255, 255, 255];
            const x = position[0] * 32 + dx;
            const y = position[1] * 32 + dy;
            let image = getTile(avatar) || avatarImage;
            if (emotes && emotes.includes('rbw')) {
                const h = Math.abs(Math.sin(performance.now() / 600 - position[0] / 8));
                [r, g, b] = utility_1.hslToRgb(h, 1, 0.5);
                image = recolored(image, utility_1.rgb2num(r, g, b));
            }
            sceneContext.drawImage(image.canvas, x, y, 32, 32);
        });
        const state = (_a = exports.client.messaging.websocket) === null || _a === void 0 ? void 0 : _a.readyState;
        if (state !== WebSocket.OPEN) {
            const status = text_1.scriptToPages('connecting...', layout)[0];
            chat_1.animatePage(status);
            pageRenderer.renderPage(status, 0, 0);
            sceneContext.drawImage(pageRenderer.pageImage, 16, 16, 512, 512);
        }
    }
    function drawQueue() {
        const lines = [];
        const cols = 40;
        function line(title, seconds) {
            const time = utility_1.secondsToTime(seconds);
            const limit = cols - time.length;
            const cut = title.length < limit ? title.padEnd(limit, ' ') : title.slice(0, limit - 4) + '... ';
            lines.push(cut + time);
        }
        let remaining = 0;
        if (currentPlayMessage) {
            if (currentPlayMessage.item.media.source.type === 'youtube') {
                remaining = Math.round(player.duration - player.time);
            }
            else if (currentPlayMessage.item.media.source.type === 'archive') {
                remaining = httpvideo.duration - httpvideo.currentTime;
            }
            else {
                const duration = currentPlayMessage.item.media.details.duration;
                const elapsed = performance.now() - currentPlayStart;
                remaining = Math.max(0, duration - elapsed) / 1000;
            }
        }
        if (currentPlayMessage && remaining > 0)
            line(currentPlayMessage.item.media.details.title, remaining);
        let total = remaining;
        if (showQueue) {
            queue.forEach((item) => {
                line(item.media.details.title, item.media.details.duration / 1000);
                total += item.media.details.duration / 1000;
            });
            line('*** END ***', total);
            lines[lines.length - 1] = '{clr=#FF00FF}' + lines[lines.length - 1];
        }
        const queuePage = text_1.scriptToPages(lines.join('\n'), layout)[0];
        chat_1.animatePage(queuePage);
        pageRenderer.renderPage(queuePage, 0, 0);
        const queueHeight = text_1.getPageHeight(queuePage, font);
        chatContext.fillRect(0, 0, 512, queueHeight * 2 + 16);
        chatContext.drawImage(pageRenderer.pageImage, 16, 16, 512, 512);
    }
    function redraw() {
        const playing = !!currentPlayMessage;
        youtube.hidden = !player.playing;
        httpvideo.hidden = !playing || (currentPlayMessage === null || currentPlayMessage === void 0 ? void 0 : currentPlayMessage.item.media.source.type) !== 'archive';
        archive.hidden = true; // !playing || currentPlayMessage?.item.media.source.type !== "archive";
        zoneLogo.hidden = playing;
        drawZone();
        chatContext.fillStyle = 'rgb(0, 0, 0)';
        chatContext.fillRect(0, 0, 512, 512);
        chat.render();
        chatContext.drawImage(chat.context.canvas, 0, 0, 512, 512);
        drawQueue();
        window.requestAnimationFrame(redraw);
    }
    redraw();
    setupEntrySplash();
}
function setupEntrySplash() {
    const entrySplash = document.querySelector('#entry-splash');
    const entryButton = document.querySelector('#entry-button');
    entryButton.disabled = false;
    entryButton.addEventListener('click', () => {
        entrySplash.hidden = true;
        enter();
    });
}
function enter() {
    localName = document.querySelector('#join-name').value;
    localStorage.setItem('name', localName);
    const urlparams = new URLSearchParams(window.location.search);
    const zoneURL = urlparams.get('zone') || `${window.location.host}/zone`;
    exports.client.messaging.connect('ws://' + zoneURL);
}

},{"./chat":11,"./client":12,"./text":15,"./utility":16,"./youtube":17,"blitsy":7}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utility_1 = require("./utility");
const events_1 = require("events");
class WebSocketMessaging extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.websocket = undefined;
        this.handlers = new Map();
    }
    connect(address) {
        this.disconnect();
        this.websocket = new WebSocket(address);
        this.websocket.onopen = (event) => this.onOpen(event);
        this.websocket.onclose = (event) => this.onClose(event);
        this.websocket.onmessage = (event) => this.onMessage(event);
    }
    reconnect() {
        if (!this.websocket)
            return;
        this.connect(this.websocket.url);
    }
    disconnect() {
        if (!this.websocket)
            return;
        this.websocket.close(1000);
        this.websocket = undefined;
    }
    async wait() {
        while (this.websocket && this.websocket.readyState === WebSocket.CONNECTING)
            await utility_1.sleep(10);
    }
    send(type, message) {
        message.type = type;
        try {
            this.websocket.send(JSON.stringify(message));
        }
        catch (e) {
            console.log("couldn't send", message, e);
        }
    }
    setHandler(type, handler) {
        this.handlers.set(type, handler);
    }
    onMessage(event) {
        const message = JSON.parse(event.data);
        const handler = this.handlers.get(message.type);
        if (handler) {
            try {
                handler(message);
            }
            catch (e) {
                console.log('EXCEPTION HANDLING MESSAGE', message, e);
            }
        }
        else {
            console.log(`NO HANDLER FOR MESSAGE TYPE ${message.type}`);
        }
    }
    onOpen(event) {
        this.emit('open');
    }
    async onClose(event) {
        this.emit('close', event.code);
    }
}
exports.WebSocketMessaging = WebSocketMessaging;

},{"./utility":16,"events":10}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blitsy_1 = require("blitsy");
const utility_1 = require("./utility");
const FALLBACK_CODEPOINT = '?'.codePointAt(0);
function computeLineWidth(font, line) {
    let width = 0;
    for (const char of line) {
        const code = char.codePointAt(0);
        const fontchar = font.characters.get(code);
        if (fontchar) {
            width += fontchar.spacing;
        }
    }
    return width;
}
exports.computeLineWidth = computeLineWidth;
function makeGlyph(position, sprite, color = 0xffffff, offset = blitsy_1.makeVector2(0, 0), hidden = true, styles = new Map()) {
    return { position, sprite, color, offset, hidden, styles };
}
exports.makeGlyph = makeGlyph;
// TODO: the only reason this is a class rn is it needs those two canvases for
// blending properly...
class PageRenderer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.pageContext = blitsy_1.createContext2D(width, height);
        this.bufferContext = blitsy_1.createContext2D(width, height);
        this.pageImage = this.pageContext.canvas;
    }
    /**
     * Render a page of glyphs to the pageImage, offset by (px, py).
     * @param page glyphs to be rendered.
     * @param px horizontal offset in pixels.
     * @param py verticle offest in pixels.
     */
    renderPage(page, px, py) {
        this.pageContext.clearRect(0, 0, this.width, this.height);
        this.bufferContext.clearRect(0, 0, this.width, this.height);
        for (const glyph of page) {
            if (glyph.hidden)
                continue;
            // padding + position + offset
            const dx = px + glyph.position.x + glyph.offset.x;
            const dy = py + glyph.position.y + glyph.offset.y;
            // draw tint layer
            this.pageContext.fillStyle = utility_1.num2hex(glyph.color);
            this.pageContext.fillRect(dx, dy, glyph.sprite.rect.w, glyph.sprite.rect.h);
            // draw text layer
            blitsy_1.drawSprite(this.bufferContext, glyph.sprite, dx, dy);
        }
        // draw text layer in tint color
        this.pageContext.globalCompositeOperation = 'destination-in';
        this.pageContext.drawImage(this.bufferContext.canvas, 0, 0);
        this.pageContext.globalCompositeOperation = 'source-over';
    }
}
exports.PageRenderer = PageRenderer;
function scriptToPages(script, context, styleHandler = exports.defaultStyleHandler) {
    const tokens = tokeniseScript(script);
    const commands = tokensToCommands(tokens);
    return commandsToPages(commands, context, styleHandler);
}
exports.scriptToPages = scriptToPages;
function find(array, start, step, predicate) {
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
function filterToSpans(array, breakable) {
    const spans = [];
    let buffer = [];
    array.forEach((element, index) => {
        if (!breakable(element, index)) {
            buffer.push(element);
        }
        else if (buffer.length > 0) {
            spans.push(buffer);
            buffer = [];
        }
    });
    if (buffer.length > 0) {
        spans.push(buffer);
    }
    return spans;
}
exports.filterToSpans = filterToSpans;
exports.defaultStyleHandler = (styles, style) => {
    if (style.substr(0, 1) === '+') {
        styles.set(style.substring(1), true);
    }
    else if (style.substr(0, 1) === '-') {
        styles.delete(style.substring(1));
    }
    else if (style.includes('=')) {
        const [key, val] = style.split(/\s*=\s*/);
        styles.set(key, val);
    }
};
function commandsToPages(commands, layout, styleHandler = exports.defaultStyleHandler) {
    commandsBreakLongSpans(commands, layout);
    const styles = new Map();
    const pages = [];
    let page = [];
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
        if (currLine === layout.lineCount)
            newPage();
    }
    function doBreak(target) {
        if (target === 'line')
            endLine();
        else if (target === 'page')
            endPage();
    }
    function findNextBreakIndex() {
        let width = 0;
        const isBreakableGlyph = (command) => command.type === 'glyph' && command.breakable;
        for (let i = 0; i < commands.length; ++i) {
            const command = commands[i];
            if (command.type === 'break')
                return i;
            if (command.type === 'style')
                continue;
            width += computeLineWidth(layout.font, command.char);
            // if we overshot, look backward for last possible breakable glyph
            if (width > layout.lineWidth) {
                const result = find(commands, i, -1, isBreakableGlyph);
                if (result)
                    return result[1];
            }
        }
    }
    function addGlyph(command, offset) {
        const codepoint = command.char.codePointAt(0);
        const char = layout.font.characters.get(codepoint) || layout.font.characters.get(FALLBACK_CODEPOINT);
        const pos = blitsy_1.makeVector2(offset, currLine * (layout.font.lineHeight + 4));
        const glyph = makeGlyph(pos, char.sprite);
        glyph.styles = new Map(styles.entries());
        page.push(glyph);
        return char.spacing;
    }
    // tslint:disable-next-line:no-shadowed-variable
    function generateGlyphLine(commands) {
        let offset = 0;
        for (const command of commands) {
            if (command.type === 'glyph') {
                offset += addGlyph(command, offset);
            }
            else if (command.type === 'style') {
                styleHandler(styles, command.style);
            }
        }
    }
    let index;
    // tslint:disable-next-line:no-conditional-assignment
    while ((index = findNextBreakIndex()) !== undefined) {
        generateGlyphLine(commands.slice(0, index));
        commands = commands.slice(index);
        const command = commands[0];
        if (command.type === 'break') {
            doBreak(command.target);
            commands.shift();
        }
        else {
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
exports.commandsToPages = commandsToPages;
/**
 * Find spans of unbreakable commands that are too long to fit within a page
 * width and amend those spans so that breaking permitted in all positions.
 */
function commandsBreakLongSpans(commands, context) {
    const canBreak = (command) => command.type === 'break' || (command.type === 'glyph' && command.breakable);
    const spans = filterToSpans(commands, canBreak);
    for (const span of spans) {
        const glyphs = span.filter((command) => command.type === 'glyph');
        const charWidths = glyphs.map((command) => computeLineWidth(context.font, command.char));
        const spanWidth = charWidths.reduce((x, y) => x + y, 0);
        if (spanWidth > context.lineWidth) {
            for (const command of glyphs)
                command.breakable = true;
        }
    }
}
exports.commandsBreakLongSpans = commandsBreakLongSpans;
function tokensToCommands(tokens) {
    const commands = [];
    function handleToken([type, buffer]) {
        if (type === 'text')
            handleText(buffer);
        else if (type === 'markup')
            handleMarkup(buffer);
    }
    function handleText(buffer) {
        for (const char of buffer) {
            const breakable = char === ' ';
            commands.push({ type: 'glyph', char, breakable });
        }
    }
    function handleMarkup(buffer) {
        if (buffer === 'ep')
            commands.push({ type: 'break', target: 'page' });
        else if (buffer === 'el')
            commands.push({ type: 'break', target: 'line' });
        else
            commands.push({ type: 'style', style: buffer });
    }
    tokens.forEach(handleToken);
    return commands;
}
exports.tokensToCommands = tokensToCommands;
function tokeniseScript(script) {
    const tokens = [];
    let buffer = '';
    let braceDepth = 0;
    function openBrace() {
        if (braceDepth === 0)
            flushBuffer();
        braceDepth += 1;
    }
    function closeBrace() {
        if (braceDepth === 1)
            flushBuffer();
        braceDepth -= 1;
    }
    function newLine() {
        flushBuffer();
        tokens.push(['markup', 'el']);
    }
    function flushBuffer() {
        if (buffer.length === 0)
            return;
        const type = braceDepth > 0 ? 'markup' : 'text';
        tokens.push([type, buffer]);
        buffer = '';
    }
    const actions = {
        '{': openBrace,
        '}': closeBrace,
        '\n': newLine,
    };
    for (const char of script) {
        if (char in actions)
            actions[char]();
        else
            buffer += char;
    }
    flushBuffer();
    return tokens;
}
exports.tokeniseScript = tokeniseScript;
function getPageHeight(page, font) {
    if (page.length === 0)
        return 0;
    let ymin = page[0].position.y;
    let ymax = ymin;
    page.forEach((char) => {
        ymin = Math.min(ymin, char.position.y);
        ymax = Math.max(ymax, char.position.y);
    });
    ymax += font.lineHeight + 4;
    return ymax - ymin;
}
exports.getPageHeight = getPageHeight;

},{"./utility":16,"blitsy":7}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blitsy_1 = require("blitsy");
exports.objEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
exports.randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
exports.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.clamp = (min, max, value) => Math.max(min, Math.min(max, value));
function fakedownToTag(text, fd, tag) {
    const pattern = new RegExp(`${fd}([^${fd}]+)${fd}`, 'g');
    return text.replace(pattern, `{+${tag}}$1{-${tag}}`);
}
exports.fakedownToTag = fakedownToTag;
const pad2 = (part) => (part.toString().length >= 2 ? part.toString() : '0' + part.toString());
function secondsToTime(seconds) {
    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);
    return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
exports.secondsToTime = secondsToTime;
function recolor(context) {
    withPixels(context, (pixels) => {
        for (let i = 0; i < pixels.length; ++i)
            if (pixels[i] === 0xffffffff)
                pixels[i] = blitsy_1.rgbaToColor({ r: 128, g: 159, b: 255, a: 255 });
    });
}
exports.recolor = recolor;
// source : https://gist.github.com/mjackson/5311256
function hue2rgb(p, q, t) {
    if (t < 0)
        t += 1;
    if (t > 1)
        t -= 1;
    if (t < 1 / 6)
        return p + (q - p) * 6 * t;
    if (t < 1 / 2)
        return q;
    if (t < 2 / 3)
        return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}
exports.hue2rgb = hue2rgb;
function hslToRgb(h, s, l) {
    let r;
    let g;
    let b;
    if (s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r * 255, g * 255, b * 255];
}
exports.hslToRgb = hslToRgb;
function withPixels(context, action) {
    const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    action(new Uint32Array(image.data.buffer));
    context.putImageData(image, 0, 0);
}
exports.withPixels = withPixels;
function num2hex(value) {
    return rgb2hex(num2rgb(value));
}
exports.num2hex = num2hex;
function rgb2num(r, g, b, a = 255) {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
exports.rgb2num = rgb2num;
function num2rgb(value) {
    const r = (value >> 0) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = (value >> 16) & 0xff;
    return [r, g, b];
}
exports.num2rgb = num2rgb;
function rgb2hex(color) {
    const [r, g, b] = color;
    let rs = r.toString(16);
    let gs = g.toString(16);
    let bs = b.toString(16);
    if (rs.length < 2) {
        rs = '0' + rs;
    }
    if (gs.length < 2) {
        gs = '0' + gs;
    }
    if (bs.length < 2) {
        bs = '0' + bs;
    }
    return `#${rs}${gs}${bs}`;
}
exports.rgb2hex = rgb2hex;
function hex2rgb(color) {
    const matches = color.match(/^#([0-9a-f]{6})$/i);
    if (matches) {
        const match = matches[1];
        return [parseInt(match.substr(0, 2), 16), parseInt(match.substr(2, 2), 16), parseInt(match.substr(4, 2), 16)];
    }
    return [0, 0, 0];
}
exports.hex2rgb = hex2rgb;
function getDefault(map, key, factory) {
    let value = map.get(key);
    if (!value) {
        value = factory(key);
        map.set(key, value);
    }
    return value;
}
exports.getDefault = getDefault;
function eventToElementPixel(event, element) {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.x, event.clientY - rect.y];
}
exports.eventToElementPixel = eventToElementPixel;

},{"blitsy":7}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const utility_1 = require("./utility");
class YoutubePlayer extends events_1.EventEmitter {
    constructor(player) {
        super();
        this.player = player;
        this.startSeconds = 0;
        this.retries = 0;
        this.player.addEventListener('onError', (e) => this.onError(e));
    }
    get video() {
        return this.currentVideo;
    }
    get time() {
        return this.player.getCurrentTime();
    }
    get duration() {
        return this.player.getDuration();
    }
    get volume() {
        return this.player.getVolume();
    }
    set volume(value) {
        this.player.setVolume(value);
    }
    get playing() {
        return this.player.getPlayerState() === 1;
    }
    playVideoById(videoId, startSeconds = 0, forceReload = false) {
        this.retries = 0;
        if (videoId !== this.currentVideo || forceReload) {
            this.currentVideo = videoId;
            this.startSeconds = startSeconds;
            this.player.loadVideoById({ videoId, startSeconds });
        }
        else {
            const delay = Math.abs(startSeconds - this.time);
            if (delay > 0.5) {
                this.startSeconds = startSeconds;
                this.player.seekTo(startSeconds, true);
            }
        }
    }
    stop() {
        this.player.stopVideo();
    }
    async onError(event) {
        const error = errorEventToYoutubeError(event);
        if (this.retries >= 3) {
            this.emit('error', error);
        }
        else {
            await utility_1.sleep(500);
            this.retries += 1;
            this.player.loadVideoById({
                videoId: this.video,
                startSeconds: this.startSeconds,
            });
        }
    }
}
exports.YoutubePlayer = YoutubePlayer;
function loadYoutube(id, width, height) {
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
                    onStateChange: (event) => console.log(`YT STATE: ${event.data}`),
                },
            });
        };
        const tag = document.createElement('script');
        tag.onerror = () => console.log('youtube error :(');
        tag.src = 'https://www.youtube.com/player_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
}
exports.loadYoutube = loadYoutube;
// from https://developers.google.com/youtube/iframe_api_reference
const CODE_REASONS = new Map();
CODE_REASONS.set(2, 'invalid parameter');
CODE_REASONS.set(5, 'HTML5 player error');
CODE_REASONS.set(100, 'video not found');
CODE_REASONS.set(101, 'video unembeddable');
CODE_REASONS.set(150, CODE_REASONS.get(101));
function errorEventToYoutubeError(event) {
    return { code: event.data, reason: CODE_REASONS.get(event.data) || 'unknown' };
}

},{"./utility":16,"events":10}]},{},[13])(13)
});
