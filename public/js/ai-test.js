import { generateText, getAIStatus, initAI, subscribeAIStatus } from './ai-engine.js';

const loadButton = document.querySelector('#loadModel');
const generateButton = document.querySelector('#generate');
const promptInput = document.querySelector('#prompt');
const response = document.querySelector('#response');
const modelStatus = document.querySelector('#modelStatus');
const deviceStatus = document.querySelector('#deviceStatus');
const loadTime = document.querySelector('#loadTime');
const generationTime = document.querySelector('#generationTime');
const devicePreference = document.querySelector('#devicePreference');

function formatSeconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

subscribeAIStatus(status => {
  modelStatus.textContent = status.status === 'loading' && status.progress?.progress != null
    ? `loading ${Math.round(status.progress.progress)}%`
    : status.status;
  deviceStatus.textContent = status.device || '—';
  devicePreference.disabled = ['loading', 'ready', 'generating'].includes(status.status);
  if (status.loadDurationMs != null) loadTime.textContent = formatSeconds(status.loadDurationMs);
  if (status.error) response.textContent = `Erreur : ${status.error}`;
});

loadButton.addEventListener('click', async () => {
  loadButton.disabled = true;
  generateButton.disabled = true;
  response.textContent = '🤖 Préparation de School Helping AI… Le téléchargement peut prendre un moment.';
  try {
    await initAI({ device: devicePreference.value });
    const status = getAIStatus();
    response.textContent = `✓ School Helping AI est prêt (${status.device?.toUpperCase() || 'runtime inconnu'}).`;
  } catch (error) {
    response.textContent = `Erreur de chargement : ${error.message}`;
  } finally {
    loadButton.disabled = false;
    generateButton.disabled = false;
  }
});

generateButton.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    response.textContent = 'Saisis un prompt avant de lancer la génération.';
    return;
  }
  loadButton.disabled = true;
  generateButton.disabled = true;
  response.textContent = '🤔 School Helping AI réfléchit…';
  const startedAt = performance.now();
  try {
    const text = await generateText(prompt, { maxNewTokens: 120, device: devicePreference.value });
    generationTime.textContent = formatSeconds(performance.now() - startedAt);
    const status = getAIStatus();
    deviceStatus.textContent = status.device || '—';
    if (status.loadDurationMs != null) loadTime.textContent = formatSeconds(status.loadDurationMs);
    response.textContent = text;
  } catch (error) {
    generationTime.textContent = formatSeconds(performance.now() - startedAt);
    response.textContent = `Erreur de génération : ${error.message}`;
  } finally {
    loadButton.disabled = false;
    generateButton.disabled = false;
  }
});
