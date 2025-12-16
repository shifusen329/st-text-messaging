// Text Messaging Extension - Main Script
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import {
  buildContextBridgePrompt,
  summarizeTextingConversation,
  injectTextingSummaryIntoChat
} from "./lib/context-bridge.js";
import {
  initPhoneUI,
  updatePhonePosition,
  updatePhoneTheme
} from "./lib/phone-ui.js";

// Extension configuration
const extensionName = "st-text-messaging";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

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

// Default settings
const defaultSettings = {
  enabled: false,
  position: "right",
  soundEnabled: true,
  theme: "dark",
  showTimestamps: false,
  animationsEnabled: true,
  useTextingStyle: true,
  emojiIntensity: "medium"
};

/**
 * Updates the LLM prompt based on current settings
 */
function updateTextingPrompt() {
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
 * Loads extension settings from storage
 */
async function loadSettings() {
  // Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Update UI with current settings
  $("#phone_mode_enabled").prop("checked", extension_settings[extensionName].enabled);
  $("#texting_style_enabled").prop("checked", extension_settings[extensionName].useTextingStyle);
  $("#emoji_intensity").val(extension_settings[extensionName].emojiIntensity);
  $("#phone_position").val(extension_settings[extensionName].position);
  $("#phone_theme").val(extension_settings[extensionName].theme);
  $("#sound_enabled").prop("checked", extension_settings[extensionName].soundEnabled);
  $("#show_timestamps").prop("checked", extension_settings[extensionName].showTimestamps);
  $("#animations_enabled").prop("checked", extension_settings[extensionName].animationsEnabled);
}

/**
 * Event handler: Phone mode enabled/disabled
 */
function onPhoneModeToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enabled = enabled;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();

  // Show/hide phone toggle button
  if (enabled) {
    $('#phone-toggle-btn').fadeIn(200);
    toastr.success('Phone messaging mode enabled! 📱');
  } else {
    $('#phone-toggle-btn').fadeOut(200);
    toastr.info('Phone messaging mode disabled');
  }
}

/**
 * Event handler: Texting style toggled
 */
function onTextingStyleToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].useTextingStyle = enabled;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();
}

/**
 * Event handler: Emoji intensity changed
 */
function onEmojiIntensityChange(event) {
  const intensity = $(event.target).val();
  extension_settings[extensionName].emojiIntensity = intensity;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();
  toastr.info(`Emoji intensity: ${intensity}`);
}

/**
 * Event handler: Phone position changed
 */
function onPhonePositionChange(event) {
  const position = $(event.target).val();
  extension_settings[extensionName].position = position;
  saveSettingsDebounced();
  updatePhonePosition();
}

/**
 * Event handler: Theme changed
 */
function onThemeChange(event) {
  const theme = $(event.target).val();
  extension_settings[extensionName].theme = theme;
  saveSettingsDebounced();
  updatePhoneTheme();
}

/**
 * Event handler: Sound toggle
 */
function onSoundToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].soundEnabled = enabled;
  saveSettingsDebounced();
}

/**
 * Event handler: Timestamps toggle
 */
function onTimestampsToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].showTimestamps = enabled;
  saveSettingsDebounced();
}

/**
 * Event handler: Animations toggle
 */
function onAnimationsToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].animationsEnabled = enabled;
  saveSettingsDebounced();
}

// Extension initialization
jQuery(async () => {
  // Load settings HTML
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

  // Append to right column (UI-related extensions)
  $("#extensions_settings2").append(settingsHtml);

  // Load phone UI HTML
  const phoneUIHtml = await $.get(`${extensionFolderPath}/phone-ui.html`);

  // Append phone UI to body
  $("body").append(phoneUIHtml);

  // Register settings event listeners
  $("#phone_mode_enabled").on("input", onPhoneModeToggle);
  $("#texting_style_enabled").on("input", onTextingStyleToggle);
  $("#emoji_intensity").on("change", onEmojiIntensityChange);
  $("#phone_position").on("change", onPhonePositionChange);
  $("#phone_theme").on("change", onThemeChange);
  $("#sound_enabled").on("input", onSoundToggle);
  $("#show_timestamps").on("input", onTimestampsToggle);
  $("#animations_enabled").on("input", onAnimationsToggle);

  // Load settings
  await loadSettings();

  // Initialize phone UI
  initPhoneUI();

  // Initialize prompt on load
  updateTextingPrompt();

  // Show phone toggle button if enabled
  if (extension_settings[extensionName]?.enabled) {
    $('#phone-toggle-btn').show();
  }

  console.log('[st-text-messaging] Extension loaded successfully');
});
