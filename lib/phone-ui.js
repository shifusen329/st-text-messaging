/**
 * Phone UI Module
 * Handles phone interface display, rendering, and interactions
 */

import { getContext, extension_settings } from "../../../../extensions.js";
import { addMessage, getMessages, getLastMessages, clearMessages, removeMessage, editMessage, restoreMessage, getMessageById, reconstructFromMainChat } from "./message-store.js";
import { activateTextingMode, deactivateTextingMode } from "./prompt-manager.js";
import { addMessageToMainChat, editMessageInMainChat, deleteMessageFromMainChat } from "./context-bridge.js";

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

  // Set isPhoneOpen BEFORE showing container (needed for mobile viewport handler)
  isPhoneOpen = true;

  // Show phone container with animation
  const $phoneContainer = $('#phone-ui-container');
  const animationsEnabled = extension_settings[extensionName]?.animationsEnabled ?? true;

  // On mobile, apply initial viewport sizing before display
  if (isMobileDevice()) {
    applyMobileViewportSize();
  }

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

  // Reconstruct phone messages from main chat if needed (e.g., after page reload)
  const reconstructedCount = reconstructFromMainChat();
  if (reconstructedCount > 0) {
    console.log(`[phone-ui] Restored ${reconstructedCount} messages from main chat`);
  }

  // Render existing messages
  renderAllMessages();

  // Activate texting mode (inject prompts + context)
  activateTextingMode();

  // Focus on input field
  $('#phone-message-input').focus();

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

  // Clean up message interaction handlers
  cleanupMessageInteractionHandlers();

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

  // Sync to main chat with phone message ID for linking
  await addMessageToMainChat(trimmedText, true, null, userMessage.id);

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
      await addMessageToMainChat(characterText, false, charName, characterMessage.id, avatarUrl);
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

      // Sync to main chat (pass character name, phone message ID, and avatar URL for proper attribution)
      await addMessageToMainChat(characterText, false, charName, characterMessage.id, avatarUrl);

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
  // Map type to actual filename: 'send' -> 'SendText', 'receive' -> 'ReceiveText'
  const filename = type === 'send' ? 'SendText' : 'ReceiveText';
  const soundPath = `${extensionFolderPath}/assets/audio/${filename}.ogg`;

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
 * Updates phone UI size based on settings
 */
