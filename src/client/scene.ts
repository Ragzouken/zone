import * as THREE from 'three';
import { ZoneState } from '../common/zone';
import { hslToRgb, withPixels, eventToElementPixel } from './utility';
import { randomInt } from '../common/utility';
import { rgbaToColor, decodeAsciiTexture } from 'blitsy';
import { EventEmitter } from 'events';

function recolor(context: CanvasRenderingContext2D) {
    withPixels(context, (pixels) => {
        const fg = rgbaToColor({ r: 32, g: 40, b: 64, a: 255 });
        const bg = rgbaToColor({ r: 0, g: 21, b: 51, a: 255 });
        for (let i = 0; i < pixels.length; ++i) pixels[i] = pixels[i] === 0xffffffff ? fg : bg;
    });
}

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

const floorTile = decodeAsciiTexture(
    `
________
_X_X_X_X
________
__X_____
________
X_X_X_X_
________
_____X__
`,
    'X',
);

const brickTile = decodeAsciiTexture(
    `
###_####
###_####
###_####
________
#######_
#######_
#######_
________
`,
    '#',
);

recolor(floorTile);
recolor(brickTile);

const black = new THREE.Color(0, 0, 0);
const red = new THREE.Color(255, 0, 0);

const brickTexture = makeTileCanvasTexture(brickTile.canvas);
const floorTexture = makeTileCanvasTexture(floorTile.canvas);
brickTexture.repeat.set(16, 10);
floorTexture.repeat.set(16, 6);
const brickMaterial = new THREE.MeshBasicMaterial({ map: brickTexture, side: THREE.DoubleSide });
const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide });

function makeTileCanvasTexture(canvas: HTMLCanvasElement) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function isVideo(element: HTMLElement | undefined): element is HTMLVideoElement {
    return element?.nodeName === 'VIDEO';
}

function isCanvas(element: HTMLElement | undefined): element is HTMLCanvasElement {
    return element?.nodeName === 'CANVAS';
}

function isImage(element: HTMLElement | undefined): element is HTMLImageElement {
    return element?.nodeName === 'IMG';
}

const tileMaterials = new Map<HTMLCanvasElement, THREE.MeshBasicMaterial>();
function getTileMaterial(canvas: HTMLCanvasElement) {
    const existing = tileMaterials.get(canvas);
    if (existing) return existing;

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
    });
    tileMaterials.set(canvas, material);

    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return material;
}

const avatarMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(avatarImage.canvas),
    transparent: true,
    side: THREE.DoubleSide,
});

const avatarQuad = new THREE.PlaneGeometry(1 / 16, 1 / 16, 1, 1);
const avatarMeshes: THREE.Mesh[] = [];
function setAvatarCount(count: number) {
    while (avatarMeshes.length < count) {
        avatarMeshes.push(new THREE.Mesh(avatarQuad, avatarMaterial));
    }
}

export interface ZoneSceneRenderer {
    on(event: 'pointerdown', callback: (point: THREE.Vector3) => void): this;
    on(event: 'pointermove', callback: (point?: THREE.Vector3) => void): this;
}

export class ZoneSceneRenderer extends EventEmitter {
    mediaElement?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

    private readonly renderer = new THREE.WebGLRenderer({ antialias: false });
    private readonly camera: THREE.Camera;
    private readonly raycaster = new THREE.Raycaster();

    private readonly mediaTexture = new THREE.VideoTexture(document.createElement('video'));

    private readonly scene = new THREE.Scene();
    private readonly avatarGroup = new THREE.Group();
    private readonly mediaMesh: THREE.Mesh;
    private readonly floorMesh: THREE.Mesh;
    private readonly brickMesh: THREE.Mesh;

    constructor(
        container: HTMLElement,
        private readonly zone: ZoneState,
        private readonly getTile: (base64: string | undefined) => CanvasRenderingContext2D,
        private readonly connecting: () => boolean,
    ) {
        super();
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 1.1;
        this.camera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.01,
            10,
        );
        // const camera = new THREE.PerspectiveCamera(70, aspect, 0.01, 10);
        this.camera.position.set(-1 / 8, 4.5 / 8, 4.5 / 8);
        this.camera.lookAt(0, 0, 0);

        this.mediaTexture.minFilter = THREE.NearestFilter;
        this.mediaTexture.magFilter = THREE.NearestFilter;
        this.mediaTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.mediaTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.mediaTexture.format = THREE.RGBFormat;

