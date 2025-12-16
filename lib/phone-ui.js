/**
 * Phone UI Module
 * Handles phone interface display, rendering, and interactions
 */

import { getContext, extension_settings } from "../../../../../extensions.js";
import { generateQuietPrompt } from "../../../../../script.js";
import { addMessage, getMessages, clearMessages } from "./message-store.js";
import { activateTextingMode, deactivateTextingMode } from "./prompt-manager.js";

const extensionName = "st-text-messaging";
let isPhoneOpen = false;

/**
 * Opens the phone UI and activates texting mode
 */
export function openPhoneUI() {
  const context = getContext();

  // Don't open if no character selected
  if (!context.characterId) {
    toastr.warning('Please select a character first');
    return;
  }

  // Show phone container with animation
  const $phoneContainer = $('#phone-ui-container');
  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  if (animationsEnabled) {
    $phoneContainer.fadeIn(300);
  } else {
    $phoneContainer.show();
  }

  // Update contact name in header
  $('#phone-contact-name').text(context.name2 || 'Character');

  // Render existing messages
  renderAllMessages();

  // Activate texting mode (inject prompts + context)
  activateTextingMode();

  // Focus on input field
  $('#phone-message-input').focus();

  isPhoneOpen = true;

  console.log('[phone-ui] Phone UI opened');
}

/**
 * Closes the phone UI and deactivates texting mode
 */
export async function closePhoneUI() {
  const $phoneContainer = $('#phone-ui-container');
  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  // Get messages for summary injection
  const messages = getMessages();

  // Deactivate texting mode (inject summary, transition back)
  await deactivateTextingMode(messages);

  // Hide phone container
  if (animationsEnabled) {
    $phoneContainer.fadeOut(300);
  } else {
    $phoneContainer.hide();
  }

  isPhoneOpen = false;

  console.log('[phone-ui] Phone UI closed');
}

/**
 * Toggles phone UI open/closed
 */
export async function togglePhoneUI() {
  if (isPhoneOpen) {
    await closePhoneUI();
  } else {
    openPhoneUI();
  }
}

/**
 * Renders all messages in the phone viewport
 */
export function renderAllMessages() {
  const $viewport = $('#phone-viewport');
  $viewport.empty();

  const messages = getMessages();

  messages.forEach(msg => {
    appendMessageToViewport(msg);
  });

  // Scroll to bottom
  scrollToBottom();
}

/**
 * Appends a single message to the viewport
 * @param {Object} message - Message object from message store
 */
export function appendMessageToViewport(message) {
  const $viewport = $('#phone-viewport');
  const showTimestamps = extension_settings[extensionName]?.showTimestamps ?? false;
  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  // Format timestamp
  const timestamp = formatTimestamp(message.timestamp);

  // Build message HTML
  const messageHtml = `
    <div class="message-row ${message.sender} ${message.isFirstInSequence ? 'first-in-sequence' : ''}" data-message-id="${message.id}">
      <div class="message-content">
        ${message.sender === 'character' ? `
          <div class="message-avatar-wrapper">
            <img src="${message.avatarUrl}" class="message-avatar" alt="${message.characterName}">
          </div>
        ` : ''}
        <div class="message-bubble ${message.sender}">
          <div class="message-text">${escapeHtml(message.text)}</div>
          ${showTimestamps ? `<div class="message-timestamp">${timestamp}</div>` : ''}
        </div>
        ${message.sender === 'user' ? `
          <div class="message-avatar-wrapper">
            <div class="message-avatar user-avatar">
              <i class="fa-solid fa-user"></i>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  const $message = $(messageHtml);

  // Apply animation if enabled
  if (animationsEnabled) {
    $message.hide().appendTo($viewport).fadeIn(200);
  } else {
    $message.appendTo($viewport);
  }

  // Scroll to bottom
  scrollToBottom();
}

/**
 * Scrolls viewport to bottom (latest messages)
 */
export function scrollToBottom() {
  const $viewport = $('#phone-viewport');
  const scrollHeight = $viewport[0].scrollHeight;

  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  if (animationsEnabled) {
    $viewport.animate({ scrollTop: scrollHeight }, 200);
  } else {
    $viewport.scrollTop(scrollHeight);
  }
}

