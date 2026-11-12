import { completeGoalTaskForUser, deleteCurrentGoal, getCurrentGoal, initializeGoalProgress, saveCurrentGoal } from '../services/firestore.service.js';
import { AppError, badRequest } from '../utils/errors.js';
import { validateGoal } from '../utils/validation.js';

function aiUnavailable() {
  throw new AppError(503, 'Le moteur IA est temporairement indisponible. La prochaine étape configurera le nouveau moteur.', 'AI_ENGINE_UNAVAILABLE');
}

export async function generateGoal(req, res) {
  validateGoal(req.body.goal || req.body);
  aiUnavailable();
}

export async function getGoal(req, res) {
  const goal = await initializeGoalProgress(req.user.uid);
  res.json({ success: true, goal });
}

export async function deleteGoal(req, res) {
  await deleteCurrentGoal(req.user.uid);
  res.json({ success: true });
}

export async function updateGoal(req, res) {
  const goal = validateGoal(req.body.goal || req.body);
  const saved = await saveCurrentGoal(req.user.uid, goal);
  res.json({ success: true, goal: saved });
}

export async function goalChat(req, res) {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 4000) throw badRequest('Écris un message de 1 à 4 000 caractères.');
  const goal = await getCurrentGoal(req.user.uid);
  if (!goal) throw badRequest('Crée un objectif avant de discuter avec Goal AI.');
  aiUnavailable();
}

export async function completeTask(req, res) {
  if (typeof req.params.taskId !== 'string' || req.params.taskId.length > 128) throw badRequest('Identifiant de tâche invalide.');
  const progress = await completeGoalTaskForUser(req.user.uid, req.params.taskId);
  res.json({ success: true, progress });
}
