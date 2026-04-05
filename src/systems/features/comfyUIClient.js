/**
 * ComfyUI Direct API Client for Sprite Generation
 *
 * Loads the "Sprite generator V1.2" workflow in pre-converted ComfyUI API
 * format, injects the character description into node 487, optionally appends
 * background-removal nodes (AutoRemoveBackground → MaskBlur+ → SaveImageWithAlpha)
 * in place of the final SaveImage node, then submits via ST's backend proxy.
 *
 * Background removal is done in-workflow (not a separate call) to avoid any
 * browser → ComfyUI CORS issues.
 */

import { getRequestHeaders } from '../../../../../../../script.js';
import { extensionSettings } from '../../core/state.js';

// Node IDs in the sprite generator workflow (API format)
const CHARACTER_DESCRIPTION_NODE_ID = '487'; // PrimitiveStringMultiline – char description
const NEGATIVE_PROMPT_NODE_ID = '87';         // CLIPTextEncode – negative prompt (not linked)
const FINAL_IMAGE_NODE_ID = '784';            // HandDetailer – last image-producing node
const SAVE_IMAGE_NODE_ID = '718';             // SaveImage – replaced when bg removal is on

// IDs for the injected background-removal nodes (well above existing range)
const BG_REMOVE_NODE_ID   = '2001'; // AutoRemoveBackground
const BG_BLUR_NODE_ID     = '2002'; // MaskBlur+
const BG_SAVE_NODE_ID     = '2003'; // SaveImageWithAlpha

// Pre-converted API-format workflow (no /object_info call needed)
const API_WORKFLOW_URL = '/scripts/extensions/third-party/rpg-companion-sillytavern/workflows/sprite_generator_v1.2_api.json';
const BG_WORKFLOW_URL  = '/scripts/extensions/third-party/rpg-companion-sillytavern/workflows/background_generator_v1.0_api.json';

// In-memory cache (lives for the browser session)
let cachedAPIWorkflow = null;
let cachedBGWorkflow = null;

async function fetchAPIWorkflow() {
    if (cachedAPIWorkflow) return cachedAPIWorkflow;
    const resp = await fetch(API_WORKFLOW_URL);
    if (!resp.ok) throw new Error(`Failed to load sprite generator API workflow (${resp.status})`);
    cachedAPIWorkflow = await resp.json();
    return cachedAPIWorkflow;
}

async function fetchBGWorkflow() {
    if (cachedBGWorkflow) return cachedBGWorkflow;
    const resp = await fetch(BG_WORKFLOW_URL);
    if (!resp.ok) throw new Error(`Failed to load background generator API workflow (${resp.status})`);
    cachedBGWorkflow = await resp.json();
    return cachedBGWorkflow;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a sprite image using the ComfyUI Sprite Generator V1.2 workflow.
 *
 * When removeSpriteBg is enabled (default), the background-removal chain is
 * injected directly into the workflow before submission:
 *
 *   784 (HandDetailer) ──image──► 2001 (AutoRemoveBackground) ──mask──► 2002 (MaskBlur+)
 *   784 (HandDetailer) ──image──┐                                              │mask
 *                               └──────────────────────────────────────────► 2003 (SaveImageWithAlpha)
 *
 * AutoRemoveBackground corner-samples the generated image to find the background
 * colour automatically (no fixed RGB target needed).
 * SaveImageWithAlpha (kjnodes) applies `alpha = 1.0 - mask`, so background
 * pixels become transparent and the subject remains opaque.
 *
 * @param {string} characterDescription  Positive prompt (character description).
 * @param {string|null} negativeOverride  Optional override for the negative prompt.
 * @returns {Promise<{format: string, data: string}>} Base64 image result.
 */
export async function generateSpriteWithComfyUI(characterDescription, negativeOverride = null) {
    const comfyUrl = (extensionSettings.comfyUIUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');

    // Load pre-converted API workflow (cached after first call)
    const basePrompt = await fetchAPIWorkflow();

    // Deep-clone so the cached version is never mutated
    const apiPrompt = JSON.parse(JSON.stringify(basePrompt));

    // Inject character description into node 487 (PrimitiveStringMultiline "Char prompt")
    if (apiPrompt[CHARACTER_DESCRIPTION_NODE_ID]?.inputs) {
        apiPrompt[CHARACTER_DESCRIPTION_NODE_ID].inputs.value = characterDescription;
    } else {
        console.warn('[RPG ComfyUI] Could not find character description node (487) in API workflow.');
    }

    // Optionally override negative prompt in node 87 (CLIPTextEncode, text not linked)
    if (negativeOverride != null && apiPrompt[NEGATIVE_PROMPT_NODE_ID]?.inputs) {
        apiPrompt[NEGATIVE_PROMPT_NODE_ID].inputs.text = negativeOverride;
    }

    // Use !== false so that undefined (key absent from old saved settings) also enables removal
    if (extensionSettings.removeSpriteBg !== false) {
        // Remove the plain SaveImage node so only SaveImageWithAlpha appears as output
        delete apiPrompt[SAVE_IMAGE_NODE_ID];

        // Inject background-removal chain after the final detailer (node 784)
        apiPrompt[BG_REMOVE_NODE_ID] = {
            class_type: 'AutoRemoveBackground',
            inputs: {
                image: [FINAL_IMAGE_NODE_ID, 0],
                threshold: 30,
                corner_size: 15,
            },
        };
        apiPrompt[BG_BLUR_NODE_ID] = {
            class_type: 'MaskBlur+',
            inputs: {
                mask: [BG_REMOVE_NODE_ID, 0],
                amount: 3,
                device: 'auto',
            },
        };
        apiPrompt[BG_SAVE_NODE_ID] = {
            class_type: 'SaveImageWithAlpha',
            inputs: {
                images: [FINAL_IMAGE_NODE_ID, 0],
                mask:   [BG_BLUR_NODE_ID, 0],
                filename_prefix: 'bg_removed',
            },
        };

        console.log('[RPG ComfyUI] Background removal nodes injected into workflow.');
    }

    // Submit via ST's ComfyUI backend proxy (handles polling + image fetch, no CORS)
    const response = await fetch('/api/sd/comfy/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            url: comfyUrl,
            prompt: JSON.stringify({ prompt: apiPrompt }),
        }),
    });

    if (!response.ok) {
        throw new Error(`ComfyUI generation failed: ${await response.text()}`);
    }

    const result = await response.json(); // { format: 'png', data: '<base64>' }
    console.log('[RPG ComfyUI] Generation complete. format:', result.format);
    return result;
}