export function updatePhoneSize() {
  const size = extension_settings[extensionName]?.phoneSize || 'normal';
  const $phoneContainer = $('#phone-ui-container');

  $phoneContainer.removeClass('size-normal size-large size-fullscreen');
  $phoneContainer.addClass(`size-${size}`);
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

// ============================================
// Message Edit/Delete Functionality
// ============================================

let activeMessageMenu = null; // Track currently open menu
let pendingDelete = null; // Track message pending deletion for undo
let deleteTimeout = null; // Timeout for permanent deletion

/**
 * Sets up message interaction handlers (long-press, right-click)
 */
function setupMessageInteractionHandlers() {
  const $viewport = $('#phone-viewport');

  // Long-press detection for mobile
  let pressTimer = null;
  let pressTarget = null;

  $viewport.on('touchstart', '.message-row', function (e) {
    pressTarget = this;
    pressTimer = setTimeout(() => {
      showMessageMenu(pressTarget, e.touches[0].clientX, e.touches[0].clientY);
    }, 500); // 500ms for long-press
  });

  $viewport.on('touchend touchmove touchcancel', '.message-row', function () {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  });

  // Right-click for desktop
  $viewport.on('contextmenu', '.message-row', function (e) {
    e.preventDefault();
    showMessageMenu(this, e.clientX, e.clientY);
  });

  // Close menu when clicking outside (use mousedown for more reliable detection)
  $(document).on('mousedown.phoneMenu touchstart.phoneMenu', function (e) {
    if (activeMessageMenu && !$(e.target).closest('.message-action-menu').length) {
      hideMessageMenu();
    }
  });

  // Close menu on scroll
  $viewport.on('scroll.phoneMenu', function () {
    hideMessageMenu();
  });
}

/**
 * Shows the message action menu
 * @param {HTMLElement} messageRow - The message row element
 * @param {number} x - X position for menu
 * @param {number} y - Y position for menu
 */
function showMessageMenu(messageRow, x, y) {
  hideMessageMenu(); // Close any existing menu

  const $row = $(messageRow);
  const messageId = $row.data('message-id');
  const isUser = $row.hasClass('user');
  const message = getMessageById(messageId);

  if (!message) return;

  // Build regenerate button HTML - only show for character messages
  const regenerateBtn = !isUser ? `
      <button class="message-action-btn message-action-regenerate" data-action="regenerate">
        <i class="fa-solid fa-rotate"></i>
        <span>Regenerate</span>
      </button>` : '';

  // Create menu HTML
  const menuHtml = `
    <div class="message-action-menu" data-message-id="${messageId}">
      <button class="message-action-btn" data-action="copy">
        <i class="fa-solid fa-copy"></i>
        <span>Copy</span>
      </button>
      <button class="message-action-btn" data-action="edit">
        <i class="fa-solid fa-pen"></i>
        <span>Edit</span>
      </button>
      ${regenerateBtn}
      <button class="message-action-btn message-action-delete" data-action="delete">
        <i class="fa-solid fa-trash"></i>
        <span>Delete</span>
      </button>
      <button class="message-action-btn message-action-cancel" data-action="cancel">
        <i class="fa-solid fa-xmark"></i>
        <span>Cancel</span>
      </button>
    </div>
  `;

  const $menu = $(menuHtml);
  $('body').append($menu);

  // Position menu near click/touch point
  const menuWidth = 160;
  const menuHeight = isUser ? 140 : 185; // Taller when regenerate button is shown
  const padding = 10;

  // Adjust position to stay within viewport
  let menuX = x;
  let menuY = y;

  if (menuX + menuWidth > window.innerWidth - padding) {
    menuX = window.innerWidth - menuWidth - padding;
  }
  if (menuX < padding) {
    menuX = padding;
  }
  if (menuY + menuHeight > window.innerHeight - padding) {
    menuY = y - menuHeight - 10;
  }
  if (menuY < padding) {
    menuY = padding;
  }

  $menu.css({
    left: menuX + 'px',
    top: menuY + 'px'
  });

  // Attach action handlers
  $menu.find('.message-action-btn').on('click', function () {
    const action = $(this).data('action');
    handleMessageAction(action, messageId);
  });

  activeMessageMenu = $menu;

  // Add highlight to message
  $row.addClass('message-selected');
}

/**
 * Hides the message action menu
 */
function hideMessageMenu() {
  if (activeMessageMenu) {
    const messageId = activeMessageMenu.data('message-id');
    $(`[data-message-id="${messageId}"]`).removeClass('message-selected');
    activeMessageMenu.remove();
    activeMessageMenu = null;
  }
}

/**
 * Handles message action menu clicks
 * @param {string} action - Action type (copy, edit, delete)
 * @param {number} messageId - Message ID
 */
function handleMessageAction(action, messageId) {
  hideMessageMenu();

  switch (action) {
    case 'copy':
      copyMessage(messageId);
      break;
    case 'edit':
      enterEditMode(messageId);
      break;
    case 'regenerate':
      regenerateFromMessage(messageId);
      break;
    case 'delete':
      deleteMessageWithUndo(messageId);
      break;
    case 'cancel':
      // Menu already hidden above
      break;
  }
}

/**
 * Copies message text to clipboard
 * @param {number} messageId - Message ID
 */
function copyMessage(messageId) {
  const message = getMessageById(messageId);
  if (!message) return;

  navigator.clipboard.writeText(message.text).then(() => {
    toastr.success('Message copied to clipboard');
  }).catch(() => {
    toastr.error('Failed to copy message');
  });
}

/**
 * Enters edit mode for a message
 * @param {number} messageId - Message ID
 */
function enterEditMode(messageId) {
  const message = getMessageById(messageId);
  if (!message) return;

  const $row = $(`[data-message-id="${messageId}"]`);
  const $bubble = $row.find('.message-bubble');
  const currentText = message.text;

  // Store original content for cancel
  $bubble.data('original-html', $bubble.html());
  $bubble.data('original-text', currentText);

  // Replace bubble content with edit UI
  const editHtml = `
    <div class="message-edit-container">
      <textarea class="message-edit-input" rows="1">${escapeHtml(currentText)}</textarea>
      <div class="message-edit-actions">
        <button class="message-edit-btn save" title="Save">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="message-edit-btn cancel" title="Cancel">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `;

  $bubble.addClass('editing').html(editHtml);

  const $textarea = $bubble.find('.message-edit-input');

  // Auto-resize textarea
  $textarea.on('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  }).trigger('input');

  // Focus and select text
  $textarea.focus().select();

  // Save on button click
  $bubble.find('.message-edit-btn.save').on('click', () => {
    saveEdit(messageId, $textarea.val());
  });

  // Cancel on button click
  $bubble.find('.message-edit-btn.cancel').on('click', () => {
    cancelEdit($bubble);
  });

  // Save on Enter (without shift), cancel on Escape
  $textarea.on('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit(messageId, $textarea.val());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit($bubble);
    }
  });
}

