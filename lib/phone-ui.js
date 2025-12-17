/**
 * Phone UI Module
 * Handles phone interface display, rendering, and interactions
 */

import { getContext, extension_settings } from "../../../../extensions.js";
import { addMessage, getMessages, getLastMessages, clearMessages } from "./message-store.js";
import { activateTextingMode, deactivateTextingMode } from "./prompt-manager.js";
import { addMessageToMainChat } from "./context-bridge.js";

const extensionName = "st-text-messaging";
let isPhoneOpen = false;
let currentGroupId = null; // Track current group for group chats

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

  // ST stores groups in context.groups array
  const groups = context.groups || [];
  const group = groups.find(g => g.id === context.groupId);

  if (!group || !group.members) return [];

  // Map member names/IDs to character objects
  return group.members
    .map(memberId => {
      // Members can be character names or avatar filenames
      return context.characters.find(c =>
        c.avatar === memberId ||
        c.name === memberId ||
        String(context.characters.indexOf(c)) === String(memberId)
      );
    })
    .filter(Boolean);
}

/**
 * Gets the conversation key for message storage
 * For individual chats: characterId
 * For group chats: groupId
 * @returns {string|null}
 */
function getConversationKey() {
  const context = getContext();
  if (context.groupId) {
    return `group_${context.groupId}`;
  }
  return context.characterId !== undefined ? String(context.characterId) : null;
}

/**
 * Opens the phone UI and activates texting mode
 */
