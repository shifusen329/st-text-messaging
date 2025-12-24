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
let visualViewportHandler = null; // Store reference for cleanup

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

  // Clean up mobile keyboard handling to prevent memory leaks
  cleanupMobileKeyboardHandling();

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

  // Generate character response(s)
  // In group chats with Natural order, multiple mentioned characters should respond
  if (isInGroupChat()) {
    await generateGroupResponses(trimmedText);
  } else {
    await generateCharacterResponse();
  }
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
 * Gets the current group object from ST
 * @returns {Object|null} Group object or null
 */
function getCurrentGroup() {
  const context = getContext();
  if (!context.groupId) return null;

  const groups = context.groups || [];
  return groups.find(g => g.id === context.groupId) || null;
}

/**
 * Gets characters who have spoken since last user message
 * @returns {Set} Set of character IDs who have spoken
 */
function getCharactersWhoSpokeSinceLastUser() {
  const messages = getMessages();
  const spoken = new Set();

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.sender === 'user') break;
    if (msg.sender === 'character' && msg.characterId) {
      spoken.add(msg.characterId);
    }
  }

  return spoken;
}

/**
 * Gets the character who should respond next based on ST's group settings
 * Respects: activation_strategy, disabled_members, allow_self_responses, talkativeness
 * @returns {Object|null} Character object or null
 */
function getNextGroupCharacter() {
  const members = getGroupMembers();
  if (members.length === 0) return null;

  const group = getCurrentGroup();
  if (!group) return members[0];

  // Filter out muted/disabled members
  const disabledMembers = group.disabled_members || [];
  const activeMembers = members.filter(m => {
    const memberId = m.avatar || m.name;
    return !disabledMembers.includes(memberId);
  });

  if (activeMembers.length === 0) return members[0];

  // Get settings
  const strategy = group.activation_strategy ?? 1; // 0=Natural, 1=List, 2=Pooled, 3=Manual
  const allowSelf = group.allow_self_responses ?? false;

  const messages = getMessages();
  const lastCharMessage = [...messages].reverse().find(m => m.sender === 'character');
  const lastCharId = lastCharMessage?.characterId;

  // Build eligible list (exclude last speaker if !allowSelf)
  let eligible = activeMembers;
  if (!allowSelf && lastCharId && activeMembers.length > 1) {
    eligible = activeMembers.filter(m => {
      const memberId = m.avatar || m.name;
      return memberId !== lastCharId;
    });
    if (eligible.length === 0) eligible = activeMembers;
  }

  console.log(`[phone-ui] Group strategy: ${strategy}, allowSelf: ${allowSelf}, eligible: ${eligible.length}`);

  switch (strategy) {
    case 0: { // Natural order - name mentions + talkativeness
      const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMessage?.text) {
        const text = lastUserMessage.text.toLowerCase();
        for (const member of eligible) {
          const nameRegex = new RegExp(`\\b${member.name.toLowerCase()}\\b`);
          if (nameRegex.test(text)) {
            console.log(`[phone-ui] Natural: ${member.name} mentioned`);
            return member;
          }
        }
      }
      // Use talkativeness for weighted selection
      const candidates = eligible.filter(m => {
        const talk = m.talkativeness ?? 50;
        return Math.random() * 100 < talk;
      });
      if (candidates.length > 0) {
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        console.log(`[phone-ui] Natural: ${selected.name} by talkativeness`);
        return selected;
      }
      // Fallback to random
      const random = eligible[Math.floor(Math.random() * eligible.length)];
      console.log(`[phone-ui] Natural: ${random.name} random`);
      return random;
    }

    case 1: { // List order - sequential rotation
      if (lastCharId) {
        const lastIdx = activeMembers.findIndex(m =>
          (m.avatar || m.name) === lastCharId
        );
        if (lastIdx !== -1) {
          // Find next eligible in order
          for (let i = 1; i <= activeMembers.length; i++) {
            const nextIdx = (lastIdx + i) % activeMembers.length;
            const candidate = activeMembers[nextIdx];
            const candidateId = candidate.avatar || candidate.name;
            if (allowSelf || candidateId !== lastCharId) {
              console.log(`[phone-ui] List: ${candidate.name}`);
              return candidate;
            }
          }
        }
      }
      console.log(`[phone-ui] List: ${eligible[0].name} (first)`);
      return eligible[0];
    }

    case 2: { // Pooled order - everyone speaks once before repeat
      const spoken = getCharactersWhoSpokeSinceLastUser();
      const unspoken = eligible.filter(m => {
        const memberId = m.avatar || m.name;
        return !spoken.has(memberId);
      });

      if (unspoken.length > 0) {
        const selected = unspoken[Math.floor(Math.random() * unspoken.length)];
        console.log(`[phone-ui] Pooled: ${selected.name} (unspoken)`);
        return selected;
      }
      const random = eligible[Math.floor(Math.random() * eligible.length)];
      console.log(`[phone-ui] Pooled: ${random.name} (all spoke)`);
      return random;
    }

    case 3: { // Manual - no auto response
      console.log(`[phone-ui] Manual mode - no auto selection`);
      return null;
    }

    default:
      return eligible[0];
  }
}