/**
 * Saves an edited message
 * @param {number} messageId - Message ID
 * @param {string} newText - New message text
 */
async function saveEdit(messageId, newText) {
  const trimmedText = newText.trim();
  if (!trimmedText) {
    toastr.warning('Message cannot be empty');
    return;
  }

  const $row = $(`[data-message-id="${messageId}"]`);
  const $bubble = $row.find('.message-bubble');

  // Update in message store
  const updatedMessage = editMessage(messageId, trimmedText);
  if (!updatedMessage) {
    toastr.error('Failed to edit message');
    cancelEdit($bubble);
    return;
  }

  // Update in main chat
  await editMessageInMainChat(messageId, trimmedText);

  // Update DOM
  const settings = extension_settings[extensionName] || {};
  const showTimestamps = settings.showTimestamps ?? false;
  const timestamp = formatTimestamp(updatedMessage.timestamp);

  $bubble.removeClass('editing').html(`
    <div class="message-text">${escapeHtml(trimmedText)}</div>
    <div class="message-edited-indicator">(edited)</div>
    ${showTimestamps ? `<div class="message-timestamp">${timestamp}</div>` : ''}
  `);

  toastr.success('Message edited');
}

/**
 * Cancels edit mode
 * @param {jQuery} $bubble - Message bubble element
 */
function cancelEdit($bubble) {
  const originalHtml = $bubble.data('original-html');
  $bubble.removeClass('editing').html(originalHtml);
}

/**
 * Deletes a message with undo option
 * @param {number} messageId - Message ID
 */
function deleteMessageWithUndo(messageId) {
  const $row = $(`[data-message-id="${messageId}"]`);

  // Get message info before removal
  const message = getMessageById(messageId);
  if (!message) return;

  // Find message index for proper restoration
  const messages = getMessages();
  const messageIndex = messages.findIndex(m => m.id === messageId);

  // Remove from store (returns the removed message)
  const removedMessage = removeMessage(messageId);
  if (!removedMessage) return;

  // Hide from DOM with animation
  $row.addClass('message-deleted');
  setTimeout(() => {
    $row.slideUp(200);
  }, 100);

  // Cancel any existing pending delete
  if (deleteTimeout) {
    clearTimeout(deleteTimeout);
    // If there was a pending delete, finalize it now
    if (pendingDelete) {
      finalizeDelete(pendingDelete.messageId);
    }
  }

  // Store pending delete info
  pendingDelete = {
    messageId: messageId,
    message: removedMessage,
    index: messageIndex,
    $row: $row
  };

  // Show undo toast
  showUndoToast();

  // Set timeout for permanent deletion
  deleteTimeout = setTimeout(() => {
    finalizeDelete(messageId);
  }, 5000);
}

/**
 * Shows the undo toast for deleted messages
 */
function showUndoToast() {
  // Remove existing undo toast
  $('#phone-undo-toast').remove();

  const toastHtml = `
    <div id="phone-undo-toast" class="phone-undo-toast">
      <span>Message deleted</span>
      <button id="phone-undo-btn" class="phone-undo-btn">Undo</button>
    </div>
  `;

  $('#phone-ui-container').append(toastHtml);

  // Animate in
  setTimeout(() => {
    $('#phone-undo-toast').addClass('visible');
  }, 10);

  // Handle undo click
  $('#phone-undo-btn').on('click', () => {
    undoDelete();
  });
}

/**
 * Hides the undo toast
 */
function hideUndoToast() {
  const $toast = $('#phone-undo-toast');
  $toast.removeClass('visible');
  setTimeout(() => {
    $toast.remove();
  }, 300);
}

/**
 * Undoes a pending delete
 */
function undoDelete() {
  if (!pendingDelete) return;

  // Cancel the timeout
  if (deleteTimeout) {
    clearTimeout(deleteTimeout);
    deleteTimeout = null;
  }

  // Restore message to store
  restoreMessage(pendingDelete.message, pendingDelete.index);

  // Restore DOM element
  const $row = pendingDelete.$row;
  $row.removeClass('message-deleted').slideDown(200);

  // Clear pending delete
  pendingDelete = null;

  // Hide toast
  hideUndoToast();

  toastr.info('Message restored');
}

/**
 * Finalizes a delete (removes from main chat)
 * @param {number} messageId - Message ID
 */
