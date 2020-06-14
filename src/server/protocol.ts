import Joi = require('@hapi/joi');

export const MESSAGE_SCHEMAS = new Map<string, Joi.ObjectSchema>();

MESSAGE_SCHEMAS.set(
    'user',
    Joi.object({
        name: Joi.string(),
        avatar: Joi.string().base64(),
        emotes: Joi.array().items(Joi.string().valid('shk', 'wvy', 'rbw', 'spn')),
        position: Joi.array().ordered(Joi.number().required(), Joi.number().required(), Joi.number().required()),
    }),
);