export function openPhoneUI() {
  const context = getContext();
  const inGroupChat = isInGroupChat();

  // Don't open if no character/group selected
  if (context.characterId === undefined && !inGroupChat) {
    toastr.warning('Please select a character first');
    return;
  }

  // Track group ID for later use
  currentGroupId = inGroupChat ? context.groupId : null;

  // Show phone container with animation
  const $phoneContainer = $('#phone-ui-container');
  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  if (animationsEnabled) {
    $phoneContainer.fadeIn(300);
  } else {
    $phoneContainer.show();
  }

  // Setup header based on chat type
  if (inGroupChat) {
    setupGroupHeader(context);
    console.log('[phone-ui] Opening in group mode, groupId:', context.groupId);
  } else {
    setupSingleHeader(context);
  }

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
 * Sets up header for single character chat
 * @param {Object} context - SillyTavern context
 */
function setupSingleHeader(context) {
  $('#phone-header-single').show();
  $('#phone-header-group').hide();

  const character = context.characters[context.characterId];
  const avatarFile = character?.avatar;
  const avatarUrl = avatarFile ? `/thumbnail?type=avatar&file=${encodeURIComponent(avatarFile)}` : '';

  $('#phone-contact-name').text(context.name2 || 'Character');
  $('#phone-contact-avatar').attr('src', avatarUrl).toggle(!!avatarUrl);
}

/**
 * Sets up header for group chat
 * @param {Object} context - SillyTavern context
 */
function setupGroupHeader(context) {
  $('#phone-header-single').hide();
  $('#phone-header-group').show();

  const members = getGroupMembers();
  const $avatarStack = $('#phone-group-avatars').empty();

  // Show up to 3 avatars stacked
  members.slice(0, 3).forEach((member, index) => {
    const avatarUrl = member.avatar
      ? `/thumbnail?type=avatar&file=${encodeURIComponent(member.avatar)}`
      : '';

    if (avatarUrl) {
      $avatarStack.append(`
        <img class="group-avatar"
             src="${avatarUrl}"
             alt="${escapeHtml(member.name)}"
             style="z-index: ${3 - index}; margin-left: ${index > 0 ? '-8px' : '0'};">
      `);
    }
  });

  // If no avatars, show placeholder
  if ($avatarStack.children().length === 0) {
    $avatarStack.append('<div class="group-avatar-placeholder"><i class="fa-solid fa-users"></i></div>');
  }

  // Set group name - use group name from ST or fallback
  const groups = context.groups || [];
  const group = groups.find(g => g.id === context.groupId);
  const groupName = group?.name || `Group (${members.length})`;
  $('#phone-group-name').text(groupName);
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
  const settings = extension_settings[extensionName] || {};
  const showTimestamps = settings.showTimestamps ?? false;
  const animationsEnabled = settings.animationsEnabled ?? true;
  const inGroupChat = isInGroupChat();

  // Group chat settings (inherit from base settings)
  const groupShowAvatars = settings.groupShowCharacterNames ?? true; // Repurposed: now controls avatar display
  const groupColorCode = settings.groupColorCodeCharacters ?? true;

  // Format timestamp
  const timestamp = formatTimestamp(message.timestamp);

  // For group chats, show character avatar next to their messages (first in sequence only)
  // Respects the groupShowCharacterNames setting (now controls avatar visibility)
  const showCharacterAvatar = inGroupChat &&
    groupShowAvatars &&
    message.sender === 'character' &&
    message.isFirstInSequence &&
    message.avatarUrl;

  // Generate color class for character in groups (8 color variants)
  // Respects the groupColorCodeCharacters setting
  const characterColorClass = inGroupChat && groupColorCode && message.characterId
    ? `char-color-${hashString(message.characterId) % 8}`
    : '';

  // Add class for group messages that need avatar spacing
  const groupMessageClass = inGroupChat && message.sender === 'character' ? 'group-message' : '';

  // Build message HTML
  const messageHtml = `
    <div class="message-row ${message.sender} ${characterColorClass} ${groupMessageClass}"
         data-message-id="${message.id}"
         data-character-id="${message.characterId || ''}">
      ${showCharacterAvatar ? `
        <img class="message-inline-avatar"
             src="${message.avatarUrl}"
             alt="${escapeHtml(message.characterName)}"
             title="${escapeHtml(message.characterName)}">
      ` : (inGroupChat && message.sender === 'character' ? '<div class="message-avatar-spacer"></div>' : '')}
      <div class="message-bubble ${message.sender}">
        <div class="message-text">${escapeHtml(message.text)}</div>
        ${showTimestamps ? `<div class="message-timestamp">${timestamp}</div>` : ''}
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
 * Creates a hash from a string for consistent color assignment
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
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

  const trimmedText = text.trim();

  // Add user message to store
  const userMessage = addMessage({
    sender: 'user',
    text: trimmedText,
    characterName: context.name1 || 'User',
    avatarUrl: ''
  });

  // Render user message in phone UI
  appendMessageToViewport(userMessage);

  // Sync to main chat
  await addMessageToMainChat(trimmedText, true);

  // Play send sound if enabled
  playSoundEffect('send');

  // Generate character response
  await generateCharacterResponse();
}

/**
 * Builds the phone conversation history as a prompt string
 * @returns {string} Formatted conversation history
 */
function buildPhoneConversationPrompt() {
  const context = getContext();
  const messages = getLastMessages(10); // Last 10 messages for context
  const userName = context.name1 || 'User';
  const inGroup = isInGroupChat();

  if (messages.length === 0) {
    return '';
  }

  let conversationHistory = 'Recent text messages:\n';
  messages.forEach(msg => {
    let sender;
    if (msg.sender === 'user') {
      sender = userName;
    } else if (inGroup && msg.characterName) {
      // In groups, use the actual character name from the message
      sender = msg.characterName;
    } else {
      sender = context.name2 || 'Character';
    }
    conversationHistory += `${sender}: ${msg.text}\n`;
  });

  return conversationHistory;
}

/**
 * Gets the active character for response generation in group chats
 * Uses ST's turn order or selects first available member
 * @returns {Object|null} Character object or null
 */
function getActiveGroupCharacter() {
  const members = getGroupMembers();

  if (members.length === 0) return null;

  // ST may have a way to track whose turn it is
  // For now, use a simple rotation based on last message
  const messages = getMessages();
  const lastCharMessage = [...messages].reverse().find(m => m.sender === 'character');

  if (lastCharMessage && lastCharMessage.characterId) {
    // Find the next character in rotation
    const lastCharIndex = members.findIndex(m =>
      m.avatar === lastCharMessage.characterId ||
      m.name === lastCharMessage.characterId
    );
    if (lastCharIndex !== -1 && members.length > 1) {
      // Return next character in list
      return members[(lastCharIndex + 1) % members.length];
    }
  }

  // Default to first member
  return members[0];
}

/**
 * Shows typing indicator in phone viewport
 */
function showTypingIndicator() {
  // Don't add if already showing
  if ($('#phone-typing-indicator').length > 0) return;

  const typingHtml = `
    <div id="phone-typing-indicator" class="message-row character">
      <div class="message-bubble character typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;

  $('#phone-viewport').append(typingHtml);
  scrollToBottom();
}

/**
 * Hides typing indicator
 */
function hideTypingIndicator() {
  $('#phone-typing-indicator').remove();
}

/**
 * Generates character response using SillyTavern's API
 */
async function generateCharacterResponse() {
  const context = getContext();
  const inGroup = isInGroupChat();

  // Show typing indicator
  showTypingIndicator();

  try {
    if (typeof context.generateQuietPrompt !== 'function') {
      throw new Error('SillyTavern context.generateQuietPrompt is not available');
    }

    // Get user name
    const userName = context.name1 || 'User';

    // Determine responding character based on mode
    let charName, charId, avatarUrl;

    if (inGroup) {
      // In group mode, get the active character (rotation-based)
      const activeChar = getActiveGroupCharacter();
      if (!activeChar) {
        console.warn('[phone-ui] No active character in group');
        return;
      }
      charName = activeChar.name;
      charId = activeChar.avatar || activeChar.name; // ST uses avatar filename as ID sometimes
      avatarUrl = activeChar.avatar
        ? `/thumbnail?type=avatar&file=${encodeURIComponent(activeChar.avatar)}`
        : '';
    } else {
      // Single character mode
      charName = context.name2 || 'Character';
      charId = context.characterId;
      const character = context.characters[context.characterId];
      const avatarFile = character?.avatar;
      avatarUrl = avatarFile ? `/thumbnail?type=avatar&file=${encodeURIComponent(avatarFile)}` : '';
    }

    // Get user persona description if available
    const userPersona = context.persona || '';

    // Build phone conversation history
    const conversationHistory = buildPhoneConversationPrompt();

    // Build the quiet prompt - different for groups vs individual
    let quietPrompt;
    if (inGroup) {
      const members = getGroupMembers();
      const otherNames = members
        .filter(m => m.name !== charName)
        .map(m => m.name)
        .join(', ');

      quietPrompt = `You are ${charName} texting in a group chat with ${userName}${otherNames ? ` and ${otherNames}` : ''}.
${userPersona ? `\nAbout ${userName}: ${userPersona}\n` : ''}
${conversationHistory}
Now reply as ${charName} only via text message. Do not speak for other characters. Keep it casual and in-character. Only output ${charName}'s text message reply, nothing else.`;
    } else {
      quietPrompt = `You are ${charName} texting with ${userName} on a phone.
${userPersona ? `\nAbout ${userName}: ${userPersona}\n` : ''}
${conversationHistory}
Now reply as ${charName} via text message. Keep it casual and in-character. Only output ${charName}'s text message reply, nothing else.`;
    }

    // Use SillyTavern's generateQuietPrompt to get character response.
    // This will use the injected texting mode prompts.
    const response = await context.generateQuietPrompt({ quietPrompt });

    if (response) {
      // Extract character message from response
      // Strip leading 📱 emoji if present (we add it for main chat, not phone UI)
      let characterText = response;
      if (characterText.startsWith('📱')) {
        characterText = characterText.replace(/^📱\s*/, '');
      }

      // Strip character name prefix if LLM included it
      const namePrefix = new RegExp(`^${charName}:\\s*`, 'i');
      characterText = characterText.replace(namePrefix, '').trim();

      if (!characterText) {
        console.warn('[phone-ui] Empty response after cleanup');
        return;
      }

      // Add character message to store with character tracking
      const characterMessage = addMessage({
        sender: 'character',
        text: characterText,
        characterId: charId,  // Track which character for groups
        characterName: charName,
        avatarUrl: avatarUrl
      });

      // Render character message in phone UI
      appendMessageToViewport(characterMessage);

      // Sync to main chat (pass character name for proper attribution)
      await addMessageToMainChat(characterText, false, charName);

      // Play receive sound if enabled
      playSoundEffect('receive');
    }
  } catch (error) {
    console.error('[phone-ui] Error generating character response:', error);
    toastr.error('Failed to generate response');
  } finally {
    // Always hide typing indicator when done
    hideTypingIndicator();
  }
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
 * Updates phone UI color scheme based on settings
 */
export function updateColorScheme() {
  const colorScheme = extension_settings[extensionName]?.colorScheme || 'default';
  const $phoneContainer = $('#phone-ui-container');

  $phoneContainer.removeClass('color-default color-imessage');
  if (colorScheme !== 'default') {
    $phoneContainer.addClass(`color-${colorScheme}`);
  }
}

/**
 * Checks if we're on a mobile device
 * @returns {boolean} True if mobile
 */
function isMobileDevice() {
  return window.matchMedia('(max-width: 480px)').matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Handles virtual keyboard visibility on mobile
 * Scrolls to keep input visible when keyboard opens
 */
function setupMobileKeyboardHandling() {
  if (!isMobileDevice()) return;

  const $input = $('#phone-message-input');

  // When input is focused, scroll viewport to bottom after a delay
  // (allows time for keyboard to appear)
  $input.on('focus', () => {
    setTimeout(() => {
      scrollToBottom();
      // Also scroll the input into view
      $input[0]?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
  });

  // Use visualViewport API if available (better keyboard detection)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (isPhoneOpen) {
        // Viewport shrunk = keyboard opened, scroll to bottom
        scrollToBottom();
      }
    });
  }
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

  // Enter key to send (desktop)
  // On mobile, Enter typically inserts newline, so we rely on send button
  $('#phone-message-input').on('keypress', async (e) => {
    if (e.which === 13 && !isMobileDevice()) { // Enter key on desktop only
      e.preventDefault();
      const text = $(e.target).val();
      await sendUserMessage(text);
      $(e.target).val('');
    }
  });

  // Toggle button
  $('#phone-toggle-btn').on('click', () => {
    togglePhoneUI();
  });

  // Setup mobile-specific handling
  setupMobileKeyboardHandling();

  // Apply initial position, theme, and color scheme
  updatePhonePosition();
  updatePhoneTheme();
  updateColorScheme();

  console.log('[phone-ui] Phone UI initialized');
}