/**
 * Saves a base64-encoded image to SillyTavern's user images directory.
 *
 * @param {string} base64Data  Base64 image data (no data-URI prefix).
 * @param {string} format      Image format ('png', 'jpg', …).
 * @param {string} characterName  Used as the subfolder name.
 * @param {string} filename    Filename (without extension).
 * @returns {Promise<string>}  ST-accessible path, e.g. '/user/images/CharName/avatar_123.png'.
 */
export async function saveImageToST(base64Data, format, characterName, filename) {
    const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            image: base64Data,
            format: format || 'png',
            ch_name: characterName,
            filename,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to save image to ST: ${await response.text()}`);
    }

    const result = await response.json();
    return result.path;
}

/**
 * Generates a background/scene image using the dedicated background generator workflow.
 *
 * Workflow nodes (background_generator_v1.0_api.json):
 *   "1"  CheckpointLoaderSimple — checkpoint injected from extensionSettings.backgroundCheckpoint
 *   "2"  EmptyLatentImage       — 896×512 landscape resolution
 *   "3"  CLIPTextEncode         — positive prompt (injected)
 *   "4"  CLIPTextEncode         — static negative prompt
 *   "5"  KSampler
 *   "6"  VAEDecode
 *   "7"  SaveImage
 *
 * @param {string} scenePrompt  Positive SD prompt describing the scene/environment.
 * @returns {Promise<{format: string, data: string}>} Base64 image result.
 */
export async function generateBackgroundWithComfyUI(scenePrompt) {
    const comfyUrl = (extensionSettings.comfyUIUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
    const checkpoint = (extensionSettings.backgroundCheckpoint || '').trim();

    if (!checkpoint) {
        throw new Error('Background checkpoint not configured. Set it in RPG Companion settings → Background Checkpoint.');
    }

    const baseWorkflow = await fetchBGWorkflow();
    const apiPrompt = JSON.parse(JSON.stringify(baseWorkflow)); // deep-clone, never mutate cache

    // Inject checkpoint
    apiPrompt['1'].inputs.ckpt_name = checkpoint;

    // Inject positive prompt
    apiPrompt['3'].inputs.text = scenePrompt;

    // Randomize seed
    apiPrompt['5'].inputs.seed = Math.floor(Math.random() * 2 ** 32);

    const response = await fetch('/api/sd/comfy/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            url: comfyUrl,
            prompt: JSON.stringify({ prompt: apiPrompt }),
        }),
    });

    if (!response.ok) {
        throw new Error(`ComfyUI background generation failed: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('[RPG ComfyUI] Background generation complete. format:', result.format);
    return result;
}