/**
 * Gets all mentioned characters from user message text
 * @param {string} text - User message text
 * @returns {Array} Array of mentioned character objects
 */
function getMentionedCharacters(text) {
  const members = getGroupMembers();
  const group = getCurrentGroup();
  const disabledMembers = group?.disabled_members || [];

  // Filter to active (non-muted) members
  const activeMembers = members.filter(m => {
    const memberId = m.avatar || m.name;
    return !disabledMembers.includes(memberId);
  });

  const mentioned = [];
  const lowerText = text.toLowerCase();

  for (const member of activeMembers) {
    const nameRegex = new RegExp(`\\b${member.name.toLowerCase()}\\b`);
    if (nameRegex.test(lowerText)) {
      mentioned.push(member);
    }
  }

  return mentioned;
}

/**
 * Generates responses for group chats
 * If multiple characters are mentioned, all respond (matching ST base UI behavior)
 * @param {string} userText - The user's message text
 */
async function generateGroupResponses(userText) {
  const group = getCurrentGroup();
  if (!group) {
    await generateCharacterResponse();
    return;
  }

  const strategy = group.activation_strategy ?? 1; // 0=Natural, 1=List, 2=Pooled, 3=Manual

  // For Natural order (0), check for multiple mentions
  if (strategy === 0) {
    const mentioned = getMentionedCharacters(userText);

    if (mentioned.length > 1) {
      // Multiple characters mentioned - all should respond
      console.log(`[phone-ui] Multiple mentions detected: ${mentioned.map(m => m.name).join(', ')}`);

      for (const character of mentioned) {
        await generateCharacterResponseFor(character);
      }
      return;
    } else if (mentioned.length === 1) {
      // Single mention - that character responds
      console.log(`[phone-ui] Single mention: ${mentioned[0].name}`);
      await generateCharacterResponseFor(mentioned[0]);
      return;
    }
    // No mentions - fall through to normal selection
  }

  // For other strategies or no mentions, use standard single response
  await generateCharacterResponse();
}

/**
 * Generates a response for a specific character
 * @param {Object} character - Character object to generate response for
 */
