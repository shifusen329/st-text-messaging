// Text Messaging Extension - Main Script
import { extension_settings } from "../../extensions.js";
import { saveSettingsDebounced } from "../../../script.js";
import {
  initPhoneUI,
  updatePhonePosition,
  updatePhoneTheme
} from "./lib/phone-ui.js";
import {
  updateTextingPrompt
} from "./lib/prompt-manager.js";

// Extension configuration
const extensionName = "st-text-messaging";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

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
  try {
    console.log('[st-text-messaging] Starting extension initialization...');

    // Load settings HTML
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    console.log('[st-text-messaging] Settings HTML loaded');

    // Append to right column (UI-related extensions)
    $("#extensions_settings2").append(settingsHtml);

    // Load phone UI HTML
    const phoneUIHtml = await $.get(`${extensionFolderPath}/phone-ui.html`);
    console.log('[st-text-messaging] Phone UI HTML loaded');

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
    console.log('[st-text-messaging] Event listeners registered');

    // Load settings
    await loadSettings();
    console.log('[st-text-messaging] Settings loaded');

    // Initialize phone UI
    initPhoneUI();
    console.log('[st-text-messaging] Phone UI initialized');

    // Initialize prompt on load
    updateTextingPrompt();

    // Show phone toggle button if enabled
    if (extension_settings[extensionName]?.enabled) {
      $('#phone-toggle-btn').show();
    }

    console.log('[st-text-messaging] Extension loaded successfully');
  } catch (error) {
    console.error('[st-text-messaging] Extension initialization error:', error);
    console.error('[st-text-messaging] Error stack:', error.stack);
    toastr.error(`Text Messaging extension failed to load: ${error.message}`);
  }
});
