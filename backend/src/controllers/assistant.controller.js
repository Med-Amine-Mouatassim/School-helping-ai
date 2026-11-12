import { buildAssistantContext } from '../services/context.service.js';
import { saveAssistantExchange } from '../services/firestore.service.js';
import { AppError, badRequest } from '../utils/errors.js';
import { requireId, validateChat, validateDocumentRequest } from '../utils/validation.js';

function unavailable() {
  throw new AppError(503, 'Le moteur IA est temporairement indisponible. La prochaine étape configurera le nouveau moteur.', 'AI_ENGINE_UNAVAILABLE');
}

export async function chat(req, res) {
  validateChat(req.body);
  unavailable();
}

export async function prepareContext(req, res) {
  const input = validateChat(req.body);
  const context = await buildAssistantContext({ uid: req.user.uid, ...input });
  if (context.image) {
    throw new AppError(415, 'L’analyse d’image nécessite encore un moteur OCR ou vision. Tu peux toujours téléverser et conserver cette image.', 'LOCAL_VISION_UNSUPPORTED');
  }
  res.json({
    success: true,
    systemPrompt: context.systemPrompt,
    prompt: context.prompt,
    estimatedInputTokens: context.estimatedInputTokens
  });
}

export async function saveChatHistory(req, res) {
  const input = validateChat(req.body);
  const conversationId = requireId(input.conversationId, 'Conversation');
  const response = typeof req.body.response === 'string' ? req.body.response.trim() : '';
  if (!response || response.length > 20000) throw badRequest('La réponse à enregistrer est vide ou trop longue.');

  const saved = await saveAssistantExchange(req.user.uid, {
    conversationId,
    userMessage: input.message,
    mode: input.mode,
    attachments: input.attachments,
    response
  });
  res.json({ success: true, conversationId, message: { role: 'assistant', content: response, timestamp: saved.timestamp } });
}

export async function analyzeDocumentRequest(req, res) {
  validateDocumentRequest(req.body);
  unavailable();
}
