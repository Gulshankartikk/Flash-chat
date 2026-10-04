const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const config = require('./env');
const logger = require('../utils/logger');

let genAI = null;
let isAiConfigured = false;

if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.trim().length > 0) {
  try {
    genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY.trim());
    isAiConfigured = true;
    logger.info({ model: config.GEMINI_MODEL }, 'Google Gemini AI initialized successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to initialize Google Gemini AI client');
    isAiConfigured = false;
  }
} else {
  logger.warn('GEMINI_API_KEY is not configured. AI services are running in mock fallback mode.');
}

/**
 * Standard safety settings for responsible AI output
 */
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
  }
];

/**
 * Get Gemini GenerativeModel instance
 * @param {Object} options
 * @param {'flash'|'pro'} [options.modelType='flash']
 * @param {string} [options.systemInstruction]
 * @param {Object} [options.generationConfig]
 */
const getGeminiModel = ({ modelType = 'flash', systemInstruction, generationConfig } = {}) => {
  if (!isAiConfigured || !genAI) {
    return null;
  }

  const modelName = modelType === 'pro' && config.GEMINI_MODEL_PRO ? config.GEMINI_MODEL_PRO : config.GEMINI_MODEL;

  const modelOptions = {
    model: modelName,
    safetySettings,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      ...generationConfig
    }
  };

  if (systemInstruction) {
    modelOptions.systemInstruction = systemInstruction;
  }

  return genAI.getGenerativeModel(modelOptions);
};

module.exports = {
  isConfigured: () => isAiConfigured,
  isMockMode: () => !isAiConfigured,
  getGeminiModel,
  safetySettings,
  config
};
