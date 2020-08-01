import THREE = require('three');
import { BlockShape } from './block-shape';

export class BlockGeometry {
    public shape = new BlockShape();
    public readonly faces = new Map<string, number>();

    public texcoordBuffer = new THREE.Float32BufferAttribute([], 2);
    public geometry = new THREE.BufferGeometry();

    public setShape(shape: BlockShape): void {
        this.shape = shape;
        this.texcoordBuffer = new THREE.Float32BufferAttribute(this.shape.texcoords, 2);

        this.geometry.setAttribute('position', this.shape.positionBuffer);
        this.geometry.setAttribute('normal', this.shape.normalBuffer);
        this.geometry.setAttribute('uv', this.texcoordBuffer);
        this.geometry.setIndex(this.shape.indices);
    }

    // TODO: flips and rotation
    public setFaceTile(faceID: string, xmin: number, ymin: number, xmax: number, ymax: number): void {
        const face = this.shape.faces.get(faceID);
        const tilecoords = this.shape.texcoords;
        const texcoords = this.texcoordBuffer;

        if (!face) throw new Error(`No face "${faceID}"`);

        for (const index of face) {
            const lx = tilecoords[index * 2 + 0];
            const ly = tilecoords[index * 2 + 1];

            texcoords.setXY(index, xmin * lx + xmax * (1 - lx), ymin * ly + ymax * (1 - ly));
        }

        texcoords.needsUpdate = true;
    }
}