/**
 * Sends a user message from phone input
 * @param {string} text - Message text
 */
export async function sendUserMessage(text) {
  if (!text || !text.trim()) {
    return;
  }

  const context = getContext();

  // Add user message to store
  const userMessage = addMessage({
    sender: 'user',
    text: text.trim(),
    characterName: context.name1 || 'User',
    avatarUrl: ''
  });

  // Render user message
  appendMessageToViewport(userMessage);

  // Play send sound if enabled
  playSoundEffect('send');

  // Generate character response
  await generateCharacterResponse();
}

/**
 * Generates character response using SillyTavern's API
 */
async function generateCharacterResponse() {
  const context = getContext();

  // Show typing indicator (optional)
  // showTypingIndicator();

  try {
    // Use SillyTavern's generateQuietPrompt to get character response
    // This will use the injected texting mode prompts
    const response = await generateQuietPrompt();

    if (response) {
      // Extract character message from response
      const characterText = response;

      // Get character info
      const character = context.characters[context.characterId];
      const avatarUrl = character?.avatar || '';

      // Add character message to store
      const characterMessage = addMessage({
        sender: 'character',
        text: characterText,
        characterName: context.name2 || 'Character',
        avatarUrl: avatarUrl
      });

      // Render character message
      appendMessageToViewport(characterMessage);

      // Play receive sound if enabled
      playSoundEffect('receive');
    }
  } catch (error) {
    console.error('[phone-ui] Error generating character response:', error);
    toastr.error('Failed to generate response');
  }

  // Hide typing indicator
  // hideTypingIndicator();
}

/**
 * Plays a sound effect
 * @param {string} type - 'send' or 'receive'
 */
function playSoundEffect(type) {
  const soundEnabled = extension_settings[extensionName]?.soundEnabled ?? true;

  if (!soundEnabled) {
    return;
  }

  const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
  const soundPath = `${extensionFolderPath}/assets/sounds/${type}.mp3`;

  const audio = new Audio(soundPath);
  audio.volume = 0.3;
  audio.play().catch(err => {
    // Sound file may not exist yet - fail silently
    console.log(`[phone-ui] Sound effect not available: ${type}`);
  });
}

/**
 * Formats timestamp for display
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
function formatTimestamp(date) {
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute ago - show "Just now"
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour ago - show minutes
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Same day - show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // Different day - show date + time
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clears all messages in phone UI
 */
export function clearPhoneMessages() {
  clearMessages();
  renderAllMessages();
  toastr.info('Phone messages cleared');
}

/**
 * Checks if phone UI is currently open
 * @returns {boolean} True if open
 */
export function isPhoneUIOpen() {
  return isPhoneOpen;
}

/**
 * Updates phone UI position based on settings
 */
export function updatePhonePosition() {
  const position = extension_settings[extensionName]?.position || 'right';
  const $phoneContainer = $('#phone-ui-container');

  $phoneContainer.removeClass('position-left position-center position-right');
  $phoneContainer.addClass(`position-${position}`);
}

/**
 * Updates phone UI theme based on settings
 */
export function updatePhoneTheme() {
  const theme = extension_settings[extensionName]?.theme || 'dark';
  const $phoneContainer = $('#phone-ui-container');

  $phoneContainer.removeClass('theme-light theme-dark');
  $phoneContainer.addClass(`theme-${theme}`);
}

/**
 * Initializes phone UI event handlers
 */
export function initPhoneUI() {
  // Close button
  $('#phone-close-btn').on('click', async () => {
    await closePhoneUI();
  });

  // Send button
  $('#phone-send-btn').on('click', async () => {
    const text = $('#phone-message-input').val();
    await sendUserMessage(text);
    $('#phone-message-input').val('');
  });

  // Enter key to send
  $('#phone-message-input').on('keypress', async (e) => {
    if (e.which === 13) { // Enter key
      const text = $(e.target).val();
      await sendUserMessage(text);
      $(e.target).val('');
    }
  });

  // Toggle button
  $('#phone-toggle-btn').on('click', () => {
    togglePhoneUI();
  });

  // Apply initial position and theme
  updatePhonePosition();
  updatePhoneTheme();

  console.log('[phone-ui] Phone UI initialized');
}