async function finalizeDelete(messageId) {
  if (pendingDelete && pendingDelete.messageId === messageId) {
    // Remove from main chat
    await deleteMessageFromMainChat(messageId);

    // Remove DOM element completely
    pendingDelete.$row.remove();

    // Clear pending delete
    pendingDelete = null;
  }

  // Hide toast
  hideUndoToast();

  // Clear timeout reference
  deleteTimeout = null;
}

/**
 * Regenerates response from a specific message
 * Deletes the target message and all subsequent messages, then regenerates
 * @param {number} messageId - Message ID to regenerate from
 */
async function regenerateFromMessage(messageId) {
  const message = getMessageById(messageId);
  if (!message || message.sender === 'user') {
    toastr.warning('Can only regenerate character messages');
    return;
  }

  // Cancel any pending delete
  if (deleteTimeout) {
    clearTimeout(deleteTimeout);
    if (pendingDelete) {
      finalizeDelete(pendingDelete.messageId);
    }
  }

  const messages = getMessages();
  const messageIndex = messages.findIndex(m => m.id === messageId);

  if (messageIndex === -1) {
    toastr.error('Message not found');
    return;
  }

  // Get info about the character who sent this message (for regenerating)
  const targetCharacterId = message.characterId;
  const targetCharacterName = message.characterName;

  // Collect all messages from this point onwards to delete
  const messagesToDelete = messages.slice(messageIndex);

  // Delete from phone store and main chat (in reverse order to maintain indices)
  for (let i = messagesToDelete.length - 1; i >= 0; i--) {
    const msgToDelete = messagesToDelete[i];

    // Remove from phone store
    removeMessage(msgToDelete.id);

    // Remove from main chat
    await deleteMessageFromMainChat(msgToDelete.id);

    // Remove from DOM
    $(`[data-message-id="${msgToDelete.id}"]`).remove();
  }

  console.log(`[phone-ui] Deleted ${messagesToDelete.length} messages for regeneration`);

  // Now regenerate - either for specific character (groups) or general
  if (isInGroupChat() && targetCharacterId) {
    // Regenerate for the specific character that was deleted
    await regenerateForCharacter(targetCharacterId, targetCharacterName);
  } else {
    // Single character chat - just regenerate
    await generateCharacterResponse();
  }

  toastr.success('Response regenerated');
}

/**
 * Regenerates response for a specific character in group chat
 * @param {string} characterId - Character ID to regenerate for
 * @param {string} characterName - Character name
 */
async function regenerateForCharacter(characterId, characterName) {
  const context = getContext();

  // Find the character object
  let character = null;
  if (context.characters) {
    // Try to find by ID first
    const charIndex = parseInt(characterId, 10);
    if (!isNaN(charIndex) && context.characters[charIndex]) {
      character = context.characters[charIndex];
    }
    // Fall back to name match
    if (!character) {
      character = context.characters.find(c => c.name === characterName);
    }
  }

  if (!character) {
    console.warn('[phone-ui] Could not find character for regeneration, falling back to general response');
    await generateCharacterResponse();
    return;
  }

  // Generate response for this specific character
  await generateResponseForCharacter(character);
}

/**
 * Cleans up message interaction handlers
 */
function cleanupMessageInteractionHandlers() {
  hideMessageMenu();
  hideUndoToast();

  if (deleteTimeout) {
    clearTimeout(deleteTimeout);
    // Finalize any pending delete immediately
    if (pendingDelete) {
      finalizeDelete(pendingDelete.messageId);
    }
  }

  $(document).off('mousedown.phoneMenu touchstart.phoneMenu');
  $('#phone-viewport').off('scroll.phoneMenu');
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
 * Applies initial mobile viewport sizing
 * Called before display to ensure proper dimensions on first open
 */
function applyMobileViewportSize() {
  const container = document.querySelector('.phone-ui-container');
  if (!container) return;

  // Use visualViewport if available for accurate sizing
  if (window.visualViewport) {
    const availableHeight = window.visualViewport.height;
    const offsetTop = window.visualViewport.offsetTop;
    container.style.height = `${availableHeight - 16}px`; // 8px margin top + bottom
    container.style.top = `${offsetTop + 8}px`;
  } else {
    // Fallback: use window.innerHeight
    container.style.height = `${window.innerHeight - 16}px`;
    container.style.top = '8px';
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

  // Setup message interaction handlers (long-press, right-click for edit/delete)
  setupMessageInteractionHandlers();

  // Apply initial position, size, theme, and color scheme
  updatePhonePosition();
  updatePhoneSize();
  updatePhoneTheme();
  updateColorScheme();

  console.log('[phone-ui] Phone UI initialized');
}
