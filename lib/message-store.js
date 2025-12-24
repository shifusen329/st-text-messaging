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
 * @returns {Object|null} Removed message object (for undo), or null if not found
 */
export function removeMessage(messageId) {
  const conversationKey = getConversationKey();
  if (!conversationKey || !messageStore[conversationKey]) {
    return null;
  }

  const store = messageStore[conversationKey];
  const index = store.messages.findIndex(msg => msg.id === messageId);
  if (index !== -1) {
    const removedMessage = store.messages.splice(index, 1)[0];

    // Update lastSender if we removed the last message
    if (store.messages.length === 0) {
      store.lastSender = null;
    } else if (index === store.messages.length) {
      // Removed the last message, update lastSender to previous message's sender
      const lastMsg = store.messages[store.messages.length - 1];
      if (lastMsg.sender === 'user') {
        store.lastSender = 'user';
      } else if (lastMsg.characterId) {
        store.lastSender = lastMsg.characterId;
      } else {
        store.lastSender = 'character';
      }
    }

    console.log('[message-store] Message removed:', messageId);
    return removedMessage;
  }

  return null;
}

/**
 * Edits a message's text by ID
 * @param {number} messageId - Message ID to edit
 * @param {string} newText - New message text
 * @returns {Object|null} Updated message object, or null if not found
 */
export function editMessage(messageId, newText) {
  const conversationKey = getConversationKey();
  if (!conversationKey || !messageStore[conversationKey]) {
    return null;
  }

  const message = messageStore[conversationKey].messages.find(msg => msg.id === messageId);
  if (message) {
    message.text = newText;
    message.edited = true;
    message.editedAt = new Date();
    console.log('[message-store] Message edited:', messageId);
    return message;
  }

  return null;
}

/**
 * Restores a previously removed message
 * @param {Object} message - Message object to restore
 * @param {number} [atIndex] - Optional index to insert at
 * @returns {boolean} True if restored successfully
 */
export function restoreMessage(message, atIndex = null) {
  const conversationKey = getConversationKey();
  if (!conversationKey || !message) {
    return false;
  }

  initializeConversationStore(conversationKey);
  const store = messageStore[conversationKey];

  if (atIndex !== null && atIndex >= 0 && atIndex <= store.messages.length) {
    store.messages.splice(atIndex, 0, message);
  } else {
    // Find correct position based on timestamp
    const insertIndex = store.messages.findIndex(m => m.id > message.id);
    if (insertIndex === -1) {
      store.messages.push(message);
    } else {
      store.messages.splice(insertIndex, 0, message);
    }
  }

  // Update lastSender based on the last message
  const lastMsg = store.messages[store.messages.length - 1];
  if (lastMsg) {
    if (lastMsg.sender === 'user') {
      store.lastSender = 'user';
    } else if (lastMsg.characterId) {
      store.lastSender = lastMsg.characterId;
    } else {
      store.lastSender = 'character';
    }
  }

  console.log('[message-store] Message restored:', message.id);
  return true;
}

/**
 * Gets a message by ID
 * @param {number} messageId - Message ID to find
 * @returns {Object|null} Message object or null if not found
 */
export function getMessageById(messageId) {
  const conversationKey = getConversationKey();
  if (!conversationKey || !messageStore[conversationKey]) {
    return null;
  }

  return messageStore[conversationKey].messages.find(msg => msg.id === messageId) || null;
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
