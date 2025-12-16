/**
 * Prompt Manager Module
 * Handles LLM prompt injection for texting mode
 */

import { getContext, extension_settings } from "../../../../../extensions.js";
import { buildContextBridgePrompt, summarizeTextingConversation, injectTextingSummaryIntoChat } from "./context-bridge.js";

const extensionName = "st-text-messaging";

// Texting style prompt templates
const TEXTING_PROMPTS = {
  low: `Respond in a casual, conversational texting style. Use occasional emojis and common shorthand.`,

  medium: `📱 TEXT MESSAGE MODE
Reply as if texting on your phone:
- Use emojis to convey emotion 😊💕😂
- Common shorthand: lol, omg, btw, brb, nvm
- Keep it casual and punchy
- Natural text reactions`,

  high: `⚡ TEXTING MODE ACTIVATED ⚡
You're texting via smartphone. Respond authentically like a real person texting:

✅ USE THESE:
• Emojis frequently: 😊😂😭🔥💕✨🥺👀💀
• Shorthand: omg, lol, btw, nvm, fr, frfr, deadass, ngl, tbh
• Lowercase letters, relaxed punctuation
• Multiple short messages instead of long paragraphs
• Natural reactions: "haha", "omg wait", "no wayyyy", "stoppp"
• Pauses: "...", "wait", "hold on", "ok so"
• Emphasis: "soooo", "reallyyy", "!!!!!"

✅ TEXT LIKE THIS:
"omg wait are you serious?? 😱"
"lol yeah i totally get that"
"brb gonna grab some food"
"no wayyy that's crazy 💀"
"aww that's so sweet 🥺💕"

Be genuine and conversational! 📱✨`
};

/**
 * Activates texting mode when phone UI opens
 * Injects perspective shift + context from recent chat
 */
export function activateTextingMode() {
  const context = getContext();
  const textingEnabled = extension_settings[extensionName]?.useTextingStyle ?? false;

  if (!textingEnabled) {
    console.log('[st-text-messaging] Texting mode activation skipped (texting style disabled)');
    return;
  }

  // Build combined prompt: perspective shift + context + texting style
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
  const perspectivePrompt = TEXTING_PROMPTS[intensity];
  const contextBridge = buildContextBridgePrompt();
  const fullPrompt = `${perspectivePrompt}\n\n${contextBridge}`;

  // Inject at position 1 (high priority)
  context.setExtensionPrompt(extensionName, fullPrompt, 1, 0);

  console.log('[st-text-messaging] Texting mode activated with context');
  toastr.info('Texting mode active 📱');
}

/**
 * Deactivates texting mode when phone UI closes
 * Optionally injects summary back into chat
 * @param {Array} phoneMessages - Messages from phone conversation (optional)
 */
export async function deactivateTextingMode(phoneMessages = []) {
  const context = getContext();

  // Inject texting summary into chat if we have messages
  if (phoneMessages && phoneMessages.length > 0) {
    const summary = summarizeTextingConversation(phoneMessages);
    await injectTextingSummaryIntoChat(summary, false); // hidden by default
  }

  // Option 1: Brief transition prompt, then remove
  const transitionPrompt = `The text conversation has ended. Return to narrative perspective and third-person storytelling. Reference the texting conversation naturally in your narration if relevant.`;
  context.setExtensionPrompt(extensionName, transitionPrompt, 1, 0);

  // Clear transition prompt after a short delay
  setTimeout(() => {
    context.setExtensionPrompt(extensionName, '', 0, 0);
  }, 2000);

  console.log('[st-text-messaging] Texting mode deactivated');
  toastr.info('Texting mode ended');
}

/**
 * Updates the LLM prompt based on current settings (for global toggle)
 */
export function updateTextingPrompt() {
  const context = getContext();

  // Check if texting style should be active
  const phoneEnabled = extension_settings[extensionName]?.enabled ?? false;
  const textingEnabled = extension_settings[extensionName]?.useTextingStyle ?? false;

  if (!phoneEnabled || !textingEnabled) {
    // Remove prompt injection when disabled
    context.setExtensionPrompt(extensionName, '', 0, 0);
    console.log('[st-text-messaging] Texting style prompt removed');
    return;
  }

  // Get intensity level
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
  const prompt = TEXTING_PROMPTS[intensity];

  // Inject prompt into LLM payload
  // Parameters: (extensionName, promptText, position, depth)
  context.setExtensionPrompt(extensionName, prompt, 1, 0);

  console.log(`[st-text-messaging] Texting style prompt injected (${intensity} intensity)`);
}
