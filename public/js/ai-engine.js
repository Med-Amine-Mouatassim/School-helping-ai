import { pipeline } from '@huggingface/transformers';

export const AI_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const DEFAULT_MAX_NEW_TOKENS = 120;
const DEFAULT_MAX_INPUT_CHARS = 4800;

let generator = null;
let generatorPromise = null;
let generationQueue = Promise.resolve();
let state = {
  status: 'idle',
  device: null,
  progress: null,
  error: null,
  loadDurationMs: null
};
const listeners = new Set();

function publish(next) {
  state = { ...state, ...next };
  for (const listener of listeners) {
    try { listener({ ...state }); }
    catch (error) { console.error('[ai-engine] status listener failed:', error); }
  }
}

export function getAIStatus() {
  return { ...state };
}

export function subscribeAIStatus(listener) {
  if (typeof listener !== 'function') throw new TypeError('Le listener doit être une fonction.');
  listeners.add(listener);
  listener(getAIStatus());
  return () => listeners.delete(listener);
}

async function webGPUAvailable() {
  if (typeof navigator === 'undefined' || !navigator.gpu?.requestAdapter) return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); }
  catch { return false; }
}

async function createGenerator(devicePreference = 'auto') {
  const preferredDevice = devicePreference === 'wasm'
    ? 'wasm'
    : await webGPUAvailable() ? 'webgpu' : 'wasm';
  const devices = preferredDevice === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  let webgpuError = null;

  for (const device of devices) {
    publish({ status: 'loading', device, progress: null, error: null });
    try {
      const instance = await pipeline('text-generation', AI_MODEL_ID, {
        device,
        // Avoid the large fp32 WebGPU default; these quantizations are present
        // in this model's ONNX repository and fit browser memory better.
        dtype: device === 'webgpu' ? 'q4' : 'q8',
        progress_callback: progress => publish({ status: 'loading', device, progress })
      });
      publish({ status: 'ready', device, progress: null, error: null });
      return instance;
    } catch (error) {
      if (device === 'webgpu') {
        webgpuError = error;
        console.warn('[ai-engine] WebGPU initialization failed; falling back to WASM.', error);
        continue;
      }
      if (webgpuError && error instanceof Error && !error.cause) error.cause = webgpuError;
      throw error;
    }
  }

  throw webgpuError || new Error('Aucun runtime IA compatible n’a pu être initialisé.');
}

export function initAI({ device = 'auto' } = {}) {
  if (!['auto', 'webgpu', 'wasm'].includes(device)) {
    return Promise.reject(new TypeError('Le runtime demandé doit être auto, webgpu ou wasm.'));
  }
  if (generator) return Promise.resolve({ model: AI_MODEL_ID, device: state.device });
  if (!generatorPromise) {
    const startedAt = performance.now();
    publish({ status: 'loading', error: null, progress: null });
    generatorPromise = createGenerator(device)
      .then(instance => {
        generator = instance;
        publish({ status: 'ready', loadDurationMs: performance.now() - startedAt });
        return { model: AI_MODEL_ID, device: state.device };
      })
      .catch(error => {
        generatorPromise = null;
        publish({ status: 'error', error: error?.message || 'Échec du chargement du modèle.', progress: null });
        throw error;
      });
  }
  return generatorPromise;
}

async function runGeneration(prompt, options) {
  const { maxNewTokens, max_new_tokens, maxInputChars, max_input_chars, systemPrompt, device, ...generationOptions } = options;
  const outputLimit = Math.max(1, Math.min(512, Number(maxNewTokens ?? max_new_tokens) || DEFAULT_MAX_NEW_TOKENS));
  const inputLimit = Math.max(500, Math.min(16000, Number(maxInputChars ?? max_input_chars) || DEFAULT_MAX_INPUT_CHARS));
  const marker = '\n\n[Contexte intermédiaire abrégé]\n\n';
  const trimWithEnds = (value, limit) => {
    if (value.length <= limit) return value;
    const available = Math.max(0, limit - marker.length);
    const headLength = Math.ceil(available / 2);
    const tailLength = available - headLength;
    return value.slice(0, headLength) + marker + value.slice(-tailLength);
  };
  const boundedSystemPrompt = trimWithEnds(String(systemPrompt || ''), Math.floor(inputLimit * 0.3));
  const boundedPrompt = trimWithEnds(prompt, Math.max(100, inputLimit - boundedSystemPrompt.length));
  const messages = [
    ...(boundedSystemPrompt ? [{ role: 'system', content: boundedSystemPrompt }] : []),
    { role: 'user', content: boundedPrompt }
  ];

  try {
    await initAI({ device: device || 'auto' });
    publish({ status: 'generating', error: null });
    const generationConfig = {
      ...generationOptions,
      // Greedy decoding is cheaper and more consistent for short study help.
      do_sample: generationOptions.do_sample ?? false,
      max_new_tokens: outputLimit,
    };
    let result;
    try {
      result = await generator(messages, generationConfig);
    } catch (webgpuError) {
      if (state.device !== 'webgpu') throw webgpuError;
      console.warn('[ai-engine] WebGPU generation failed; retrying once with WASM.', webgpuError);
      try { await generator?.dispose?.(); } catch { /* Some pipeline versions do not expose dispose(). */ }
      generator = null;
      generatorPromise = null;
      await initAI({ device: 'wasm' });
      try {
        result = await generator(messages, generationConfig);
      } catch (wasmError) {
        if (wasmError instanceof Error && !wasmError.cause) wasmError.cause = webgpuError;
        throw wasmError;
      }
    }
    const generated = result?.[0]?.generated_text;
    const text = typeof generated === 'string'
      ? generated
      : Array.isArray(generated)
        ? generated.filter(message => message?.role === 'assistant').at(-1)?.content
        : null;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Le modèle n’a retourné aucune réponse.');
    publish({ status: 'ready', error: null });
    return text.trim();
  } catch (error) {
    publish({ status: 'error', error: error?.message || 'La génération a échoué.' });
    throw error;
  }
}

export function generateText(prompt, options = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) return Promise.reject(new TypeError('Le prompt ne peut pas être vide.'));
  const run = generationQueue.then(() => runGeneration(prompt.trim(), options));
  generationQueue = run.catch(() => undefined);
  return run;
}
