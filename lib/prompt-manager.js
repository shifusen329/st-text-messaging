/**
 * Prompt Manager Module
 * Handles LLM prompt injection for texting mode
 */

import { getContext, extension_settings } from "../../../../extensions.js";
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
 * Gets the default prompt for a given intensity level
 * @param {string} intensity - 'low', 'medium', or 'high'
 * @returns {string} The default prompt text
 */
export function getDefaultPrompt(intensity = 'medium') {
  return TEXTING_PROMPTS[intensity] || TEXTING_PROMPTS.medium;
}

/**
 * Gets the current effective prompt (custom or default based on settings)
 * @returns {string} The prompt to use
 */
function getCurrentPrompt() {
  const useCustom = extension_settings[extensionName]?.useCustomPrompt ?? false;
  const customPrompt = extension_settings[extensionName]?.customPrompt;

  if (useCustom && customPrompt) {
    return customPrompt;
  }

  const intensity = extension_settings[extensionName]?.emojiIntensity || 'medium';
  return TEXTING_PROMPTS[intensity];
}

/**
 * Checks if currently in a group chat
 * @returns {boolean}
 */
function isInGroupChat() {
  const context = getContext();
  return !!context.groupId;
}

/**
 * Gets group members from context
 * @returns {Array} Array of character objects in the group
 */
function getGroupMembers() {
  const context = getContext();
  if (!context.groupId) return [];

  const groups = context.groups || [];
  const group = groups.find(g => g.id === context.groupId);

  if (!group || !group.members) return [];

  return group.members
    .map(memberId => {
      return context.characters.find(c =>
        c.avatar === memberId ||
        c.name === memberId ||
        String(context.characters.indexOf(c)) === String(memberId)
      );
    })
    .filter(Boolean);
}

/**
 * Activates texting mode when phone UI opens
 * Injects perspective shift + context from recent chat
 */
export function activateTextingMode() {
  const context = getContext();
  const settings = extension_settings[extensionName] || {};
  const textingEnabled = settings.useTextingStyle ?? false;
  const inGroup = isInGroupChat();
  const groupInheritStyle = settings.groupInheritTextingStyle ?? true;

  // For groups, check if we should inherit texting style
  // If not in a group, or group inherits style, check if texting is enabled
  if (!textingEnabled) {
    console.log('[st-text-messaging] Texting mode activation skipped (texting style disabled)');
    return;
  }

  // If in group and not inheriting style, skip texting prompt injection
  if (inGroup && !groupInheritStyle) {
    console.log('[st-text-messaging] Group texting mode skipped (inherit style disabled)');
    // Still add group context but without texting style
    const contextBridge = buildContextBridgePrompt();
    const members = getGroupMembers();
    const memberNames = members.map(m => m.name).join(', ');
    const groupOnlyContext = `GROUP TEXT MODE: This is a group text conversation. Participants: ${memberNames}.
When responding as a character:
- Only respond as yourself, never speak for other characters
- React naturally to what others have said
- Keep group dynamics and relationships in mind`;

    context.setExtensionPrompt(extensionName, `${contextBridge}\n\n${groupOnlyContext}`, 1, 0);
    toastr.info('Texting mode active 📱 (Group)');
    return;
  }

  // Build combined prompt: perspective shift + context + texting style
  const perspectivePrompt = getCurrentPrompt();
  const contextBridge = buildContextBridgePrompt();

  // Add group-specific context if in a group chat
  let groupContext = '';
  if (inGroup) {
    const members = getGroupMembers();
    const memberNames = members.map(m => m.name).join(', ');
    groupContext = `\n\nGROUP TEXT MODE: This is a group text conversation. Participants: ${memberNames}.
When responding as a character:
- Only respond as yourself, never speak for other characters
- React naturally to what others have said
- Keep group dynamics and relationships in mind
- Use the same texting style as individual messages`;
  }

  const fullPrompt = `${perspectivePrompt}\n\n${contextBridge}${groupContext}`;

  // Inject at position 1 (high priority)
  context.setExtensionPrompt(extensionName, fullPrompt, 1, 0);

  const modeType = inGroup ? 'group' : 'individual';
  console.log(`[st-text-messaging] Texting mode activated (${modeType}) with context`);
  toastr.info(`Texting mode active 📱${inGroup ? ' (Group)' : ''}`);
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

  // Get current prompt (custom or default based on settings)
  const prompt = getCurrentPrompt();
  const useCustom = extension_settings[extensionName]?.useCustomPrompt ?? false;

  // Inject prompt into LLM payload
  // Parameters: (extensionName, promptText, position, depth)
  context.setExtensionPrompt(extensionName, prompt, 1, 0);

  const promptType = useCustom ? 'custom' : extension_settings[extensionName]?.emojiIntensity || 'medium';
  console.log(`[st-text-messaging] Texting style prompt injected (${promptType})`);
}
