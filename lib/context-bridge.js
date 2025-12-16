/**
 * Context Bridge Module
 * Handles context transfer between regular chat and texting mode
 */

import { getContext } from "../../../extensions.js";

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
 * Injects texting summary into main chat for context continuity
 * @param {string} summary - Summary of texting conversation
 * @param {boolean} visible - Whether to show as visible message (default: false)
 */
export async function injectTextingSummaryIntoChat(summary, visible = false) {
  const context = getContext();

  if (visible) {
    // Option 2: Visible narrative message (more immersive)
    const narrativeMessage = {
      name: context.name2,
      is_user: false,
      mes: `*After a brief text conversation about ${summary}, ${context.name2} puts down the phone.*`,
      send_date: new Date().toISOString()
    };
    context.chat.push(narrativeMessage);
  } else {
    // Option 1: Hidden system message (best for seamless continuity)
    const hiddenMessage = {
      name: 'system',
      is_user: false,
      is_system: true,
      mes: `[Text conversation summary: ${summary}]`,
      send_date: new Date().toISOString(),
      extra: {
        type: 'extension_hidden',
        extension: 'st-text-messaging'
      }
    };
    context.chat.push(hiddenMessage);
  }

  // Save chat with new context
  await context.saveChat();

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
