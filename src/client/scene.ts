import * as THREE from 'three';
import { ZoneState, UserState } from '../common/zone';
import { hslToRgb, withPixels, eventToElementPixel } from './utility';
import { randomInt, Grid } from '../common/utility';
import { rgbaToColor, decodeAsciiTexture, createContext2D } from 'blitsy';
import { EventEmitter } from 'events';
import ZoneClient from '../common/client';
import { text } from 'express';
import { number } from '@hapi/joi';

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

const texture = createContext2D(16, 8);
texture.drawImage(floorTile.canvas, 0, 0);
texture.drawImage(brickTile.canvas, 8, 0);

const cursorTile = decodeAsciiTexture(
    `
########
#______#
#______#
#______#
#______#
#______#
#______#
########
`,
    '#',
);

const black = new THREE.Color(0, 0, 0);
const red = new THREE.Color(255, 0, 0);

const blockTexture = makeTileCanvasTexture(texture.canvas);
const cursorTexture = makeTileCanvasTexture(cursorTile.canvas);

const blockMaterial = new THREE.MeshBasicMaterial({ map: blockTexture });

const cursorGeo = new THREE.BoxBufferGeometry(1 / 16, 1 / 16, 1 / 16);
const cursorMat = new THREE.MeshBasicMaterial({ map: cursorTexture, side: THREE.DoubleSide, transparent: true });

