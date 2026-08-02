import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),

  // Base de datos
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),

  // Stockfish (usado a partir del paso 2)
  STOCKFISH_URL: Joi.string().uri().default('http://localhost:8080'),
  STOCKFISH_TIMEOUT_EVAL_MS: Joi.number().default(200),
  STOCKFISH_TIMEOUT_CANDIDATES_MS: Joi.number().default(2000),
  STOCKFISH_TIMEOUT_PREDICTION_MS: Joi.number().default(1000),

  // LLM. LLM_PROVIDER selecciona qué LlmClient se inyecta (ver llm.module.ts);
  // hoy solo 'openai' está implementado, pero el switch ya está pensado para
  // sumar más proveedores sin tocar el resto del sistema.
  LLM_PROVIDER: Joi.string().valid('openai').default('openai'),
  LLM_API_KEY: Joi.string().required(),
  LLM_MODEL: Joi.string().required(),
  LLM_TIMEOUT_MS: Joi.number().default(8000),
  LLM_MAX_TOKENS: Joi.number().default(1000),
});
