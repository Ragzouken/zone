import Joi = require('@hapi/joi');

export const MESSAGE_SCHEMAS = new Map<string, Joi.ObjectSchema>();

MESSAGE_SCHEMAS.set(
    'avatar',
    Joi.object({
        data: Joi.string().base64().required(),
    }),
);

MESSAGE_SCHEMAS.set(
    'name',
    Joi.object({
        name: Joi.string().required(),
    }),
);

MESSAGE_SCHEMAS.set(
    'move',
    Joi.object({
        position: Joi.array().ordered(Joi.number().required(), Joi.number().required()),
    }),
);

MESSAGE_SCHEMAS.set(
    'emotes',
    Joi.object({
        emotes: Joi.array().items(Joi.string().valid('shk', 'wvy', 'rbw')),
    }),
);
