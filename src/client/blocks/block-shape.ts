import THREE = require('three');

export interface BlockShapeFaceData {
    positions: number[][];
    texturing: number[][];
    triangles: number[][];
}

export interface BlockShapeData {
    faces: {
        [name: string]: BlockShapeFaceData;
    };
}

export class BlockShape {
    public indices: number[] = [];
    public positions: number[] = [];
    public texcoords: number[] = [];
    public normals: number[] = [];

    // mapping of face id to list of distinct indices used
    public faces = new Map<string, number[]>();

    // mapping of triangle number to face id
    public tri2face: string[] = [];

    // shareable position attributes
    public positionBuffer = new THREE.Float32BufferAttribute([], 3);
    public normalBuffer = new THREE.Float32BufferAttribute([], 3);

    public get vertexCount(): number {
        return this.positions.length / 3;
    }

    public fromData(data: BlockShapeData): this {
        Object.entries(data.faces).forEach(([faceId, face], faceIndex) => {
            // offset indices relative to existing vertices
            const indexOffset = this.vertexCount;
            const faceIndexes = face.triangles
                .reduce<number[]>((a, b) => [...a, ...b], [])
                .map((index) => index + indexOffset);

            this.indices.push(...faceIndexes);
            this.faces.set(faceId, faceIndexes);

            face.triangles.forEach((_) => this.tri2face.push(faceId));

            // compute shared normal and add all positions/texcoords/normals
            const positions = face.positions.slice(0, 3).map((position) => new THREE.Vector3(...position));

            const normal = new THREE.Vector3();
            normal.crossVectors(positions[1].clone().sub(positions[0]), positions[2].clone().sub(positions[0]));

            for (let i = 0; i < face.positions.length; ++i) {
                this.positions.push(...face.positions[i]);
                this.texcoords.push(...face.texturing[i]);
                this.normals.push(normal.x, normal.y, normal.z);
            }
        });

        // threejs stuff
        this.positionBuffer = new THREE.Float32BufferAttribute(this.positions, 3);
        this.normalBuffer = new THREE.Float32BufferAttribute(this.normals, 3);

        return this;
    }

    public toData(): BlockShapeData {
        const data: BlockShapeData = {
            faces: {},
        };

        this.faces.forEach((indexes, name) => {
            const min = Math.min(...indexes);
            const max = Math.max(...indexes);
            const count = max - min + 1;
            indexes = indexes.map((index) => index - min);

            const face: BlockShapeFaceData = {
                positions: [],
                texturing: [],
                triangles: [],
            };

            for (let i = 0; i < count; ++i) {
                const j = i + min;
                face.positions.push(this.positions.slice(j * 3, j * 3 + 3));
                face.texturing.push(this.texcoords.slice(j * 2, j * 2 + 2));
            }

            for (let i = 0; i < indexes.length; i += 3) {
                face.triangles.push(indexes.slice(i, i + 3));
            }

            data.faces[name] = face;
        });

        return data;
    }
}
