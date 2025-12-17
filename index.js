// Text Messaging Extension - Main Script
import {
  initPhoneUI,
  updatePhonePosition,
  updatePhoneTheme,
  updateColorScheme,
  togglePhoneUI
} from "./lib/phone-ui.js";
import {
  updateTextingPrompt,
  getDefaultPrompt
} from "./lib/prompt-manager.js";

// Extension configuration
const extensionName = "st-text-messaging";
const extensionFolderUrl = new URL('.', import.meta.url);

function getContext() {
  return SillyTavern.getContext();
}

function getSettingsStore() {
  const context = getContext();
  return context?.extensionSettings ?? window.extension_settings ?? {};
}

function saveSettings() {
  const context = getContext();
  const fn = context?.saveSettingsDebounced ?? window.saveSettingsDebounced;
  if (typeof fn === 'function') fn();
}

// Default settings
const defaultSettings = {
  enabled: false,
  position: "right",
  soundEnabled: true,
  theme: "dark",
  colorScheme: "default",
  showTimestamps: false,
  animationsEnabled: true,
  useTextingStyle: true,
  emojiIntensity: "medium",
  useCustomPrompt: false,
  customPrompt: ""
};

/**
 * Loads extension settings from storage
 */
async function loadSettings() {
  const extension_settings = getSettingsStore();
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
  $("#phone_color_scheme").val(extension_settings[extensionName].colorScheme);
  $("#sound_enabled").prop("checked", extension_settings[extensionName].soundEnabled);
  $("#show_timestamps").prop("checked", extension_settings[extensionName].showTimestamps);
  $("#animations_enabled").prop("checked", extension_settings[extensionName].animationsEnabled);

  // Custom prompt settings
  const useCustomPrompt = extension_settings[extensionName].useCustomPrompt ?? false;
  $("#use_custom_prompt").prop("checked", useCustomPrompt);
  $("#custom_prompt_text").prop("disabled", !useCustomPrompt);

  // Load custom prompt or show current default
  if (extension_settings[extensionName].customPrompt) {
    $("#custom_prompt_text").val(extension_settings[extensionName].customPrompt);
  } else {
    // Show current default prompt based on intensity
    const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
    $("#custom_prompt_text").val(getDefaultPrompt(intensity));
  }
}

/**
 * Event handler: Phone mode enabled/disabled
 */
function onPhoneModeToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enabled = enabled;
  saveSettings();

  // Update prompt injection
  updateTextingPrompt();

  // Show/hide phone toggle buttons (floating + top bar)
  if (enabled) {
    $('#phone-toggle-btn').fadeIn(200);
    $('#phone-topbar-btn').fadeIn(200);
    toastr.success('Phone messaging mode enabled! 📱');
  } else {
    $('#phone-toggle-btn').fadeOut(200);
    $('#phone-topbar-btn').fadeOut(200);
    toastr.info('Phone messaging mode disabled');
  }
}

/**
 * Event handler: Texting style toggled
 */
function onTextingStyleToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].useTextingStyle = enabled;
  saveSettings();

  // Update prompt injection
  updateTextingPrompt();
}

/**
 * Event handler: Emoji intensity changed
 */
function onEmojiIntensityChange(event) {
  const extension_settings = getSettingsStore();
  const intensity = $(event.target).val();
  extension_settings[extensionName].emojiIntensity = intensity;
  saveSettings();

  // Update prompt injection
  updateTextingPrompt();
  toastr.info(`Emoji intensity: ${intensity}`);
}

/**
 * Event handler: Phone position changed
 */
function onPhonePositionChange(event) {
  const extension_settings = getSettingsStore();
  const position = $(event.target).val();
  extension_settings[extensionName].position = position;
  saveSettings();
  updatePhonePosition();
}

/**
 * Event handler: Theme changed
 */
function onThemeChange(event) {
  const extension_settings = getSettingsStore();
  const theme = $(event.target).val();
  extension_settings[extensionName].theme = theme;
  saveSettings();
  updatePhoneTheme();
}

/**
 * Event handler: Color scheme changed
 */
function onColorSchemeChange(event) {
  const extension_settings = getSettingsStore();
  const colorScheme = $(event.target).val();
  extension_settings[extensionName].colorScheme = colorScheme;
  saveSettings();
  updateColorScheme();
}

/**
 * Event handler: Sound toggle
 */
function onSoundToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].soundEnabled = enabled;
  saveSettings();
}

/**
 * Event handler: Timestamps toggle
 */
function onTimestampsToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].showTimestamps = enabled;
  saveSettings();
}

/**
 * Event handler: Animations toggle
 */
function onAnimationsToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].animationsEnabled = enabled;
  saveSettings();
}

/**
 * Event handler: Use custom prompt toggle
 */
function onUseCustomPromptToggle(event) {
  const extension_settings = getSettingsStore();
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].useCustomPrompt = enabled;

  // Enable/disable textarea
  $("#custom_prompt_text").prop("disabled", !enabled);

  // If enabling and no custom prompt set, copy current default
  if (enabled && !extension_settings[extensionName].customPrompt) {
    const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
    const defaultPrompt = getDefaultPrompt(intensity);
    extension_settings[extensionName].customPrompt = defaultPrompt;
    $("#custom_prompt_text").val(defaultPrompt);
  }

  saveSettings();
  updateTextingPrompt();

  if (enabled) {
    toastr.info('Custom prompt enabled');
  } else {
    toastr.info('Using preset prompts');
  }
}

/**
 * Event handler: Custom prompt text changed
 */
function onCustomPromptChange(event) {
  const extension_settings = getSettingsStore();
  const promptText = $(event.target).val();
  extension_settings[extensionName].customPrompt = promptText;
  saveSettings();
  updateTextingPrompt();
}

/**
 * Event handler: Reset custom prompt to default
 */
function onCustomPromptReset() {
  const extension_settings = getSettingsStore();
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
  const defaultPrompt = getDefaultPrompt(intensity);

  extension_settings[extensionName].customPrompt = defaultPrompt;
  $("#custom_prompt_text").val(defaultPrompt);
  saveSettings();
  updateTextingPrompt();

  toastr.success('Prompt reset to default');
}

/**
 * Event handler: Preview current prompt (shows what's actually being used)
 */
function onCustomPromptPreview() {
  const extension_settings = getSettingsStore();
  const useCustom = extension_settings[extensionName].useCustomPrompt ?? false;
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';

  let currentPrompt;
  if (useCustom && extension_settings[extensionName].customPrompt) {
    currentPrompt = extension_settings[extensionName].customPrompt;
  } else {
    currentPrompt = getDefaultPrompt(intensity);
  }

  // Show in textarea (even if disabled, for preview)
  $("#custom_prompt_text").val(currentPrompt);
  toastr.info(`Showing ${useCustom ? 'custom' : intensity + ' preset'} prompt`);
}

/**
 * Registers extension with ST's wand/extensions menu for mobile access
 */
function registerWandMenuEntry() {
  const context = getContext();

  // Check if ST has the menu registration API
  if (typeof context.registerExtensionHelper === 'function') {
    context.registerExtensionHelper(extensionName, 'Open Phone', togglePhoneUI);
    console.log('[st-text-messaging] Registered with extension helper menu');
    return;
  }

  // Try multiple menu locations ST might use
  const menuSelectors = [
    '#extensionsMenu',
    '#options .options-content',
    '#top-bar',
    '.drawer-content'
  ];

  for (const selector of menuSelectors) {
    const $menu = $(selector);
    if ($menu.length > 0) {
      // Check if already added
      if ($('#phone-wand-menu-item').length > 0) return;

      const menuItem = $(`
        <div id="phone-wand-menu-item" class="list-group-item flex-container flexGap5 interactable" title="Open Phone Messages">
          <i class="fa-solid fa-mobile-screen"></i>
          <span>Open Phone</span>
        </div>
      `);

      menuItem.on('click', () => {
        const extension_settings = getSettingsStore();
        if (!extension_settings[extensionName]?.enabled) {
          toastr.warning('Enable Phone UI in extension settings first');
          return;
        }
        togglePhoneUI();
      });

      $menu.first().append(menuItem);
      console.log('[st-text-messaging] Added to menu:', selector);
      break;
    }
  }

  // Also add to the top icons bar if possible (more visible on mobile)
  addTopBarIcon();
}

/**
 * Adds a phone icon to ST's top bar for easy mobile access
 */
