import { BlockShapeData } from './blocks/block-shape';

export const cubeData: BlockShapeData = {
    faces: {
        'top': {
            positions: [
                [0, 1, 1],
                [1, 1, 1],
                [1, 1, 0],
                [0, 1, 0],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        'front': {
            positions: [
                [0, 1, 1],
                [0, 0, 1],
                [1, 0, 1],
                [1, 1, 1],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        'back': {
            positions: [
                [1, 0, 0],
                [0, 0, 0],
                [0, 1, 0],
                [1, 1, 0],
            ],
            texturing: [
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        'left': {
            positions: [
                [1, 1, 1],
                [1, 0, 1],
                [1, 0, 0],
                [1, 1, 0],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        'right': {
            positions: [
                [0, 1, 0],
                [0, 0, 0],
                [0, 0, 1],
                [0, 1, 1],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },

        'bottom': {
            positions: [
                [0, 0, 1],
                [0, 0, 0],
                [1, 0, 0],
                [1, 0, 1],
            ],
            texturing: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
            triangles: [
                [0, 1, 2],
                [0, 2, 3],
            ],
        },
    },
};