const cubeData = {
    faces: [
        {
            name: 'top',
            positions: [
                [0, 1, 1],
                [1, 1, 1],
                [1, 1, 0],
                [0, 1, 0],
            ],
            texturing: [
                [0.5, 0],
                [0.5, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        {
            name: 'front',
            positions: [
                [0, 1, 1],
                [0, 0, 1],
                [1, 0, 1],
                [1, 1, 1],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0.5, 1],
                [0.5, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        {
            name: 'back',
            positions: [
                [1, 0, 0],
                [0, 0, 0],
                [0, 1, 0],
                [1, 1, 0],
            ],
            texturing: [
                [0.5, 1],
                [1, 1],
                [1, 0],
                [0.5, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        {
            name: 'left',
            positions: [
                [1, 1, 1],
                [1, 0, 1],
                [1, 0, 0],
                [1, 1, 0],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0.5, 1],
                [0.5, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        {
            name: 'right',
            positions: [
                [0, 1, 0],
                [0, 0, 0],
                [0, 0, 1],
                [0, 1, 1],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0.5, 1],
                [0.5, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        {
            name: 'bottom',
            positions: [
                [0, 0, 1],
                [0, 0, 0],
                [1, 0, 0],
                [1, 0, 1],
            ],
            texturing: [
                [0.5, 0],
                [0.5, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },
    ],
};

function dataToGeo(data: any): THREE.BufferGeometry {
    let indexOffset = 0;
    const indices: number[] = [];
    const positions: number[] = [];
    const texcoords: number[] = [];
    const normals: number[] = [];

    data.faces.forEach((face: any) => {
        // offset indices relative to existing vertices
        // const indexOffset = this.vertexCount;
        const faceIndexes = face.triangles
            .reduce((a: number[], b: number[]) => [...a, ...b], [])
            .map((index: number) => index + indexOffset);

        indices.push(...faceIndexes);
        // faces.set(face.name, faceIndexes);
        // face.triangles.forEach(_ => this.tri2face.push(face.name));

        // compute shared normal and add all positions/texcoords/normals
        const positions2 = face.positions.slice(0, 3).map((position: number[]) => new THREE.Vector3(...position));

        const normal = new THREE.Vector3();
        normal.crossVectors(positions2[1].clone().sub(positions2[0]), positions2[2].clone().sub(positions2[0]));

        face.positions.forEach((position: number[], i: number) => {
            positions.push(...face.positions[i]);
            texcoords.push(...face.texturing[i]);
            normals.push(normal.x, normal.y, normal.z);
        });

        indexOffset += face.positions.length;
    });

    // threejs stuff
    const positionBuffer = new THREE.Float32BufferAttribute(positions, 3);
    const normalBuffer = new THREE.Float32BufferAttribute(normals, 3);
    const texcoordBuffer = new THREE.Float32BufferAttribute(texcoords, 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positionBuffer);
    geometry.setAttribute('normal', normalBuffer);
    geometry.setAttribute('uv', texcoordBuffer);
    geometry.setIndex(indices);

    geometry.translate(-0.5, -0.5, -0.5);
    geometry.scale(1 / 16, 1 / 16, 1 / 16);
    geometry.rotateY(Math.PI / 2);
    return geometry;
}

const blockGeo = dataToGeo(cubeData);

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

const tileTextures = new Map<HTMLCanvasElement, THREE.CanvasTexture>();
function getTileTexture(canvas: HTMLCanvasElement) {
    const existing = tileTextures.get(canvas);
    if (existing) return existing;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    tileTextures.set(canvas, texture);
    return texture;
}

const avatarQuad = new THREE.PlaneGeometry(1 / 16, 1 / 16, 1, 1);
const avatarMeshes: THREE.Mesh[] = [];
function setAvatarCount(count: number) {
    while (avatarMeshes.length < count) {
        const material = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(avatarImage.canvas),
            transparent: true,
            side: THREE.DoubleSide,
        });
        avatarMeshes.push(new THREE.Mesh(avatarQuad, material));
    }
}

function orientCamera(camera: THREE.Camera, focus: THREE.Vector3, angle: number, pitch: number, depth: number) {
    const euler = new THREE.Euler(-pitch, angle, 0, 'ZYX');
    const position = new THREE.Vector3(0, 0, depth);
    position.applyEuler(euler);
    position.add(focus);

    camera.position.copy(position);
    camera.lookAt(focus);
}

export class FocusCamera {
    focus = new THREE.Vector3();
    angle = -Math.PI / 12;
    pitch = Math.PI / 4;
    depth = 1;
}

export interface ScenePointerInfo {
    spaceCoords?: number[];
    blockCoords?: number[];
    objectCoords?: number[];
}

export interface ZoneSceneRenderer {
    on(event: 'pointerdown' | 'pointermove', callback: (info: ScenePointerInfo) => void): this;
}

export class ZoneSceneRenderer extends EventEmitter {
    mediaElement?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

    private readonly renderer = new THREE.WebGLRenderer({ antialias: false });
    private readonly cameras: [THREE.Camera, boolean, boolean][] = [];
    private readonly raycaster = new THREE.Raycaster();

    private readonly mediaTexture = new THREE.VideoTexture(document.createElement('video'));

    private readonly scene = new THREE.Scene();
    private readonly avatarGroup = new THREE.Group();
    private readonly blockGroup = new THREE.Group();
    private readonly mediaMesh: THREE.Mesh;

    private readonly cubeToCoords = new Map<THREE.Object3D, number[]>();
    private readonly coordsToCube = new Grid<THREE.Object3D>();
    private readonly avatarToCoords = new Map<THREE.Object3D, number[]>();

    private cameraIndex = 0;
    private cursor = new THREE.Mesh(cursorGeo, cursorMat);

    public readonly followCam: FocusCamera;
    private readonly cinemaCamera: THREE.PerspectiveCamera;
    private readonly isoCamera: THREE.OrthographicCamera;
    private readonly flatCamera: THREE.OrthographicCamera;

    private get camera() {
        return this.cameras[this.cameraIndex][0];
    }

    private get follow() {
        return this.cameras[this.cameraIndex][1];
    }

    get rotateStep() {
        if (!this.cameras[this.cameraIndex][2]) return 0;
        const increment = Math.round((2 * this.followCam.angle) / Math.PI);
        return (increment % 4) + 4;
    }

    constructor(
        container: HTMLElement,
        private readonly client: ZoneClient,
        private readonly zone: ZoneState,
        private readonly getTile: (base64: string | undefined) => CanvasRenderingContext2D,
        private readonly connecting: () => boolean,
    ) {
        super();

        this.cursor.scale.set(1.1, 1.1, 1.1);
        this.cursor.visible = false;

        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 1.1;

        this.isoCamera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.01,
            10,
        );

        this.followCam = new FocusCamera();

        const factor = Math.sqrt(2);

        this.flatCamera = new THREE.OrthographicCamera(
            (1 * aspect) / -2,
            (1 * aspect) / 2,
            0.5 / factor,
            -0.5 / factor,
            0.01,
            10,
        );
        this.flatCamera.position.set(0.5 / 16, 1, 1);
        this.flatCamera.lookAt(0.5 / 16, 0, 0);

        const cinemaCamera = new THREE.PerspectiveCamera(70, aspect, 0.01, 10);
        cinemaCamera.position.set(0.5 / 16, 0, 0.8);
        cinemaCamera.lookAt(0.5 / 16, 0, 0);
        this.cinemaCamera = cinemaCamera;

        const setAspect = (aspect: number) => {
            this.cinemaCamera.aspect = aspect;
            this.cinemaCamera.updateProjectionMatrix();

            this.isoCamera.left = (frustumSize * aspect) / -2;
            this.isoCamera.right = (frustumSize * aspect) / 2;
            this.isoCamera.updateProjectionMatrix();

            this.flatCamera.left = (1 * aspect) / -2;
            this.flatCamera.right = (1 * aspect) / 2;
            this.flatCamera.updateProjectionMatrix();
        }

        this.cameras.push([this.isoCamera, false, false]);
        this.cameras.push([this.cinemaCamera, true, true]);
        this.cameras.push([this.flatCamera, false, false]);
        this.cameras.push([this.isoCamera, true, true]);

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
            depthTest: true,
            depthWrite: false,
        });

        this.mediaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mediaMaterial);
        this.mediaMesh.translateX(0.5 / 16);
        this.mediaMesh.translateZ(-2.5 / 16 + 1 / 512);

        this.scene.add(this.blockGroup);
        this.scene.add(this.avatarGroup);
        this.scene.add(this.mediaMesh);
        this.scene.add(this.cursor);

        this.rebuild();

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            const info = this.getInfoUnderMouseEvent(event);

            if (event.shiftKey && info.spaceCoords) {
                client.setBlock(info.spaceCoords, true);
            } else if (event.ctrlKey && info.blockCoords) {
                client.setBlock(info.blockCoords, false);
            } else {
                this.emit('pointerdown', info);
            }

            event.preventDefault();
            event.stopPropagation();
        });

        document.addEventListener('keydown', (event) => (this.cursor.visible = event.shiftKey || event.ctrlKey));
        document.addEventListener('keyup', (event) => (this.cursor.visible = event.shiftKey || event.ctrlKey));

        document.addEventListener('pointermove', (event) => {
            const info = this.getInfoUnderMouseEvent(event);

            if (info?.blockCoords) {
                const [x, y, z] = info.blockCoords;
                this.cursor.position.set(x / 16, y / 16, z / 16);
            }

            this.emit('pointermove', info);
        });

        window.addEventListener('resize', () => {
            setAspect(container.clientWidth / container.clientHeight);
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    cycleCamera() {
        this.cameraIndex = (this.cameraIndex + 1) % this.cameras.length;
    }

    rebuild() {
        while (this.blockGroup.children.length) {
            this.blockGroup.remove(this.blockGroup.children[0]);
        }

        this.coordsToCube.clear();
        this.zone.grid.forEach((_, [x, y, z]) => {
            const cube = new THREE.Mesh(blockGeo, blockMaterial);
            this.blockGroup.add(cube);
            cube.position.set(x / 16, y / 16, z / 16);
            this.cubeToCoords.set(cube, [x, y, z]);
            this.coordsToCube.set([x, y, z], cube);
        });
    }

    rebuildAtCoords(coords: number[][]) {
        coords.forEach((coord) => {
            const value = this.zone.grid.has(coord);

            if (value && !this.coordsToCube.has(coord)) {
                const [x, y, z] = coord;
                const cube = new THREE.Mesh(blockGeo, blockMaterial);
                this.blockGroup.add(cube);
                cube.position.set(x / 16, y / 16, z / 16);
                this.cubeToCoords.set(cube, [x, y, z]);
                this.coordsToCube.set([x, y, z], cube);
            } else if (!value && this.coordsToCube.has(coord)) {
                const mesh = this.coordsToCube.get(coord)!;
                this.blockGroup.remove(mesh);
                this.cubeToCoords.delete(mesh);
                this.coordsToCube.delete(coord);
            }
        });
    }

    update() {
        const localCoords = this.client.localUser?.position;
        if (localCoords && this.follow) {
            const [x, y, z] = localCoords;
            this.followCam.focus.set(x / 16, y / 16, z / 16);
        } else {
            this.followCam.focus.set(0.5 / 16, 0, 0);
        }

        orientCamera(
            this.isoCamera,
            this.followCam.focus,
            this.followCam.angle,
            this.followCam.pitch,
            this.followCam.depth,
        );
        orientCamera(
            this.cinemaCamera,
            this.followCam.focus,
            this.followCam.angle,
            this.followCam.pitch,
            this.followCam.depth,
        );

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

        setAvatarCount(this.zone.users.size + this.zone.echoes.size);
        this.avatarGroup.children = [];

        let i = 0;

        const showAvatar = (user: UserState, echo = false) => {
            if (!user.position) return;
            const [x, y, z] = user.position;
            const mesh = avatarMeshes[i++];

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
            const da = spin ? performance.now() / 100 - x : 0;

            const tile = this.getTile(user.avatar).canvas;
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.color.setRGB(r / 255, g / 255, b / 255);
            material.opacity = echo ? 0.5 : 1;
            material.map = getTileTexture(tile);

            const angle = this.camera === this.flatCamera ? 0 : this.followCam.angle;
            mesh.position.set(x / 16 + dx / 512, y / 16 + dy / 512, z / 16);
            mesh.rotation.y = angle + da;

            this.avatarGroup.add(mesh);
            this.avatarToCoords.set(mesh, user.position);
        };

        this.zone.users.forEach((user) => showAvatar(user));
        this.zone.echoes.forEach((echo) => showAvatar(echo, true));
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    cameraPointFromMouseEvent(event: PointerEvent) {
        const [cx, cy] = eventToElementPixel(event, this.renderer.domElement);

        return new THREE.Vector2(
            -1 + (cx / this.renderer.domElement.clientWidth) * 2,
            1 - (cy / this.renderer.domElement.clientHeight) * 2,
        );
    }

    blockIntersectCameraPoint(point: THREE.Vector2): THREE.Intersection | undefined {
        this.raycaster.setFromCamera(point, this.camera);
        return this.raycaster.intersectObject(this.blockGroup, true)[0];
    }

    objectIntersectCameraPoint(point: THREE.Vector2): THREE.Intersection | undefined {
        this.raycaster.setFromCamera(point, this.camera);
        return this.raycaster.intersectObject(this.avatarGroup, true)[0];
    }

    getAvatarCoordsUnderMouseEvent(event: PointerEvent) {
        const point = this.cameraPointFromMouseEvent(event);
        const intersection = this.objectIntersectCameraPoint(point);

        if (!intersection) return undefined;

        return this.avatarToCoords.get(intersection.object)!;
    }

    getInfoUnderMouseEvent(event: PointerEvent): ScenePointerInfo {
        const point = this.cameraPointFromMouseEvent(event);
        const intersection = this.blockIntersectCameraPoint(point);
        const objectCoords = this.getAvatarCoordsUnderMouseEvent(event);

        const info: ScenePointerInfo = { objectCoords };

        if (intersection) {
            info.blockCoords = this.cubeToCoords.get(intersection.object)!;

            let [x, y, z] = info.blockCoords;
            const delta = intersection.point.sub(intersection.object.position);

            if (Math.abs(delta.y) > Math.abs(delta.x) && Math.abs(delta.y) > Math.abs(delta.z)) {
                y += Math.sign(delta.y);
            } else if (Math.abs(delta.x) > Math.abs(delta.y) && Math.abs(delta.x) > Math.abs(delta.z)) {
                x += Math.sign(delta.x);
            } else if (Math.abs(delta.z) > Math.abs(delta.x) && Math.abs(delta.z) > Math.abs(delta.y)) {
                z += Math.sign(delta.z);
            }

            info.spaceCoords = [x, y, z];
        }

        return info;
    }
}
