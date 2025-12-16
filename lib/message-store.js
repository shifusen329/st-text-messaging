/**
 * Message Store Module
 * Manages phone message storage separately from main chat
 */

import { getContext } from "../../../../../extensions.js";

// In-memory message store (per character)
// Structure: { characterId: { messages: [...], lastSender: 'user'|'character' } }
const messageStore = {};

/**
 * Gets the current character ID
 * @returns {string|null} Character ID or null if no character active
 */
function getCurrentCharacterId() {
  const context = getContext();
  return context.characterId || null;
}

/**
 * Initializes message store for a character if not exists
 * @param {string} characterId - Character ID
 */
function initializeCharacterStore(characterId) {
  if (!messageStore[characterId]) {
    messageStore[characterId] = {
      messages: [],
      lastSender: null
    };
  }
}

/**
 * Adds a message to the phone message store
 * @param {Object} message - Message object
 * @param {string} message.sender - 'user' or 'character'
 * @param {string} message.text - Message text
 * @param {string} message.characterName - Character name
 * @param {string} message.avatarUrl - Avatar URL
 * @returns {Object} Added message with id and timestamp
 */
export function addMessage(message) {
  const characterId = getCurrentCharacterId();
  if (!characterId) {
    console.error('[message-store] No active character');
    return null;
  }

  initializeCharacterStore(characterId);

  const fullMessage = {
    id: Date.now(),
    sender: message.sender,
    text: message.text,
    characterName: message.characterName || 'Character',
    avatarUrl: message.avatarUrl || '',
    timestamp: new Date(),
    // Track if this is first message in sequence (for avatar display)
    isFirstInSequence: messageStore[characterId].lastSender !== message.sender
  };

  messageStore[characterId].messages.push(fullMessage);
  messageStore[characterId].lastSender = message.sender;

  console.log('[message-store] Message added:', fullMessage);

  return fullMessage;
}

/**
 * Gets all messages for current character
 * @returns {Array} Array of messages
 */
export function getMessages() {
  const characterId = getCurrentCharacterId();
  if (!characterId) {
    return [];
  }

  initializeCharacterStore(characterId);
  return messageStore[characterId].messages;
}

/**
 * Gets last N messages for current character
 * @param {number} count - Number of messages to retrieve
 * @returns {Array} Array of messages
 */
export function getLastMessages(count = 10) {
  const messages = getMessages();
  return messages.slice(-count);
}

/**
 * Clears all messages for current character
 */
export function clearMessages() {
  const characterId = getCurrentCharacterId();
  if (!characterId) {
    return;
  }

  if (messageStore[characterId]) {
    messageStore[characterId].messages = [];
    messageStore[characterId].lastSender = null;
  }

  console.log('[message-store] Messages cleared for character:', characterId);
}

/**
 * Clears all messages for all characters
 */
export function clearAllMessages() {
  Object.keys(messageStore).forEach(key => {
    delete messageStore[key];
  });

  console.log('[message-store] All messages cleared');
}

/**
 * Gets message count for current character
 * @returns {number} Number of messages
 */
export function getMessageCount() {
  return getMessages().length;
}

/**
 * Removes a specific message by ID
 * @param {number} messageId - Message ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeMessage(messageId) {
  const characterId = getCurrentCharacterId();
  if (!characterId || !messageStore[characterId]) {
    return false;
  }

  const index = messageStore[characterId].messages.findIndex(msg => msg.id === messageId);
  if (index !== -1) {
    messageStore[characterId].messages.splice(index, 1);
    console.log('[message-store] Message removed:', messageId);
    return true;
  }

  return false;
}

/**
 * Exports messages for summary/backup
 * @returns {Array} Array of message objects
 */
export function exportMessages() {
  const characterId = getCurrentCharacterId();
  if (!characterId || !messageStore[characterId]) {
    return [];
  }

  return messageStore[characterId].messages.map(msg => ({
    sender: msg.sender,
    text: msg.text,
    timestamp: msg.timestamp
  }));
}

/**
 * Gets the entire message store (for debugging)
 * @returns {Object} Complete message store
 */
export function getStore() {
  return messageStore;
}
