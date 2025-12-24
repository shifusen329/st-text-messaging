/**
 * Context Bridge Module
 * Handles context transfer between regular chat and texting mode
 */

import { getContext } from "../../../../extensions.js";

// Extension name for settings lookup
const extensionName = "st-text-messaging";

/**
 * Gets the extension settings
 * @returns {Object} Extension settings
 */
function getExtensionSettings() {
  const context = getContext();
  const settingsStore = context?.extensionSettings ?? window.extension_settings ?? {};
  return settingsStore[extensionName] || {};
}

/**
 * Loads recent chat context for texting mode
 * @param {number} [messageCount] - Number of recent messages to load (uses setting if not provided)
 * @returns {Array} Array of recent message objects
 */
export function loadRecentChatContext(messageCount) {
  const context = getContext();

  if (!context.chat || context.chat.length === 0) {
    return [];
  }

  // Use provided count, or fall back to settings, or default to 10
  const settings = getExtensionSettings();
  const count = messageCount ?? settings.contextMessageCount ?? 10;

  // Get last N messages from chat
  const recentMessages = context.chat.slice(-count);

  return recentMessages.map(msg => ({
    isUser: msg.is_user,
    text: msg.mes,
    name: msg.name,
    timestamp: msg.send_date
  }));
}

/**
 * Builds context bridge prompt for texting mode activation
 * Summarizes recent chat conversation to provide context
 * @returns {string} Context summary prompt
 */
export function buildContextBridgePrompt() {
  // Uses settings-based count from loadRecentChatContext
  const recentMessages = loadRecentChatContext();

  if (recentMessages.length === 0) {
    return "Start a new text conversation.";
  }

  let contextSummary = "RECENT CONVERSATION CONTEXT:\n";

  recentMessages.forEach(msg => {
    const speaker = msg.isUser ? "{{user}}" : "{{char}}";
    // Truncate long messages
    const text = msg.text.length > 100
      ? msg.text.substring(0, 100) + "..."
      : msg.text;
    contextSummary += `- ${speaker}: ${text}\n`;
  });

  contextSummary += "\nNow continue this conversation via text message in first-person.";

  return contextSummary;
}

/**
 * Summarizes texting conversation for injection back into main chat
 * @param {Array} messages - Array of phone messages
 * @returns {string} Summary of texting conversation
 */
export function summarizeTextingConversation(messages) {
  if (!messages || messages.length === 0) {
    return "nothing significant";
  }

  // Extract key topics/themes from messages
  const topics = [];

  messages.forEach(msg => {
    // Skip very short messages (reactions, emojis only)
    if (msg.text && msg.text.length > 20) {
      // Take first part of substantive messages
      const snippet = msg.text.substring(0, 60).trim();
      if (snippet && !topics.includes(snippet)) {
        topics.push(snippet);
      }
    }
  });

  // Return concise summary
  if (topics.length === 0) {
    return "brief casual conversation";
  }

  return topics.slice(0, 3).join("; ");
}

/**
 * Adds a phone message to the main SillyTavern chat
 * This keeps the main chat in sync with phone conversations
 * @param {string} text - Message text
 * @param {boolean} isUser - Whether this is a user message
 * @param {string} [characterName] - Optional character name (for group chats)
 * @param {number} [phoneMessageId] - Optional phone message ID for linking
 * @param {string} [avatarUrl] - Optional avatar URL (used for correct avatar in groups with duplicate names)
 * @returns {number} Index of the added message in chat array
 */
export async function addMessageToMainChat(text, isUser, characterName = null, phoneMessageId = null, avatarUrl = null) {
  const context = getContext();

  // Format as a text message in the main chat (avoid double emoji)
  const formattedText = text.startsWith('📱') ? text : `📱 ${text}`;

  // Determine the sender name
  // For groups, use the provided character name; otherwise fall back to context
  let senderName;
  if (isUser) {
    senderName = context.name1;
  } else {
    senderName = characterName || context.name2;
  }

  // Use provided avatar URL directly (handles duplicate character names correctly)
  // Fall back to name-based lookup only if no URL provided
  let forceAvatar = avatarUrl || null;
  if (!forceAvatar && !isUser && characterName) {
    const character = context.characters?.find(c => c.name === characterName);
    if (character?.avatar) {
      forceAvatar = `/thumbnail?type=avatar&file=${encodeURIComponent(character.avatar)}`;
    }
  }

  const message = {
    name: senderName,
    is_user: isUser,
    mes: formattedText,
    send_date: Date.now(),
    force_avatar: forceAvatar, // ST uses this to display correct avatar in groups
    extra: {
      isPhoneMessage: true,
      phoneMessageId: phoneMessageId, // Link back to phone message store
      characterName: characterName // Track which character in groups
    }
  };

  // Add to chat array
  const messageIndex = context.chat.length;
  context.chat.push(message);

  // Save and refresh the chat display
  await context.saveChat();

  // Trigger UI refresh by calling addOneMessage if available
  if (typeof context.addOneMessage === 'function') {
    await context.addOneMessage(message);
  }

  console.log('[st-text-messaging] Added phone message to main chat:', isUser ? 'user' : senderName);
  return messageIndex;
}

