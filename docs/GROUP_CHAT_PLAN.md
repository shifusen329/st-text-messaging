# Group Chat Implementation Plan

## Overview

This document outlines the implementation plan for adding group chat support to the st-text-messaging extension. The goal is to allow the phone UI to work with SillyTavern's group chat feature, displaying messages from multiple characters with proper identification.

## Current Architecture Analysis

### Key Limitations
1. **Message store keyed by single `characterId`** - breaks in group mode
2. **Header shows single avatar/name** - no group display
3. **Response generation uses `context.name2`** - undefined in groups
4. **Message rendering has no per-character identification** - just "user" vs "character"
5. **No detection of `context.groupId`** - doesn't know it's in a group

### Files Requiring Changes
- `lib/phone-ui.js` - UI rendering, response generation
- `lib/message-store.js` - Storage keyed by conversation, not character
- `lib/prompt-manager.js` - Group-aware prompt injection
- `lib/context-bridge.js` - Multi-character context handling
- `style.css` - Per-character colors, group header styling
- `phone-ui.html` - Group header template
- `index.js` - New settings for group behavior

---

## Implementation Phases

### Phase 1: Group Detection & Graceful Handling (~30 min)
**Goal**: Detect group mode and either handle gracefully or show informative warning

**Changes**:

1. **phone-ui.js - `openPhoneUI()`**
```javascript
export function openPhoneUI() {
  const context = getContext();

  // Check for group mode
  const isGroupChat = !!context.groupId;

  if (isGroupChat) {
    // For now, get group info for display
    const groupId = context.groupId;
    console.log('[phone-ui] Opening in group mode, groupId:', groupId);
  }

  // Don't open if no character/group selected
  if (context.characterId === undefined && !isGroupChat) {
    toastr.warning('Please select a character first');
    return;
  }

  // Continue with existing logic...
}
```

2. **Add helper function**:
```javascript
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

  // ST stores group data - need to investigate exact structure
  // This is a placeholder for the actual implementation
  const groups = context.groups || [];
  const group = groups.find(g => g.id === context.groupId);

  if (!group) return [];

  return group.members.map(memberId =>
    context.characters.find(c => c.avatar === memberId || c.name === memberId)
  ).filter(Boolean);
}
```

**Deliverable**: Extension detects group mode; no crashes when opening phone in group chat.

---

### Phase 2: Message Store Restructuring (~45 min)
**Goal**: Store messages by conversation (character or group), track per-message character info

**Changes to message-store.js**:

```javascript
// New store structure
// {
//   conversationKey: {
//     type: 'individual' | 'group',
//     participants: ['char1Name', 'char2Name'],  // For groups
//     messages: [
//       {
//         id: number,
//         sender: 'user' | 'character',
//         characterId: string,       // Which character (for group messages)
//         characterName: string,     // Display name
//         avatarUrl: string,
//         text: string,
//         timestamp: Date,
//         isFirstInSequence: boolean
//       }
//     ],
//     lastSender: string,           // 'user' or characterId
//   }
// }

/**
 * Gets conversation key for current context
 * For individual: characterId
 * For groups: groupId
 */
function getConversationKey() {
  const context = getContext();
  if (context.groupId) {
    return `group_${context.groupId}`;
  }
  return context.characterId ?? null;
}

/**
 * Adds a message with character tracking
 */
export function addMessage(message) {
  const conversationKey = getConversationKey();
  if (!conversationKey) {
    console.error('[message-store] No active conversation');
    return null;
  }

  initializeConversationStore(conversationKey);

  const fullMessage = {
    id: Date.now(),
    sender: message.sender,
    characterId: message.characterId || null,      // NEW: track which character
    characterName: message.characterName || 'Character',
    avatarUrl: message.avatarUrl || '',
    text: message.text,
    timestamp: new Date(),
    isFirstInSequence: isFirstInSequence(conversationKey, message)
  };

  messageStore[conversationKey].messages.push(fullMessage);
  messageStore[conversationKey].lastSender =
    message.sender === 'user' ? 'user' : message.characterId;

  return fullMessage;
}

/**
 * Determines if message is first in sequence from this sender
 * For groups, tracks by characterId not just 'user'/'character'
 */
function isFirstInSequence(conversationKey, message) {
  const store = messageStore[conversationKey];
  if (!store) return true;

  const lastSender = store.lastSender;

  if (message.sender === 'user') {
    return lastSender !== 'user';
  }

  // For characters in groups, compare characterId
  return lastSender !== message.characterId;
}
```