async function generateCharacterResponseFor(character) {
  const context = getContext();

  // Show typing indicator
  showTypingIndicator();

  try {
    if (typeof context.generateQuietPrompt !== 'function') {
      throw new Error('SillyTavern context.generateQuietPrompt is not available');
    }

    const userName = context.name1 || 'User';
    const charName = character.name;
    const charId = character.avatar || character.name;
    const avatarUrl = character.avatar
      ? `/thumbnail?type=avatar&file=${encodeURIComponent(character.avatar)}`
      : '';

    const userPersona = context.persona || '';
    const conversationHistory = buildPhoneConversationPrompt();

    const members = getGroupMembers();
    const otherNames = members
      .filter(m => m.name !== charName)
      .map(m => m.name)
      .join(', ');

    const quietPrompt = `You are ${charName} texting in a group chat with ${userName}${otherNames ? ` and ${otherNames}` : ''}.
${userPersona ? `\nAbout ${userName}: ${userPersona}\n` : ''}
${conversationHistory}
Now reply as ${charName} only via text message. Do not speak for other characters. Keep it casual and in-character. Only output ${charName}'s text message reply, nothing else.`;

    const response = await context.generateQuietPrompt({ quietPrompt });

    if (response) {
      let characterText = response;
      if (characterText.startsWith('📱')) {
        characterText = characterText.replace(/^📱\s*/, '');
      }

      // Strip character name prefix if LLM included it
      const namePrefixPatterns = [
        new RegExp(`^${charName}:\\s*`, 'i'),
        new RegExp(`^\\S+\\s+${charName}:\\s*`, 'i'),
        new RegExp(`^[\\p{Emoji}\\s]+${charName}:\\s*`, 'iu'),
        new RegExp(`^\\[${charName}\\]\\s*`, 'i'),
        new RegExp(`^\\(${charName}\\)\\s*`, 'i'),
      ];

      for (const pattern of namePrefixPatterns) {
        if (pattern.test(characterText)) {
          characterText = characterText.replace(pattern, '').trim();
          break;
        }
      }

      if (!characterText) {
        console.warn(`[phone-ui] Empty response from ${charName} after cleanup`);
        return;
      }

      const characterMessage = addMessage({
        sender: 'character',
        text: characterText,
        characterId: charId,
        characterName: charName,
        avatarUrl: avatarUrl
      });

      appendMessageToViewport(characterMessage);
      await addMessageToMainChat(characterText, false, charName);
      playSoundEffect('receive');
    }
  } catch (error) {
    console.error(`[phone-ui] Error generating response for ${character.name}:`, error);
  } finally {
    hideTypingIndicator();
  }
}

/**
 * Generates character response using SillyTavern's API
 * Respects ST group settings for character selection
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
      // Get next character based on group settings
      const activeChar = getNextGroupCharacter();
      if (!activeChar) {
        console.warn('[phone-ui] No active character in group');
        hideTypingIndicator();
        return;
      }
      charName = activeChar.name;
      charId = activeChar.avatar || activeChar.name;
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

      // Strip character name prefix if LLM included it (handles various formats)
      // Matches: "Name:", "📱 Name:", "😊 Name:", "{emoji} Name:", etc.
      const namePrefixPatterns = [
        new RegExp(`^${charName}:\\s*`, 'i'),                    // "Name: text"
        new RegExp(`^\\S+\\s+${charName}:\\s*`, 'i'),            // "📱 Name: text" or "{emoji} Name: text"
        new RegExp(`^[\\p{Emoji}\\s]+${charName}:\\s*`, 'iu'),   // Multiple emojis before name
        new RegExp(`^\\[${charName}\\]\\s*`, 'i'),               // "[Name] text"
        new RegExp(`^\\(${charName}\\)\\s*`, 'i'),               // "(Name) text"
      ];

      for (const pattern of namePrefixPatterns) {
        if (pattern.test(characterText)) {
          characterText = characterText.replace(pattern, '').trim();
          break;
        }
      }

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
  $input.on('focus.phoneKeyboard', () => {
    setTimeout(() => {
      scrollToBottom();
      // Also scroll the input into view
      $input[0]?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
  });

  // Use visualViewport API if available (better keyboard detection)
  if (window.visualViewport && !visualViewportHandler) {
    visualViewportHandler = () => {
      if (isPhoneOpen) {
        const container = document.querySelector('.phone-ui-container');
        if (container) {
          // Adjust container height to match visible viewport
          // This handles keyboard open/close dynamically
          const availableHeight = window.visualViewport.height;
          const offsetTop = window.visualViewport.offsetTop;
          container.style.height = `${availableHeight - 16}px`; // 8px margin top + bottom
          container.style.top = `${offsetTop + 8}px`;
        }
        scrollToBottom();
      }
    };
    window.visualViewport.addEventListener('resize', visualViewportHandler);
  }
}

/**
 * Cleans up mobile keyboard handling listeners
 */
function cleanupMobileKeyboardHandling() {
  $('#phone-message-input').off('focus.phoneKeyboard');

  if (window.visualViewport && visualViewportHandler) {
    window.visualViewport.removeEventListener('resize', visualViewportHandler);
    visualViewportHandler = null;
  }

  // Reset any inline styles set by the handler
  const container = document.querySelector('.phone-ui-container');
  if (container) {
    container.style.height = '';
    container.style.top = '';
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