function addTopBarIcon() {
  // Look for ST's icon/button bars
  const topBarSelectors = [
    '#top-settings-holder',
    '#leftSendForm',
    '#rightSendForm',
    '.send_form'
  ];

  for (const selector of topBarSelectors) {
    const $bar = $(selector);
    if ($bar.length > 0 && $('#phone-topbar-btn').length === 0) {
      const iconBtn = $(`
        <div id="phone-topbar-btn" class="fa-solid fa-mobile-screen interactable"
             title="Open Phone"
             style="cursor: pointer; padding: 5px; font-size: 1.2em;"></div>
      `);

      iconBtn.on('click', () => {
        const extension_settings = getSettingsStore();
        if (!extension_settings[extensionName]?.enabled) {
          toastr.warning('Enable Phone UI in extension settings first');
          return;
        }
        togglePhoneUI();
      });

      // Only show if extension is enabled
      const extension_settings = getSettingsStore();
      if (!extension_settings[extensionName]?.enabled) {
        iconBtn.hide();
      }

      $bar.first().prepend(iconBtn);
      console.log('[st-text-messaging] Added top bar icon to:', selector);
      break;
    }
  }
}

/**
 * Registers /phone slash command for toggling phone UI
 */
function registerSlashCommand() {
  const context = getContext();

  // Use ST's slash command registration if available
  if (typeof context.registerSlashCommand === 'function') {
    context.registerSlashCommand('phone', () => {
      const extension_settings = getSettingsStore();
      if (!extension_settings[extensionName]?.enabled) {
        toastr.warning('Enable Phone UI in extension settings first');
        return 'Phone UI is disabled';
      }
      togglePhoneUI();
      return 'Toggled phone UI';
    }, [], 'Toggle the phone messaging interface', true, true);
    console.log('[st-text-messaging] Registered /phone slash command');
  } else if (window.registerSlashCommand) {
    // Fallback to global registration
    window.registerSlashCommand('phone', () => {
      const extension_settings = getSettingsStore();
      if (!extension_settings[extensionName]?.enabled) {
        toastr.warning('Enable Phone UI in extension settings first');
        return 'Phone UI is disabled';
      }
      togglePhoneUI();
      return 'Toggled phone UI';
    }, [], 'Toggle the phone messaging interface', true, true);
    console.log('[st-text-messaging] Registered /phone slash command (global)');
  }
}

// Extension initialization
jQuery(async () => {
  try {
    console.log('[st-text-messaging] Starting extension initialization...');

    // Load settings HTML
    const settingsHtml = await $.get(new URL('settings.html', extensionFolderUrl).toString());
    console.log('[st-text-messaging] Settings HTML loaded');

    // Append to right column (UI-related extensions)
    $("#extensions_settings2").append(settingsHtml);

    // Load phone UI HTML
    const phoneUIHtml = await $.get(new URL('phone-ui.html', extensionFolderUrl).toString());
    console.log('[st-text-messaging] Phone UI HTML loaded');

    // Append phone UI to body
    $("body").append(phoneUIHtml);

    // Register settings event listeners
    $("#phone_mode_enabled").on("input", onPhoneModeToggle);
    $("#texting_style_enabled").on("input", onTextingStyleToggle);
    $("#emoji_intensity").on("change", onEmojiIntensityChange);
    $("#phone_position").on("change", onPhonePositionChange);
    $("#phone_theme").on("change", onThemeChange);
    $("#phone_color_scheme").on("change", onColorSchemeChange);
    $("#sound_enabled").on("input", onSoundToggle);
    $("#show_timestamps").on("input", onTimestampsToggle);
    $("#animations_enabled").on("input", onAnimationsToggle);

    // Custom prompt event listeners
    $("#use_custom_prompt").on("input", onUseCustomPromptToggle);
    $("#custom_prompt_text").on("input", onCustomPromptChange);
    $("#custom_prompt_reset").on("click", onCustomPromptReset);
    $("#custom_prompt_preview").on("click", onCustomPromptPreview);

    console.log('[st-text-messaging] Event listeners registered');

    // Load settings
    await loadSettings();
    console.log('[st-text-messaging] Settings loaded');

    // Initialize phone UI
    initPhoneUI();
    console.log('[st-text-messaging] Phone UI initialized');

    // Initialize prompt on load
    updateTextingPrompt();

    // Register with ST's wand menu for mobile access
    registerWandMenuEntry();

    // Show phone toggle buttons if enabled
    const extension_settings = getSettingsStore();
    if (extension_settings[extensionName]?.enabled) {
      $('#phone-toggle-btn').show();
      $('#phone-topbar-btn').show();
    }

    // Register slash command for keyboard users
    registerSlashCommand();

    console.log('[st-text-messaging] Extension loaded successfully');
  } catch (error) {
    console.error('[st-text-messaging] Extension initialization error:', error);
    console.error('[st-text-messaging] Error stack:', error.stack);
    toastr.error(`Text Messaging extension failed to load: ${error.message}`);
  }
});