        const mediaMaterial = new THREE.MeshBasicMaterial({
            map: this.mediaTexture,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        this.mediaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mediaMaterial);
        this.brickMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 10 / 16, 1, 1), brickMaterial);
        this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 6 / 16, 1, 1), floorMaterial);

        this.floorMesh.rotateX(Math.PI / 2);
        this.floorMesh.translateZ(5 / 16);
        this.mediaMesh.translateZ(-3 / 16 + 1 / 512);
        this.brickMesh.translateZ(-3 / 16);

        this.scene.add(this.brickMesh);
        this.scene.add(this.floorMesh);
        this.scene.add(this.avatarGroup);
        this.scene.add(this.mediaMesh);

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            const point = this.getPointUnderMouseEvent(event);
            if (point) this.emit('pointerdown', point);
        });

        this.renderer.domElement.addEventListener('pointermove', (event) => {
            const point = this.getPointUnderMouseEvent(event);
            this.emit('pointermove', point);
        });
    }

    update() {
        this.renderer.setClearColor(this.connecting() ? red : black);
        this.mediaTexture.image = this.mediaElement;
        this.mediaTexture.needsUpdate = true;

        let mediaAspect = 1;

        if (isVideo(this.mediaElement)) {
            mediaAspect = this.mediaElement.videoWidth / this.mediaElement.videoHeight;
        } else if (isImage(this.mediaElement)) {
            mediaAspect = this.mediaElement.naturalWidth / this.mediaElement.naturalHeight;
        } else if (isCanvas(this.mediaElement)) {
            mediaAspect = this.mediaElement.width / this.mediaElement.height;
        }

        this.mediaMesh.scale.set((252 * mediaAspect) / 512, 252 / 512, 1);

        setAvatarCount(this.zone.users.size);
        this.avatarGroup.children = [];

        let i = 0;
        this.zone.users.forEach((user) => {
            if (!user.position) return;
            let y = -4.5;
            let [x, z] = user.position;
            const mesh = avatarMeshes[i++];

            if (z < 10) {
                y -= z - 9;
            }

            z = Math.max(0, z - 10);
            x -= 7.5;
            z -= 2.5;

            let [dy, dx] = [0, 0];
            if (user.emotes && user.emotes.includes('shk')) {
                dy += randomInt(-8, 8);
                dx += randomInt(-8, 8);
            }

            if (user.emotes && user.emotes.includes('wvy')) {
                dy += 4 + Math.sin(performance.now() / 250 - x / 2) * 4;
            }

            let [r, g, b] = [255, 255, 255];
            if (user.emotes && user.emotes.includes('rbw')) {
                const h = Math.abs(Math.sin(performance.now() / 600 - x / 8));
                [r, g, b] = hslToRgb(h, 1, 0.5);
                r = Math.round(r);
                g = Math.round(g);
                b = Math.round(b);
            }

            const spin = user.emotes && user.emotes.includes('spn');
            const angle = spin ? performance.now() / 100 - x : 0;

            mesh.rotation.y = angle;

            const tile = this.getTile(user.avatar).canvas;
            const material = getTileMaterial(tile);
            material.color.set(`rgb(${r}, ${g}, ${b})`);
            mesh.material = material;

            mesh.position.set(x / 16 + dx / 512, y / 16 + dy / 512, z / 16);

            this.avatarGroup.add(mesh);
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getPointUnderMouseEvent(event: PointerEvent) {
        const [cx, cy] = eventToElementPixel(event, this.renderer.domElement);

        const point = new THREE.Vector2();
        point.x = (cx / this.renderer.domElement.clientWidth) * 2 - 1;
        point.y = -(cy / this.renderer.domElement.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(point, this.camera);
        const brickIntersects = this.raycaster.intersectObject(this.brickMesh);
        const floorIntersects = this.raycaster.intersectObject(this.floorMesh);

        if (brickIntersects.length > 0) {
            const intersection = brickIntersects[0].point;
            const x = Math.floor((intersection.x + 0.5) * 16);
            const y = 12 - Math.floor((intersection.y + 0.5) * 16);

            return { x, y };
        } else if (floorIntersects.length > 0) {
            const intersection = floorIntersects[0].point;
            const x = Math.floor((intersection.x + 0.5) * 16);
            const y = 5 + Math.floor((intersection.z + 0.5) * 16);

            return { x, y };
        } else {
            return undefined;
        }
    }
}
