import * as THREE from 'three';
import { ZoneState } from '../common/zone';
import { hslToRgb, withPixels, eventToElementPixel } from './utility';
import { randomInt } from '../common/utility';
import { rgbaToColor, decodeAsciiTexture, createContext2D } from 'blitsy';
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

const texture = createContext2D(16, 8);
texture.drawImage(floorTile.canvas, 0, 0);
texture.drawImage(brickTile.canvas, 8, 0);

const testTile = decodeAsciiTexture(
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
const brickTexture = makeTileCanvasTexture(brickTile.canvas);
const floorTexture = makeTileCanvasTexture(floorTile.canvas);
// brickTexture.repeat.set(16, 10);
// floorTexture.repeat.set(16, 6);
const brickMaterial = new THREE.MeshBasicMaterial({ map: brickTexture, side: THREE.DoubleSide });
const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide });

const blockMaterial = new THREE.MeshBasicMaterial({ map: blockTexture });

const cubeGeo = new THREE.BoxBufferGeometry(1/16, 1/16, 1/16);

const cubeData = 
{
    faces:
    [
        {
            name: "top",
            positions: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
            texturing: [   [.5, 0],    [.5, 1],    [0, 1],    [0, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "front",
            positions: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
            texturing: [   [1, 0],    [1, 1],    [.5, 1],    [.5, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "back",
            positions: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
            texturing: [   [.5, 1],    [1, 1],    [1, 0],    [.5, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },
        
        {
            name: "left",
            positions: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
            texturing: [   [1, 0],    [1, 1],    [.5, 1],    [.5, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "right",
            positions: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
            texturing: [   [1, 0],    [1, 1],    [.5, 1],    [.5, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "bottom",
            positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
            texturing: [   [.5, 0],    [.5, 1],    [0, 1],    [0, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        }
    ]
};

function dataToGeo(data: any): THREE.BufferGeometry {
    let indexOffset = 0;
    const indices: number[] = [];
    const positions: number[] = [];
    const texcoords: number[] = [];
    const normals: number[] = [];

    data.faces.forEach((face: any) =>
    {
        // offset indices relative to existing vertices
        // const indexOffset = this.vertexCount;
        const faceIndexes = face.triangles.reduce((a: number[], b: number[]) => [...a, ...b], [])
                                            .map((index: number) => index + indexOffset);

        indices.push(...faceIndexes);
        // faces.set(face.name, faceIndexes);
        // face.triangles.forEach(_ => this.tri2face.push(face.name));

        // compute shared normal and add all positions/texcoords/normals
        const positions2 = face.positions.slice(0, 3).map((position: number[]) => new THREE.Vector3(...position));
        
        const normal = new THREE.Vector3();
        normal.crossVectors(positions2[1].clone().sub(positions2[0]),
                            positions2[2].clone().sub(positions2[0])); 

        face.positions.forEach((position: number[], i: number) =>
        {
            positions.push(...face.positions[i]);
            texcoords.push(...face.texturing[i]);
            normals.push(normal.x, normal.y, normal.z);
        });

        indexOffset += face.positions.length;
    });

    // threejs stuff
    const positionBuffer = new THREE.Float32BufferAttribute(positions, 3);
    const normalBuffer   = new THREE.Float32BufferAttribute(normals,   3);
    const texcoordBuffer = new THREE.Float32BufferAttribute(texcoords, 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positionBuffer);
    geometry.setAttribute("normal",   normalBuffer);
    geometry.setAttribute("uv",       texcoordBuffer);
    geometry.setIndex(indices);

    geometry.translate(-.5, -.5, -.5);
    geometry.scale(1/16, 1/16, 1/16);
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
    private readonly cameras: THREE.Camera[] = [];
    private readonly raycaster = new THREE.Raycaster();

    private readonly mediaTexture = new THREE.VideoTexture(document.createElement('video'));

    private readonly scene = new THREE.Scene();
    private readonly avatarGroup = new THREE.Group();
    private readonly blockGroup = new THREE.Group();
    private readonly mediaMesh: THREE.Mesh;
    private readonly floorMesh: THREE.Mesh;
    private readonly brickMesh: THREE.Mesh;

    private readonly meshToCoords = new Map<THREE.Object3D, number[]>();

    private cameraIndex = 0;

    private get camera() {
        return this.cameras[this.cameraIndex];
    }

    constructor(
        container: HTMLElement,
        private readonly zone: ZoneState,
        private readonly getTile: (base64: string | undefined) => CanvasRenderingContext2D,
        private readonly connecting: () => boolean,
    ) {
        super();

        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 1.1;

        const isoCamera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.01,
            10,
        );
        isoCamera.position.set(-1 / 8, 4.5 / 8, 4.5 / 8);
        isoCamera.lookAt(0, 0, 0);

        const factor = Math.sqrt(2);

        const flatCamera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2 / factor,
            frustumSize / -2 / factor,
            0.01,
            10,
        );
        flatCamera.position.set(0, 1, 1);
        flatCamera.lookAt(0, 0, 0);

        const cinemaCamera = new THREE.PerspectiveCamera(70, aspect, 0.01, 10);
        cinemaCamera.position.set(0, 0, 0.8);
        cinemaCamera.lookAt(0, 0, 0);

        this.cameras.push(isoCamera);
        this.cameras.push(flatCamera);
        this.cameras.push(cinemaCamera);

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
        this.brickMesh.visible = false;
        this.floorMesh.visible = false;

        this.scene.add(this.blockGroup);
        this.scene.add(this.avatarGroup);
        this.scene.add(this.mediaMesh);

        for (let z = 0; z < 5; ++z) {
            for (let x = 0; x < 16; ++x) {
                zone.grid.set([x-7, -5, z-2], true);
            }
        }
        for (let x = 0; x < 16; ++x) {
            for (let y = 0; y < 10; ++y) {
                zone.grid.set([x-7, y-4, -3], true);
            }
        }
        for (let x = 0; x < 16; ++x) {
            zone.grid.set([x-7, Math.min(-5, 3-x), 3], true);
        }

        zone.grid.set([8, -4, -1], true);
        zone.grid.set([8, -3, -1], true);
        zone.grid.set([7, -3, -1], true);

        zone.grid.forEach((_, [x, y, z]) => {
            const cube = new THREE.Mesh(blockGeo, blockMaterial);
            this.blockGroup.add(cube);
            cube.position.set((x-.5)/16, (y-.5)/16, (z-.5)/16);
            this.meshToCoords.set(cube, [x, y, z]);
        });

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

    cycleCamera() {
        this.cameraIndex = (this.cameraIndex + 1) % this.cameras.length;
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
            const angle = spin ? performance.now() / 100 - x : 0;

            mesh.rotation.y = angle;

            const tile = this.getTile(user.avatar).canvas;
            const material = getTileMaterial(tile);
            material.color.set(`rgb(${r}, ${g}, ${b})`);
            mesh.material = material;

            mesh.position.set((x-.5) / 16 + dx / 512, (y-.5) / 16 + dy / 512, (z-.5) / 16);

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
        const blockIntersects = this.raycaster.intersectObject(this.blockGroup, true);

        if (blockIntersects.length > 0) {
            let [x, y, z] = this.meshToCoords.get(blockIntersects[0].object)!;
            const delta = blockIntersects[0].point.sub(blockIntersects[0].object.position);
            
            if (Math.abs(delta.y) > Math.abs(delta.x) && Math.abs(delta.y) > Math.abs(delta.z)) {
                y += Math.sign(delta.y);
            } else if (Math.abs(delta.x) > Math.abs(delta.y) && Math.abs(delta.x) > Math.abs(delta.z)) {
                x += Math.sign(delta.x);
            } else if (Math.abs(delta.z) > Math.abs(delta.x) && Math.abs(delta.z) > Math.abs(delta.y)) {
                z += Math.sign(delta.z);
            }

            return { x, y, z };
        } else {
            return undefined;
        }
    }
}
