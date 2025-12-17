/**
 * Message Store Module
 * Manages phone message storage separately from main chat
 * Supports both individual character chats and group chats
 */

import { getContext } from "../../../../extensions.js";

// In-memory message store (per conversation - character or group)
// Structure:
// {
//   conversationKey: {
//     type: 'individual' | 'group',
//     messages: [
//       {
//         id: number,
//         sender: 'user' | 'character',
//         characterId: string|null,     // Which character sent this (for groups)
//         characterName: string,
//         avatarUrl: string,
//         text: string,
//         timestamp: Date,
//         isFirstInSequence: boolean
//       }
//     ],
//     lastSender: string  // 'user' or characterId (for groups)
//   }
// }
const messageStore = {};

/**
 * Gets the conversation key for current context
 * For individual chats: characterId
 * For group chats: group_<groupId>
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
 * Checks if currently in a group chat
 * @returns {boolean}
 */
function isInGroupChat() {
  const context = getContext();
  return !!context.groupId;
}

/**
 * Initializes message store for a conversation if not exists
 * @param {string} conversationKey - Conversation key
 */
function initializeConversationStore(conversationKey) {
  if (!messageStore[conversationKey]) {
    messageStore[conversationKey] = {
      type: conversationKey.startsWith('group_') ? 'group' : 'individual',
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
 * @param {string} [message.characterId] - Character ID (for group chats)
 * @returns {Object} Added message with id and timestamp
 */
export function addMessage(message) {
  const conversationKey = getConversationKey();
  if (!conversationKey) {
    console.error('[message-store] No active conversation');
    return null;
  }

  initializeConversationStore(conversationKey);

  const inGroup = isInGroupChat();
  const store = messageStore[conversationKey];

  // Determine if this is first in sequence
  // For groups: compare characterId, not just 'user'/'character'
  let isFirstInSequence;
  if (message.sender === 'user') {
    isFirstInSequence = store.lastSender !== 'user';
  } else if (inGroup && message.characterId) {
    // In groups, check if same character as last
    isFirstInSequence = store.lastSender !== message.characterId;
  } else {
    isFirstInSequence = store.lastSender !== 'character';
  }

  const fullMessage = {
    id: Date.now(),
    sender: message.sender,
    characterId: message.characterId || null,  // Track which character (for groups)
    text: message.text,
    characterName: message.characterName || 'Character',
    avatarUrl: message.avatarUrl || '',
    timestamp: new Date(),
    isFirstInSequence: isFirstInSequence
  };

  store.messages.push(fullMessage);

  // Track last sender - for groups, use characterId
  if (message.sender === 'user') {
    store.lastSender = 'user';
  } else if (inGroup && message.characterId) {
    store.lastSender = message.characterId;
  } else {
    store.lastSender = 'character';
  }

  console.log('[message-store] Message added:', fullMessage);

  return fullMessage;
}

/**
 * Gets all messages for current conversation (character or group)
 * @returns {Array} Array of messages
 */
export function getMessages() {
  const conversationKey = getConversationKey();
  if (!conversationKey) {
    return [];
  }

  initializeConversationStore(conversationKey);
  return messageStore[conversationKey].messages;
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
 * Clears all messages for current conversation (character or group)
 */
export function clearMessages() {
  const conversationKey = getConversationKey();
  if (!conversationKey) {
    return;
  }

  if (messageStore[conversationKey]) {
    messageStore[conversationKey].messages = [];
    messageStore[conversationKey].lastSender = null;
  }

  console.log('[message-store] Messages cleared for conversation:', conversationKey);
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
  const conversationKey = getConversationKey();
  if (!conversationKey || !messageStore[conversationKey]) {
    return false;
  }

  const index = messageStore[conversationKey].messages.findIndex(msg => msg.id === messageId);
  if (index !== -1) {
    messageStore[conversationKey].messages.splice(index, 1);
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
  const conversationKey = getConversationKey();
  if (!conversationKey || !messageStore[conversationKey]) {
    return [];
  }

  return messageStore[conversationKey].messages.map(msg => ({
    sender: msg.sender,
    characterId: msg.characterId,
    characterName: msg.characterName,
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
