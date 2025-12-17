/**
 * Context Bridge Module
 * Handles context transfer between regular chat and texting mode
 */

import { getContext } from "../../../../extensions.js";

/**
 * Loads recent chat context for texting mode
 * @param {number} messageCount - Number of recent messages to load (default: 5)
 * @returns {Array} Array of recent message objects
 */
export function loadRecentChatContext(messageCount = 5) {
  const context = getContext();

  if (!context.chat || context.chat.length === 0) {
    return [];
  }

  // Get last N messages from chat
  const recentMessages = context.chat.slice(-messageCount);

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
  const recentMessages = loadRecentChatContext(5);

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
 */
export async function addMessageToMainChat(text, isUser, characterName = null) {
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

  // Find the character's avatar for proper display in main chat
  let forceAvatar = null;
  if (!isUser && characterName) {
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
      characterName: characterName // Track which character in groups
    }
  };

  // Add to chat array
  context.chat.push(message);

  // Save and refresh the chat display
  await context.saveChat();

  // Trigger UI refresh by calling addOneMessage if available
  if (typeof context.addOneMessage === 'function') {
    await context.addOneMessage(message);
  }

  console.log('[st-text-messaging] Added phone message to main chat:', isUser ? 'user' : senderName);
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