**Deliverable**: Message store properly tracks multi-character conversations.

---

### Phase 3: Message Rendering with Character Identification (~1 hour)
**Goal**: Show character name/avatar per message in group chats

**Changes to phone-ui.js - `appendMessageToViewport()`**:

```javascript
function appendMessageToViewport(message) {
  const $viewport = $('#phone-viewport');
  const settings = extension_settings[extensionName];
  const showTimestamps = settings?.showTimestamps ?? false;
  const timestamp = formatTimestamp(message.timestamp);
  const inGroupChat = isInGroupChat();

  // For group chats, show character name above their messages
  const showCharacterHeader = inGroupChat && message.sender === 'character';

  // Generate unique color class for character in groups
  const characterColorClass = inGroupChat && message.characterId
    ? `char-color-${hashCharacterId(message.characterId)}`
    : '';

  const messageHtml = `
    <div class="message-row ${message.sender} ${characterColorClass}"
         data-message-id="${message.id}"
         data-character-id="${message.characterId || ''}">
      ${showCharacterHeader && message.isFirstInSequence ? `
        <div class="message-character-header">
          ${message.avatarUrl ? `
            <img class="message-char-avatar"
                 src="${message.avatarUrl}"
                 alt="${escapeHtml(message.characterName)}">
          ` : ''}
          <span class="message-char-name">${escapeHtml(message.characterName)}</span>
        </div>
      ` : ''}
      <div class="message-bubble ${message.sender}">
        <div class="message-text">${escapeHtml(message.text)}</div>
        ${showTimestamps ? `<div class="message-timestamp">${timestamp}</div>` : ''}
      </div>
    </div>
  `;

  $viewport.append(messageHtml);
  scrollToBottom();
}

/**
 * Creates a hash from character ID for consistent color assignment
 */
function hashCharacterId(characterId) {
  let hash = 0;
  const str = String(characterId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 8; // 8 color variants
}
```

**CSS additions to style.css**:

```css
/* Character header in group messages */
.message-character-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  margin-left: 4px;
}

.message-char-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.message-char-name {
  font-size: 11px;
  font-weight: 600;
  color: #888;
}

/* Per-character color variants for group chats */
.message-row.char-color-0 .message-bubble.character { background: #3a3a4a; }
.message-row.char-color-1 .message-bubble.character { background: #2d4a3a; }
.message-row.char-color-2 .message-bubble.character { background: #4a2d3a; }
.message-row.char-color-3 .message-bubble.character { background: #3a4a2d; }
.message-row.char-color-4 .message-bubble.character { background: #4a3a2d; }
.message-row.char-color-5 .message-bubble.character { background: #2d3a4a; }
.message-row.char-color-6 .message-bubble.character { background: #4a4a2d; }
.message-row.char-color-7 .message-bubble.character { background: #3a2d4a; }
```

**Deliverable**: Messages show character name/avatar in groups; unique colors per character.

---

### Phase 4: Group-Aware Response Generation (~1 hour)
**Goal**: Generate responses from appropriate character(s) in group mode

**Changes to phone-ui.js - `generateCharacterResponse()`**:

```javascript
async function generateCharacterResponse() {
  const context = getContext();
  const inGroupChat = isInGroupChat();

  showTypingIndicator();

  try {
    let charName, charId, avatarUrl;

    if (inGroupChat) {
      // In group mode, get the character whose turn it is
      // ST manages turn order - we can hook into that
      const activeCharacter = getActiveGroupCharacter(context);

      if (!activeCharacter) {
        console.warn('[phone-ui] No active character in group');
        return;
      }

      charName = activeCharacter.name;
      charId = activeCharacter.avatar || activeCharacter.name; // ST uses avatar as ID sometimes
      avatarUrl = activeCharacter.avatar
        ? `/thumbnail?type=avatar&file=${encodeURIComponent(activeCharacter.avatar)}`
        : '';
    } else {
      // Single character mode (existing logic)
      charName = context.name2 || 'Character';
      charId = context.characterId;
      const character = context.characters[context.characterId];
      avatarUrl = character?.avatar
        ? `/thumbnail?type=avatar&file=${encodeURIComponent(character.avatar)}`
        : '';
    }

    const userName = context.name1 || 'User';
    const conversationHistory = buildPhoneConversationPrompt();

    // Build prompt differently for groups
    let quietPrompt;
    if (inGroupChat) {
      const otherMembers = getGroupMembers()
        .filter(m => m.name !== charName)
        .map(m => m.name);

      quietPrompt = `You are ${charName} texting in a group chat with ${userName}${otherMembers.length ? ` and ${otherMembers.join(', ')}` : ''}.

${conversationHistory}

Reply as ${charName} only. Keep your response short and text-message style. Do not speak for other characters.`;
    } else {
      quietPrompt = `You are ${charName} texting with ${userName}.

${conversationHistory}

Reply as ${charName}. Keep your response short and text-message style.`;
    }

    const response = await context.generateQuietPrompt(quietPrompt, false, false);

    // Clean and parse response
    let cleanedResponse = response
      .replace(new RegExp(`^${charName}:\\s*`, 'i'), '')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (!cleanedResponse) {
      console.warn('[phone-ui] Empty response from LLM');
      return;
    }

    // Add to store with character tracking
    const charMessage = addMessage({
      sender: 'character',
      text: cleanedResponse,
      characterId: charId,         // NEW: track which character
      characterName: charName,
      avatarUrl: avatarUrl
    });

    if (charMessage) {
      appendMessageToViewport(charMessage);
      addMessageToMainChat(charMessage.text, false, charName); // Pass character name
      playSoundEffect('receive');
    }

  } catch (error) {
    console.error('[phone-ui] Error generating character response:', error);
    toastr.error('Failed to generate response');
  } finally {
    hideTypingIndicator();
  }
}

/**
 * Gets the currently active character in a group (whose turn it is)
 */
function getActiveGroupCharacter(context) {
  // ST tracks which character should respond next
  // This may be in context.groupMembers or similar

  // For now, return the first group member
  // TODO: Hook into ST's actual turn order system
  const members = getGroupMembers();
  return members[0] || null;
}
```

**Deliverable**: Response generation works in group mode, attributing messages to correct character.

---

### Phase 5: Group Header UI (~45 min)
**Goal**: Display group info in phone header (multiple avatars, group name)

**Changes to phone-ui.html**:

```html
<div class="phone-header">
  <div class="phone-header-contact">
    <!-- Single character display (existing) -->
    <div id="phone-header-single" class="header-mode">
      <img id="phone-contact-avatar" class="phone-contact-avatar" src="" alt="">
      <span id="phone-contact-name">Messages</span>
    </div>

    <!-- Group display (new) -->
    <div id="phone-header-group" class="header-mode" style="display: none;">
      <div class="group-avatar-stack">
        <!-- Populated dynamically -->
      </div>
      <span id="phone-group-name">Group Chat</span>
    </div>
  </div>

  <button id="phone-close-btn" class="phone-header-btn" title="Close">
    <i class="fa-solid fa-xmark"></i>
  </button>
</div>
```

**Changes to phone-ui.js - `openPhoneUI()`**:

```javascript
export function openPhoneUI() {
  const context = getContext();
  const inGroupChat = isInGroupChat();

  // ... existing validation ...

  if (inGroupChat) {
    setupGroupHeader(context);
  } else {
    setupSingleHeader(context);
  }

  // ... rest of existing logic ...
}

function setupSingleHeader(context) {
  $('#phone-header-single').show();
  $('#phone-header-group').hide();

  const character = context.characters[context.characterId];
  const avatarFile = character?.avatar;
  const avatarUrl = avatarFile
    ? `/thumbnail?type=avatar&file=${encodeURIComponent(avatarFile)}`
    : '';

  $('#phone-contact-name').text(context.name2 || 'Character');
  $('#phone-contact-avatar').attr('src', avatarUrl).toggle(!!avatarUrl);
}

function setupGroupHeader(context) {
  $('#phone-header-single').hide();
  $('#phone-header-group').show();

  const members = getGroupMembers();
  const $avatarStack = $('.group-avatar-stack').empty();

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

  // Set group name
  const groupName = context.groupId || 'Group Chat';
  $('#phone-group-name').text(groupName);
}
```

