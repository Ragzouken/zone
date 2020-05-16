import * as THREE from 'three';
import { createContext2D } from 'blitsy';
import { ZoneState } from '../common/zone';
import { hslToRgb } from './utility';
import { randomInt } from '../common/utility';

const avatarQuad = new THREE.PlaneGeometry(1 / 16, 1 / 16, 1, 1);
type AvatarStuff = {
    texture: THREE.CanvasTexture;
    context: CanvasRenderingContext2D;
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh;
};
const avatarStuffs: AvatarStuff[] = [];
function setAvatarCount(count: number) {
    while (avatarStuffs.length < count) {
        const context = createContext2D(8, 8);
        const texture = new THREE.CanvasTexture(context.canvas);

        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(avatarQuad, material);

        avatarStuffs.push({ context, texture, material, mesh });
    }
}

export function init(
    container: HTMLElement,
    video: HTMLVideoElement,
    brick: HTMLCanvasElement,
    floor: HTMLCanvasElement,
    logo: HTMLImageElement,
    zone: ZoneState,
    getTile: (base64: string | undefined) => CanvasRenderingContext2D,
    connecting: () => boolean,
    showLogo: () => boolean,
) {
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 1;
    const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.01,
        10,
    );
    // const camera = new THREE.PerspectiveCamera(70, aspect, 0.01, 10);
    camera.position.set(-1 / 8, 4.5 / 8, 4.5 / 8);
    camera.lookAt(0, 0, 0);
    (window as any).camera = camera;

    const brickTexture = new THREE.CanvasTexture(brick);
    const floorTexture = new THREE.CanvasTexture(floor);
    const videoTexture = new THREE.VideoTexture(video);
    const logoTexture = new THREE.CanvasTexture(logo);

    [brickTexture, floorTexture, videoTexture, logoTexture].forEach((texture) => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    });

    videoTexture.wrapS = THREE.ClampToEdgeWrapping;
    videoTexture.wrapT = THREE.ClampToEdgeWrapping;
    videoTexture.format = THREE.RGBFormat;
    brickTexture.repeat.set(16, 10);
    floorTexture.repeat.set(16, 6);

    const scene = new THREE.Scene();

    const videoMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const brickMaterial = new THREE.MeshBasicMaterial({ map: brickTexture, side: THREE.DoubleSide });
    const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide });
    const logoMaterial = new THREE.MeshBasicMaterial({
        map: logoTexture,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });

    const vWidth = video.width / 512;
    const vHeight = video.height / 512;

    const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(vWidth, vHeight, 1, 1), logoMaterial);
    const videoMesh = new THREE.Mesh(new THREE.PlaneGeometry(vWidth, vHeight, 1, 1), videoMaterial);
    const brickMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 10 / 16, 1, 1), brickMaterial);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 6 / 16, 1, 1), floorMaterial);

    floorMesh.rotateX(Math.PI / 2);

    videoMesh.translateZ(-3 / 16 + 1 / 512);
    logoMesh.translateZ(-3 / 16 + 1 / 512);

    brickMesh.translateZ(-3 / 16);
    floorMesh.translateZ(5 / 16);

    const avatarGroup = new THREE.Group();

    scene.add(brickMesh);
    scene.add(floorMesh);
    scene.add(avatarGroup);
    scene.add(videoMesh);
    scene.add(logoMesh);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const black = new THREE.Color(0, 0, 0);
    const red = new THREE.Color(255, 0, 0);

    function update() {
        renderer.setClearColor(connecting() ? red : black);

        videoMesh.visible = !showLogo();
        logoMesh.visible = showLogo();

        setAvatarCount(zone.users.size);
        avatarGroup.children = [];

        let i = 0;
        zone.users.forEach((user) => {
            if (!user.position) return;
            let y = -4.5;
            let [x, z] = user.position;
            const stuff = avatarStuffs[i++];

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
            }

            const spin = (user.emotes && user.emotes.includes('spn'));
            const angle = spin ? (performance.now() / 100 - x) : 0;

            stuff.mesh.rotation.y = angle;

            r = Math.round(r);
            g = Math.round(g);
            b = Math.round(b);

            stuff.context.clearRect(0, 0, 8, 8);
            stuff.context.drawImage(getTile(user.avatar).canvas, 0, 0);
            stuff.texture.needsUpdate = true;

            stuff.mesh.position.set(x / 16 + dx / 512, y / 16 + dy / 512, z / 16);
            stuff.material.color.set(`rgb(${r}, ${g}, ${b})`);
            avatarGroup.add(stuff.mesh);
        });
    }

    return function animate() {
        requestAnimationFrame(animate);
        update();
        renderer.render(scene, camera);
    };
}