/**
 * Finds a message in main chat by phone message ID
 * @param {number} phoneMessageId - Phone message ID to find
 * @returns {number} Index of message in chat array, or -1 if not found
 */
export function findMainChatMessageIndex(phoneMessageId) {
  const context = getContext();
  if (!context.chat) return -1;

  return context.chat.findIndex(msg =>
    msg.extra?.phoneMessageId === phoneMessageId
  );
}

/**
 * Edits a message in the main SillyTavern chat
 * @param {number} phoneMessageId - Phone message ID to find and edit
 * @param {string} newText - New message text
 * @returns {boolean} True if edited successfully
 */
export async function editMessageInMainChat(phoneMessageId, newText) {
  const context = getContext();
  const index = findMainChatMessageIndex(phoneMessageId);

  if (index === -1) {
    console.warn('[st-text-messaging] Message not found in main chat for edit:', phoneMessageId);
    return false;
  }

  // Format the new text with phone emoji
  const formattedText = newText.startsWith('📱') ? newText : `📱 ${newText}`;

  // Update the message text
  context.chat[index].mes = formattedText;

  // Mark as edited in extra data
  if (!context.chat[index].extra) {
    context.chat[index].extra = {};
  }
  context.chat[index].extra.edited = true;
  context.chat[index].extra.editedAt = Date.now();

  // Save the chat
  await context.saveChat();

  // Refresh the UI - reloadCurrentChat if available, otherwise try to update DOM
  if (typeof context.reloadCurrentChat === 'function') {
    await context.reloadCurrentChat();
  }

  console.log('[st-text-messaging] Edited message in main chat:', phoneMessageId);
  return true;
}

/**
 * Deletes a message from the main SillyTavern chat
 * @param {number} phoneMessageId - Phone message ID to find and delete
 * @returns {boolean} True if deleted successfully
 */
export async function deleteMessageFromMainChat(phoneMessageId) {
  const context = getContext();
  const index = findMainChatMessageIndex(phoneMessageId);

  if (index === -1) {
    console.warn('[st-text-messaging] Message not found in main chat for delete:', phoneMessageId);
    return false;
  }

  // Remove the message from chat array
  context.chat.splice(index, 1);

  // Save the chat
  await context.saveChat();

  // Refresh the UI
  if (typeof context.reloadCurrentChat === 'function') {
    await context.reloadCurrentChat();
  }

  console.log('[st-text-messaging] Deleted message from main chat:', phoneMessageId);
  return true;
}

/**
 * Injects texting summary into main chat for context continuity (legacy)
 * @param {string} summary - Summary of texting conversation
 * @param {boolean} visible - Whether to show as visible message (default: false)
 */
export async function injectTextingSummaryIntoChat(summary, visible = false) {
  // This function is now mostly unused since we sync messages in real-time
  // Keeping for potential future use or narrative transitions
  if (!summary || summary === "nothing significant") {
    return;
  }

  const context = getContext();

  if (visible) {
    const narrativeMessage = {
      name: context.name2,
      is_user: false,
      mes: `*After a brief text conversation about ${summary}, ${context.name2} puts down the phone.*`,
      send_date: Date.now()
    };
    context.chat.push(narrativeMessage);
    await context.saveChat();

    if (typeof context.addOneMessage === 'function') {
      await context.addOneMessage(narrativeMessage);
    }
  }

  console.log('[st-text-messaging] Context summary injected into chat:', summary);
}

/**
 * Gets the current character's name
 * @returns {string} Character name or "Character"
 */
export function getCurrentCharacterName() {
  const context = getContext();
  return context.name2 || "Character";
}

/**
 * Gets the current user's name
 * @returns {string} User name or "User"
 */
export function getCurrentUserName() {
  const context = getContext();
  return context.name1 || "User";
}