**CSS additions**:

```css
/* Group header styling */
.group-avatar-stack {
  display: flex;
  align-items: center;
}

.group-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #1a1a1a;
  object-fit: cover;
}

#phone-header-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

#phone-group-name {
  font-weight: 600;
  color: #fff;
}
```

**Deliverable**: Phone header shows stacked avatars and group name in group mode.

---

### Phase 6: Prompt Injection for Groups (~30 min)
**Goal**: Inject group-aware context into LLM prompts

**Changes to prompt-manager.js**:

```javascript
/**
 * Gets group-aware texting prompt
 */
function getGroupTextingPrompt(intensity, characterName, groupMembers) {
  const otherNames = groupMembers
    .filter(m => m !== characterName)
    .join(', ');

  const basePrompt = getCurrentPrompt(); // Get the selected preset

  return `${basePrompt}

You are ${characterName} in a group text conversation.
Other participants: ${otherNames}
- Only respond as ${characterName}, never as other characters
- React naturally to what others have said
- Keep group dynamics in mind`;
}

export function activateTextingMode() {
  const context = getContext();
  const inGroupChat = !!context.groupId;

  if (inGroupChat) {
    // For groups, we may need different prompt handling
    // The active character changes, so prompt may need to be dynamic
    console.log('[prompt-manager] Activating group texting mode');
  }

  // ... existing activation logic ...
}
```

**Deliverable**: Prompts properly contextualize group conversations.

---

### Phase 7: Settings & Polish (~30 min)
**Goal**: Add settings for group behavior, polish UX

**New settings in index.js**:

```javascript
const defaultSettings = {
  // ... existing settings ...

  // Group chat settings
  showCharacterNamesInGroup: true,    // Show name above each character's message
  colorCodeCharacters: true,          // Different bubble colors per character
  groupResponseMode: 'active',        // 'active' | 'round-robin'
};
```

**Settings UI additions**:

```html
<div class="phone-settings-group">
  <h4>Group Chat</h4>

  <label class="checkbox-label">
    <input type="checkbox" id="phone-setting-show-char-names">
    <span>Show character names in group messages</span>
  </label>

  <label class="checkbox-label">
    <input type="checkbox" id="phone-setting-color-code">
    <span>Color-code messages by character</span>
  </label>
</div>
```

**Deliverable**: Users can customize group chat behavior.

---

## Testing Checklist

- [ ] Phone opens correctly in single character mode (no regression)
- [ ] Phone opens correctly in group mode
- [ ] Messages from different characters show correct names
- [ ] Messages from different characters have distinct colors
- [ ] Group header shows stacked avatars
- [ ] Response generation picks correct character
- [ ] Messages sync to main chat with correct attribution
- [ ] Switching between group/single chats works
- [ ] Settings persist and apply correctly
- [ ] Mobile layout works with group features

---

## Estimated Total Time: 4-5 hours

| Phase | Time | Description |
|-------|------|-------------|
| 1 | 30 min | Group detection & graceful handling |
| 2 | 45 min | Message store restructuring |
| 3 | 1 hour | Message rendering with character ID |
| 4 | 1 hour | Group-aware response generation |
| 5 | 45 min | Group header UI |
| 6 | 30 min | Prompt injection updates |
| 7 | 30 min | Settings & polish |

---

## Dependencies & Risks

### Dependencies
- Understanding of ST's `context.groupId` and group data structure
- How ST tracks turn order in groups
- Group member retrieval API

### Risks
- ST's group API may work differently than expected
- Turn order management could be complex
- Performance with many group members
- Message store migration for existing users

### Mitigation
- Phase 1 includes investigation of actual ST group API
- Fallback to simple behavior if turn order is unclear
- Limit displayed avatars to 3-4 in header
- Handle missing conversation keys gracefully
