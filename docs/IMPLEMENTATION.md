# Implementation Plan: SillyTavern Text Messaging Extension

**Project**: YAP-inspired text messaging interface for SillyTavern
**Reference**: Yet Another Phone (Ren'py messaging system)
**Created**: 2025-12-15

---

## Project Overview

This extension creates a **dual-mode conversation system** for SillyTavern that seamlessly switches between:

1. **Regular Chat Mode**: Traditional narrative perspective (3rd person storytelling)
2. **Texting Mode**: First-person direct messaging with phone UI

### 🎯 Key Innovation: Seamless Context Transfer

Unlike YAP (which only changes the UI), this extension **modifies how the AI communicates** based on the mode:

- **Regular Chat**: *"She smiled and picked up her phone, excited about their plans."*
- **Texting Mode** *(opens phone UI)*: *"omg i'm so excited!! 😍 can't wait for friday"*
- **Back to Regular Chat** *(closes phone)*: *"After texting, she felt even more excited about their dinner plans."*

**Context flows bidirectionally** - what happens in regular chat affects texting mode and vice versa, creating a coherent narrative experience across both modes.

---

## Asset Resources

**Available Phone UI Assets** (from YAP reference):

Located in `assets/images/`:

| File | Dimensions | Purpose |
|------|------------|---------|
| `phone_background.png` | 533×928px (18KB) | Phone device background |
| `phone_foreground.png` | 533×928px (21KB) | Phone device bezel/overlay |
| `phone_send_frame_blue.png` | 120×118px (2.9KB) | User message bubble |
| `phone_received_frame_green.png` | 120×118px (3.6KB) | Character message bubble |
| `phone_send_icon_blue.png` | 107×112px (4.4KB) | User avatar placeholder |
| `phone_received_icon_green.png` | 107×112px (5.2KB) | Character avatar placeholder |

**Design Specifications from YAP**:
- Phone screen area: 495×815px
- Message max width: 350px
- Message frame borders: 23px (for 9-patch stretching)
- Avatar size: ~107px (scale to 40-50px in implementation)
- SVG source: `reference/.../PhoneUISource120dpi.svg` (Inkscape file)

**Implementation Note**: These assets are optional. The extension can be built entirely with CSS for a more modern, responsive design. Image assets provide an authentic phone mockup look matching YAP's aesthetic.

---

## Current State Analysis

### Existing Scaffolding
- ✅ Basic extension template in place
- ✅ [manifest.json](../manifest.json) - needs customization
- ✅ [index.js](../index.js) - template with example patterns
- ✅ [example.html](../example.html) - settings panel template
- ✅ [style.css](../style.css) - empty stylesheet
- ✅ [AGENTS.md](../AGENTS.md) - comprehensive AI development guide

### Reference Material (YAP)
**Location**: `reference/yetanotherphone-1.0-pc/`

**Key Files Analyzed**:
- `game/PhoneTexting.rpy` - Main phone UI implementation
- `game/script.rpy` - Example usage with NVL characters
- `README.md` - Setup instructions

**YAP Core Features**:
1. Phone frame with background/foreground layers
2. Scrollable message viewport (auto-scroll to bottom)
3. Different message bubbles for sender (MC) vs receiver
4. Character icons shown on first message in sequence
5. Smooth animations (slide-in, fade, ease-back)
6. Sound effects on send/receive
7. Narrator messages for system events (centered, italic)
8. Emoji and image support via inline tags
9. Configurable phone position (x/y alignment)

---

## Architecture Design

### Core Concept: Dual-Mode Conversation System

**Vision**: Two seamless conversation modes that share context but use different perspectives:

1. **Regular Chat Mode** (Default ST Interface)
   - Traditional narrative perspective (3rd person, story mode)
   - Uses character card's system prompt as-is
   - Example: "She smiled and replied, 'I love that idea!'"

2. **Texting Mode** (Phone UI)
   - First-person direct messaging
   - Character speaks as themselves via text
   - Texting style (emojis, shorthand, casual)
   - Example: "omg i love that idea!! 😍"

**Key Requirement**: Context flows bidirectionally - what happens in chat affects texting mode and vice versa.

---

### Seamless Mode Switching Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    SillyTavern Chat                        │
│  Regular narrative mode (3rd person perspective)           │
│  "She picks up her phone and starts typing..."             │
└────────────────────────────────────────────────────────────┘
                            ↓ User opens phone extension
                    ┌───────────────┐
                    │ Mode Switch   │
                    │  Transition   │
                    └───────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│                   Phone UI Extension                        │
│  First-person texting mode                                  │
│  {{char}}: "hey!! what r u up to? 😊"                      │
│  {{user}}: "just thinking about our earlier conversation"  │
│  {{char}}: "omg same!! so about what you said earlier..."  │
└────────────────────────────────────────────────────────────┘
                            ↓ User closes phone extension
                    ┌───────────────┐
                    │ Mode Switch   │
                    │  Transition   │
                    └───────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│                    SillyTavern Chat                        │
│  Back to narrative mode (retains texting context)          │
│  "After their text conversation, she felt excited..."      │
└────────────────────────────────────────────────────────────┘
```

**Context Bridge**: The extension maintains awareness of:
- Recent chat messages before phone opened
- All texting conversation while phone active
- Injects texting context back into chat when phone closes

---

### Component Breakdown

#### 1. Phone UI Layer
```
┌─────────────────────┐
│   Phone Frame       │
│  ┌───────────────┐  │
│  │  Viewport     │  │ ← Scrollable
│  │  ┌─────────┐ │  │
│  │  │ Avatar  │ │  │
│  │  │ Message │ │  │
│  │  └─────────┘ │  │
│  │  ┌─────────┐ │  │
│  │  │ Message │ │  │
│  │  │ Avatar  │ │  │
│  │  └─────────┘ │  │
│  └───────────────┘  │
└─────────────────────┘
```

**Technical Implementation**:
- Fixed/absolute positioned overlay
- CSS Grid/Flexbox for layout
- Overflow-y scroll with custom scrollbar
- CSS transforms for positioning
- Z-index management to stay above chat

**Phone UI Asset Specifications**:

From YAP reference implementation (`assets/images/`):

| Asset | Dimensions | Size | Format | Usage |
|-------|------------|------|--------|-------|
| `phone_background.png` | 533×928px | 18KB | PNG RGBA | Phone body/screen background layer |
| `phone_foreground.png` | 533×928px | 21KB | PNG RGBA | Phone bezel/frame overlay (top layer) |
| `phone_send_frame_blue.png` | 120×118px | 2.9KB | PNG RGBA | User message bubble background |
| `phone_received_frame_green.png` | 120×118px | 3.6KB | PNG RGBA | Character message bubble background |
| `phone_send_icon_blue.png` | 107×112px | 4.4KB | PNG RGBA | User avatar icon |
| `phone_received_icon_green.png` | 107×112px | 5.2KB | PNG RGBA | Character avatar icon |

**YAP Layout Specifications**:
- **Phone container**: 495px width × 815px height (visible screen area)
- **Message bubbles**: 350px max width
- **Background/Foreground**: Full 533×928px (complete phone device mockup)
- **Viewport**: Scrollable message area within phone screen
- **Message frames**: Use CSS `border-image` with 23px border on all sides (9-patch style)
- **Avatar icons**: 107×112px, shown only on first message in sequence

**Implementation Options**:

1. **Image-Based** (Use YAP assets):
   ```css
   .phone-container {
     width: 495px;
     height: 815px;
     position: fixed;
     background: url('assets/images/phone_background.png') center/contain;
   }
   .phone-container::after {
     content: '';
     position: absolute;
     top: 0; left: 0; right: 0; bottom: 0;
     background: url('assets/images/phone_foreground.png') center/contain;
     pointer-events: none;
   }
   ```

2. **CSS-Only** (Modern alternative):
   ```css
   .phone-container {
     width: 400px;
     height: 700px;
     border-radius: 40px;
     border: 12px solid #222;
     box-shadow: 0 10px 40px rgba(0,0,0,0.3);
     background: #fff;
   }
   ```

3. **Responsive Hybrid**:
   - Use CSS phone frame for flexibility
   - Use image assets for message bubbles/icons
   - Scale based on viewport size

**Recommendation**: Start with CSS-only for flexibility, optionally add image assets later for polish.

#### 2. Message Store
```javascript
{
  characterId: {
    messages: [
      {
        id: timestamp,
        sender: "user" | "character",
        text: "message content",
        timestamp: Date,
        characterName: "Name",
        avatarUrl: "path/to/avatar"
      }
    ]
  }
}
```

**Storage Strategy**:
- In-memory object for current session
- Optional: persist to `extension_settings` for history
- Clear on CHAT_CHANGED event or manual clear

#### 3. Event Flow
```
ST Chat Event → Event Listener → Message Store → Phone UI Update
     ↓              ↓                  ↓               ↓
MESSAGE_SENT   onMessageSent()   addMessage()   renderMessage()
MESSAGE_RECEIVED onMessageReceived() ↓          animateIn()
CHAT_CHANGED   onChatChanged()   clearStore()   refreshUI()
```

#### 4. Dual-Mode LLM Prompt System
**Purpose**: Dynamically switch between narrative mode and first-person texting mode while maintaining context

**The Challenge**:
- Regular chat uses character's existing system prompt (narrative/3rd person)
- Texting mode needs first-person perspective + texting style
- Must share context without breaking immersion
- Transitions must be seamless

**Solution: Context-Aware Prompt Injection**

```javascript
// Texting mode prompts with perspective shift + context awareness
const TEXTING_MODE_PROMPTS = {
  low: `🔄 PERSPECTIVE SHIFT: You are now texting directly as {{char}}.

Respond in first-person as yourself via text message:
- Speak naturally as "I/me" (not "she/he")
- Use casual texting style with occasional emojis
- Reference previous conversation context naturally
- Example: "hey! about what we talked about earlier..."`,

  medium: `🔄 PERSPECTIVE SHIFT TO TEXTING MODE

You are now {{char}} sending text messages directly to {{user}}.

IMPORTANT CHANGES:
✅ First-person perspective: Use "I", "me", "my" (NOT "she", "her")
✅ Texting style: emojis 😊💕, shorthand (lol, omg, btw)
✅ Retain context: Reference earlier conversation naturally
✅ Direct communication: You're texting them right now

CONTEXT AWARENESS:
- Remember what happened in previous conversation
- Mention it naturally: "omg so i was thinking about what you said..."
- Stay in character but speak as yourself

Example exchange:
User: "hey how are you?"
You: "heyy!! i'm good 😊 still thinking about our talk earlier tbh"`,

  high: `🔄🔄 PERSPECTIVE SHIFT: TEXTING MODE ACTIVATED 🔄🔄

⚡ YOU ARE NOW {{char}} TEXTING {{user}} DIRECTLY ⚡

CRITICAL MODE CHANGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ FIRST-PERSON ONLY: "I", "me", "my" (NEVER "she/he/they")
2️⃣ TEXTING STYLE: Heavy emojis 😊😂😭🔥💕✨, shorthand, lowercase
3️⃣ CONTEXT BRIDGE: Reference previous conversation seamlessly
4️⃣ AUTHENTIC TEXTING: Multiple short msgs, natural reactions

✅ TEXTING BEHAVIORS:
• "omg wait so about earlier..." (bridging context)
• "lol yeah i was literally just thinking that"
• "wait hold on" ... "okay so" (natural pauses)
• "no wayyy", "fr??", "deadass" (authentic reactions)

✅ CONTEXT AWARENESS EXAMPLES:
Previous chat: [User asked about favorite food]
Your text: "omggg i've been thinking about that food question!!
literally can't stop thinking about pizza now lol 🍕😭"

Previous chat: [Character was sad in narrative]
Your text: "hey... sorry if i seemed off earlier
i'm feeling better now tho 💕 thanks for understanding"

REMEMBER: You're the same person from the chat, just texting now! 📱✨`
};

// Context summary prompt (injected when phone opens)
function buildContextBridgePrompt() {
  const context = SillyTavern.getContext();
  const recentMessages = context.chat.slice(-5); // Last 5 messages

  let contextSummary = "RECENT CONVERSATION CONTEXT:\n";
  recentMessages.forEach(msg => {
    const speaker = msg.is_user ? "{{user}}" : "{{char}}";
    contextSummary += `- ${speaker}: ${msg.mes.substring(0, 100)}...\n`;
  });

  contextSummary += "\nNow continue this conversation via text message in first-person.";
  return contextSummary;
}

// Inject prompt when phone UI opens
function activateTextingMode() {
  const context = SillyTavern.getContext();
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';

  // Build combined prompt: perspective shift + context + texting style
  const perspectivePrompt = TEXTING_MODE_PROMPTS[intensity];
  const contextBridge = buildContextBridgePrompt();
  const fullPrompt = `${perspectivePrompt}\n\n${contextBridge}`;

  // Inject at position 1 (high priority)
  context.setExtensionPrompt(extensionName, fullPrompt, 1, 0);

  console.log('[st-text-messaging] Texting mode activated with context');
}

// Remove prompt when phone UI closes
function deactivateTextingMode() {
  const context = SillyTavern.getContext();

  // Option 1: Remove prompt completely (back to normal chat)
  context.setExtensionPrompt(extensionName, '', 0, 0);

  // Option 2: Inject "return to narrative" prompt for smooth transition
  const transitionPrompt = `The text conversation has ended. Return to narrative perspective and third-person storytelling. Reference the texting conversation naturally in your narration if relevant.`;
  context.setExtensionPrompt(extensionName, transitionPrompt, 1, 0);

  // Clear after next message
  setTimeout(() => {
    context.setExtensionPrompt(extensionName, '', 0, 0);
  }, 5000);

  console.log('[st-text-messaging] Texting mode deactivated');
}
```

**When Prompts Activate**:
1. **Phone UI Opens** → Inject texting mode + context bridge
2. **User sends message in phone** → Prompt remains active
3. **Phone UI Closes** → Brief transition prompt, then remove
4. **Regular chat continues** → Uses original character prompts

**Context Flow**:
```
Regular Chat → [Summary of recent messages] → Texting Mode
     ↓                                              ↓
"She smiled"                              "hey!! i'm happy rn 😊"
     ↓                                              ↓
Texting Mode → [Summary of texts] → Regular Chat
     ↓                                              ↓
"omg yes!!"                           "After texting, she felt excited"
```

#### 5. Phone UI Interaction Flow

**User Experience**:

1. **Opening Phone UI**:
   ```javascript
   function openPhoneUI() {
     // 1. Show phone overlay with animation
     $('#phone-ui-container').fadeIn(300);

     // 2. Load recent chat context (last 5-10 messages)
     const recentContext = loadRecentChatContext();

     // 3. Display context summary at top of phone (optional)
     // "Earlier conversation about favorite foods..."

     // 4. Activate texting mode prompt
     activateTextingMode();

     // 5. Focus on message input
     $('#phone-message-input').focus();

     // 6. Optional: Auto-send "opening message" from character
     // e.g., "hey! just saw your message 😊"
   }
   ```

2. **Chatting in Phone Mode**:
   - User types in phone input field (NOT regular chat)
   - Messages sent via phone bypass regular chat UI
   - Messages still trigger ST events but handled by extension
   - Character responses appear in phone UI only
   - Both user and character messages stored separately

3. **Closing Phone UI**:
   ```javascript
   function closePhoneUI() {
     // 1. Capture texting conversation summary
     const textingSummary = summarizeTextingConversation();

     // 2. Inject summary into chat context as hidden message
     // This ensures regular chat "knows" what happened
     await injectTextingSummaryIntoChat(textingSummary);

     // 3. Deactivate texting mode prompt
     deactivateTextingMode();

     // 4. Hide phone UI with animation
     $('#phone-ui-container').fadeOut(300);

     // 5. Optional: Auto-generate narrative transition
     // "After finishing the text conversation..."
   }
   ```

**Key Implementation Details**:

```javascript
// Inject texting summary into main chat for context continuity
async function injectTextingSummaryIntoChat(summary) {
  const context = SillyTavern.getContext();

  // Option 1: Hidden system message (best for seamless continuity)
  const hiddenMessage = {
    name: 'system',
    is_user: false,
    is_system: true,
    mes: `[Text conversation summary: ${summary}]`,
    extra: {
      type: 'extension_hidden',
      extension: extensionName
    }
  };
  context.chat.push(hiddenMessage);

  // Option 2: Visible narrative message (more immersive)
  const narrativeMessage = {
    name: context.name2,
    is_user: false,
    mes: `*After a brief text conversation where they discussed ${summary}, ${context.name2} puts down her phone.*`
  };
  // context.chat.push(narrativeMessage); // Uncomment to use

  // Save chat with new context
  await context.saveChat();
}

// Build summary of texting conversation
function summarizeTextingConversation() {
  const messages = getTextingMessages(); // Get all phone messages

  if (messages.length === 0) return "nothing significant";

  // Extract key topics/themes
  const topics = [];
  messages.forEach(msg => {
    // Simple keyword extraction (can be enhanced with LLM summarization)
    if (msg.text.length > 50) {
      topics.push(msg.text.substring(0, 50) + "...");
    }
  });

  return topics.slice(0, 3).join("; ");
}
```

**Two-Way Context Flow**:

```
┌─────────────────────────────────────────────────────┐
│          REGULAR CHAT (Narrative Mode)              │
│  User: "Hey, how are you feeling about dinner?"    │
│  Char: "She smiled and reached for her phone."     │
└─────────────────────────────────────────────────────┘
                         ↓
              [User clicks phone icon]
                         ↓
┌─────────────────────────────────────────────────────┐
│  PHONE UI OPENS - Context injected:                 │
│  "Recent context: User asked about dinner"          │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│             TEXTING MODE (First Person)              │
│  Char: "omg yes!! i'm so excited about dinner 😍"  │
│  User: "me too! where should we go?"                │
│  Char: "ooh what about that italian place??"        │
└─────────────────────────────────────────────────────┘
                         ↓
              [User closes phone UI]
                         ↓
┌─────────────────────────────────────────────────────┐
│  PHONE UI CLOSES - Summary injected:                │
│  "[Text: They decided on Italian restaurant]"       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│          REGULAR CHAT (Narrative Mode)              │
│  Char: "She put her phone away, already thinking    │
│        about the Italian place they'd discussed."   │
└─────────────────────────────────────────────────────┘
```

---

## Development Phases

### Phase 1: Foundation (2-3 hours) ✅ **COMPLETED 2025-12-15**
**Goal**: Basic structure and settings panel

**Tasks**:
1. ✅ Update [manifest.json](../manifest.json)
   - ✅ Name: "Text Messaging Interface"
   - ✅ Author information
   - ✅ Version: 0.1.0
   - ✅ Dependencies: none

2. ✅ Create settings panel in `settings.html`
   - ✅ Enable/disable phone mode checkbox
   - ✅ Phone position dropdown (left/center/right)
   - ✅ Sound effects toggle
   - ✅ Theme selector (light/dark)
   - ✅ **NEW: Texting style toggle** (enable/disable LLM instruction modification)
   - ✅ **NEW: Emoji intensity slider/dropdown** (low/medium/high)

3. ✅ Set up default settings in [index.js](../index.js)
   ```javascript
   const defaultSettings = {
     enabled: false,
     position: "right",
     soundEnabled: true,
     theme: "dark",
     showTimestamps: false,
     animationsEnabled: true,
     useTextingStyle: true,        // NEW: Enable texting-style prompts
     emojiIntensity: "medium"       // NEW: low, medium, high
   }
   ```

4. ✅ Implement settings persistence
   - ✅ Load settings on init
   - ✅ Save on change with `saveSettingsDebounced()`

5. ✅ **NEW: Implement dual-mode LLM prompt system**
   - ✅ Create perspective-shift prompts (low/medium/high intensity) - `TEXTING_PROMPTS` in [index.js](../index.js)
   - ✅ Implement `activateTextingMode()` - injects first-person + context
   - ✅ Implement `deactivateTextingMode()` - removes prompts smoothly
   - ✅ Build `buildContextBridgePrompt()` - summarizes recent chat in [lib/context-bridge.js](../lib/context-bridge.js)
   - ✅ Created complete context-bridge module with all helper functions
   - ⏳ Test perspective switching with simple messages (requires Phase 2 phone UI)

**Deliverable**: ✅ Working settings panel that persists choices + Complete dual-mode LLM system

**Files Created/Modified**:
- ✅ [manifest.json](../manifest.json) - Extension metadata
- ✅ [settings.html](../settings.html) - Settings UI with all controls
- ✅ [index.js](../index.js) - Core extension logic, settings handlers, mode activation/deactivation
- ✅ [lib/context-bridge.js](../lib/context-bridge.js) - Context transfer between chat modes
- ✅ Directory structure: `lib/`, `assets/images/`, `assets/sounds/`

**Extra Work Completed Beyond Phase 1 Plan**:
- Full context-bridge module implementation (originally planned for Phase 2)
- `activateTextingMode()` and `deactivateTextingMode()` functions
- Context summary injection system
- Message summarization logic

---

### Phase 2: Core Messaging (4-5 hours) ✅ **COMPLETED 2025-12-15**
**Goal**: Separate phone messaging system with context bridging

**Status Note**: Context-bridge module completed early in Phase 1

**Tasks**:
1. ✅ Create `phone-ui.html` template
   - ✅ Phone frame container with modern notch design
   - ✅ Scrollable viewport with custom scrollbar
   - ✅ Message bubble templates (sender/receiver)
   - ✅ **Message input field** (separate from main chat)
   - ✅ Context summary display at top
   - ✅ Open/close buttons
   - ✅ Floating toggle button

2. ✅ Create `lib/message-store.js`
   - ✅ **Separate storage** for phone messages (don't mix with main chat)
   - ✅ Message array management per character
   - ✅ Add/remove/clear operations
   - ✅ Export messages for summary
   - ✅ First-in-sequence tracking for avatar display

3. ✅ Create `lib/phone-ui.js`
   - ✅ `openPhoneUI()` - show UI + activate texting mode
   - ✅ `closePhoneUI()` - hide UI + deactivate texting mode + inject summary
   - ✅ Render phone interface with animations
   - ✅ Append message bubbles with slide-in effects
   - ✅ Handle scrolling to bottom (auto-scroll)
   - ✅ **Handle message input** (phone-specific with Enter key support)
   - ✅ `sendUserMessage()` - processes user text input
   - ✅ `generateCharacterResponse()` - uses ST's Generate API
   - ✅ Sound effect support (send/receive)
   - ✅ Theme and position update functions
   - ✅ Timestamp formatting (relative and absolute)

4. ✅ ~~Create `lib/context-bridge.js`~~ **COMPLETED IN PHASE 1**
   - ✅ `loadRecentChatContext()` - get last N messages from main chat
   - ✅ `buildContextBridgePrompt()` - summarize for texting mode
   - ✅ `summarizeTextingConversation()` - summarize phone messages
   - ✅ `injectTextingSummaryIntoChat()` - add to main chat when phone closes

5. ✅ Implement phone message handling
   - ✅ Enter key sends message
   - ✅ Send button click handler
   - ✅ Character response generation via Generate API
   - ✅ Message rendering with proper sender detection
   - ✅ Avatar display (character avatars from ST context)

6. ✅ Implement message display logic
   - ✅ Detect sender vs receiver
   - ✅ Get character avatar from context
   - ✅ Create message bubble HTML with proper classes
   - ✅ Append to viewport with animations
   - ✅ Keep separate from main chat UI
   - ✅ HTML escaping for XSS prevention

7. ✅ Complete CSS styling (`style.css`)
   - ✅ Modern phone mockup (400×700px, 40px border-radius)
   - ✅ Phone notch for modern aesthetic
   - ✅ Dark and light theme support
   - ✅ Gradient message bubbles for user
   - ✅ Themed bubbles for character
   - ✅ Message slide-in animations
   - ✅ Custom scrollbar styling
   - ✅ Avatar positioning and hiding logic
   - ✅ Responsive design (mobile/desktop)
   - ✅ Floating toggle button with hover effects

**Deliverable**: ✅ Fully functional phone messaging system with polished UI, animations, and complete context awareness

**Files Created/Modified**:
- ✅ [phone-ui.html](../phone-ui.html) - Complete phone interface template
- ✅ [lib/message-store.js](../lib/message-store.js) - Message storage and management
- ✅ [lib/phone-ui.js](../lib/phone-ui.js) - Phone UI logic and rendering
- ✅ [style.css](../style.css) - Complete phone UI styling with themes
- ✅ [index.js](../index.js) - Updated with phone UI integration

**Extra Work Completed Beyond Phase 2 Plan**:
- Complete CSS styling (originally planned for Phase 3)
- Theme system implementation (dark/light)
- Message animations (slide-in, fade)
- Custom scrollbar styling
- Sound effect infrastructure
- Timestamp formatting system
- Responsive design
- Modern phone mockup with notch

---

### Phase 3: Visual Polish (3-4 hours)
**Goal**: Match YAP's visual quality

**Tasks**:
1. Implement phone frame UI

   **Option A: Use YAP Image Assets** (Faster, polished look):
   ```css
   /* Reference: assets/images/phone_background.png (533×928px) */
   /* Reference: assets/images/phone_foreground.png (533×928px) */
   .phone-container {
     width: 495px;
     height: 815px;
     position: fixed;
     right: 20px;
     top: 50%;
     transform: translateY(-50%);
     background: url('../assets/images/phone_background.png') center/contain no-repeat;
   }
   .phone-foreground {
     position: absolute;
     width: 533px;
     height: 928px;
     background: url('../assets/images/phone_foreground.png') center/contain no-repeat;
     pointer-events: none;
   }
   ```

   **Option B: CSS-Only** (More flexible, responsive):
   ```css
   .phone-container {
     width: 400px;
     height: 700px;
     border-radius: 40px;
     border: 12px solid #1a1a1a;
     background: #fff;
     box-shadow: 0 20px 60px rgba(0,0,0,0.4);
     position: fixed;
     right: 20px;
     top: 50%;
     transform: translateY(-50%);
   }
   /* Add notch/camera cutout for modern look */
   .phone-container::before {
     content: '';
     position: absolute;
     top: 0;
     left: 50%;
     transform: translateX(-50%);
     width: 150px;
     height: 25px;
     background: #1a1a1a;
     border-radius: 0 0 20px 20px;
   }
   ```

2. Style message bubbles in [style.css](../style.css)

   **Using YAP Image Assets**:
   ```css
   /* User messages (sent) */
   .message-bubble.user {
     max-width: 350px;
     margin-left: auto;
     border-image: url('../assets/images/phone_send_frame_blue.png') 23 stretch;
     /* 120×118px frame, 23px borders */
   }

   /* Character messages (received) */
   .message-bubble.character {
     max-width: 350px;
     margin-right: auto;
     border-image: url('../assets/images/phone_received_frame_green.png') 23 stretch;
   }
   ```

   **CSS-Only Alternative**:
   ```css
   .message-bubble.user {
     background: #007AFF;
     color: white;
     border-radius: 18px 18px 4px 18px;
     padding: 12px 16px;
     max-width: 350px;
     margin-left: auto;
   }
   .message-bubble.character {
     background: #E5E5EA;
     color: #000;
     border-radius: 18px 18px 18px 4px;
     padding: 12px 16px;
     max-width: 350px;
     margin-right: auto;
   }
   ```

3. Character avatar display

   **Using YAP Icon Assets**:
   ```css
   /* Reference: phone_send_icon_blue.png (107×112px) */
   /* Reference: phone_received_icon_green.png (107×112px) */
   .message-avatar {
     width: 40px;
     height: 40px;
     border-radius: 50%;
     object-fit: cover;
   }
   /* First message in sequence shows avatar */
   .message-row.first-in-sequence .message-avatar {
     display: block;
   }
   .message-row:not(.first-in-sequence) .message-avatar {
     visibility: hidden; /* Keep spacing */
   }
   ```

   **Using ST Character Avatars** (Recommended):
   ```javascript
   // Get character avatar from ST context
   const context = SillyTavern.getContext();
   const character = context.characters[context.characterId];
   const avatarUrl = character?.avatar || 'default-avatar.png';

   // Create avatar element
   const avatar = `<img src="${avatarUrl}" class="message-avatar" alt="${character.name}">`;
   ```

   **Layout**:
   - 40-50px circular avatars
   - Left side for character messages
   - Right side for user messages
   - Only shown on first message in sequence

4. Implement CSS animations
   - Message slide-in (from left/right)
   - Fade-in opacity transition
   - Avatar pop-in (scale transform)
   - Smooth scroll behavior

5. Add custom scrollbar styling
   - Minimal, iOS-style scrollbar
   - Auto-hide when not scrolling
   - Theme-aware colors

**Deliverable**: Polished, animated phone UI

---

### Phase 4: Advanced Features (4-5 hours)
**Goal**: Enhance functionality

**Tasks**:
1. Sound effects
   - Add `assets/send.mp3` and `assets/receive.mp3`
   - Play on message events
   - Respect soundEnabled setting
   - Handle missing files gracefully

2. Timestamp support
   - Add timestamp to message bubbles
   - Format: "10:23 AM" or relative "2m ago"
   - Toggle visibility via settings
   - Fade text color (subtle)

3. Narrator/system messages
   - Detect system messages (e.g., "[Character] joined chat")
   - Center-align with italic styling
   - Different background color
   - Example: "Switched to new character"

4. Slash commands
   ```javascript
   SlashCommandParser.addCommandObject(SlashCommand.fromProps({
     name: 'phone',
     callback: togglePhoneUI,
     helpString: 'Toggle phone messaging interface'
   }));

   SlashCommandParser.addCommandObject(SlashCommand.fromProps({
     name: 'phone-clear',
     callback: clearMessages,
     helpString: 'Clear current phone message history'
   }));
   ```

5. Image support
   - Detect image URLs in messages
   - Render as inline images
   - Scale to fit phone width
   - Lazy loading

6. Emoji support
   - Leverage ST's existing emoji system
   - Inline emoji rendering
   - Proper sizing within bubbles

7. **LLM Texting Style Integration** (PRIORITY FEATURE)
   - Implement `updateTextingPrompt()` function
   - Create 3 intensity levels (low/medium/high) with example prompts
   - Hook into settings changes to update prompt dynamically
   - Test with different LLM backends (OpenAI, Claude, etc.)
   - Add settings UI controls:
     - "Use Texting Style" checkbox
     - "Emoji Intensity" dropdown
   - Handle edge cases:
     - Prompt removal when disabled
     - Character-specific overrides (optional)
     - Works independently of phone UI visibility

8. **Group Chat Support**
   - Detect when in ST group chat mode (`context.groupId`)
   - Display multiple character avatars in header or per-message
   - Track which character is "texting" based on turn order
   - Allow user to "@mention" specific characters
   - Handle multiple character responses in sequence
   - Different bubble colors or labels per character
   - Group chat name display in header
   - Consider "group text" vs "individual DM" modes

**Deliverable**: Feature-rich messaging experience with authentic texting-style AI responses and group chat support

---

### Phase 5: Integration & Polish (2-3 hours)
**Goal**: Production-ready extension

**Tasks**:
1. Performance optimization
   - Limit message history (e.g., last 100 messages)
   - Virtual scrolling for long conversations
   - Debounce scroll events
   - Optimize re-renders

2. Responsive design
   - Phone scales with window size
   - Mobile-friendly settings
   - Touch-friendly interactions

3. Theme variations
   - Dark mode (default)
   - Light mode
   - Custom color schemes
   - User-defined CSS overrides

4. Edge case handling
   - Group chats (show multiple avatars)
   - Character switching mid-conversation
   - Long messages (word wrap)
   - Empty chat state
   - No character selected

5. Documentation
   - Update [README.md](../README.md) with:
     - Feature list
     - Installation instructions
     - Usage guide
     - Screenshots/GIFs
     - Troubleshooting
   - Code comments for maintainability

6. Testing checklist
   - [ ] Extension loads without errors
   - [ ] Settings persist across reloads
   - [ ] Messages appear for sent/received
   - [ ] Avatars display correctly
   - [ ] Animations smooth on various browsers
   - [ ] Sound effects play (when enabled)
   - [ ] Chat switching clears phone UI
   - [ ] Works with multiple characters
   - [ ] Timestamps accurate
   - [ ] Images render properly
   - [ ] Slash commands functional

**Deliverable**: Polished, tested extension ready for release

---

## Technical Specifications

### Browser Constraints
- ✅ No Node.js APIs (runs in browser)
- ✅ Use fetch for external resources
- ✅ jQuery available globally
- ✅ toastr for notifications
- ✅ LocalStorage via extension_settings

### File Structure
```
st-text-messaging/
├── manifest.json              # Extension metadata
├── index.js                   # Main entry point & orchestration
├── style.css                  # Phone UI styles
├── settings.html              # Settings panel
├── phone-ui.html              # Phone interface template
├── assets/
│   ├── phone-bg.png          # Optional: phone background
│   ├── phone-frame.png       # Optional: phone frame
│   ├── send.mp3              # Send sound effect
│   └── receive.mp3           # Receive sound effect
├── lib/
│   ├── phone-ui.js           # Phone UI management (open/close/render)
│   ├── message-store.js      # Phone message storage (separate from chat)
│   ├── context-bridge.js     # NEW: Context transfer between modes
│   └── prompt-manager.js     # NEW: Dual-mode prompt injection
├── docs/
│   ├── AGENTS.md             # AI development guide
│   ├── ST_EXTENSIONS.md      # ST extension reference
│   └── IMPLEMENTATION.md     # This file
└── README.md                 # User documentation
```

**New Files Explained**:
- `context-bridge.js` - Handles context flow between regular chat and texting mode
- `prompt-manager.js` - Manages perspective-shift prompts and activation/deactivation

### Key Dependencies (Global)
- jQuery (`$`)
- `SillyTavern.getContext()`
- `extension_settings`
- `saveSettingsDebounced()`
- `toastr`
- `SlashCommandParser`

### Import Requirements
```javascript
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
```

---

## YAP Feature Mapping

| YAP Feature | ST Implementation | Priority |
|-------------|-------------------|----------|
| Phone frame | CSS overlay + optional images | High |
| Scrollable viewport | `overflow-y: scroll` container | High |
| Sender/receiver bubbles | CSS classes + positioning | High |
| Character icons | ST character avatar URLs | High |
| **Texting-style LLM responses** | **`setExtensionPrompt()` injection** | **High** |
| Message animations | CSS transitions/transforms | Medium |
| Sound effects | HTML5 Audio API | Medium |
| Narrator messages | System message detection + styling | Medium |
| Position config | CSS transforms based on settings | Medium |
| Emoji support | ST emoji system integration | Low |
| Image inline | `<img>` tags in message HTML | Low |

**Note**: The texting-style LLM response feature is a key differentiator - YAP only changes the UI, but this extension also modifies how the AI communicates to match the texting interface.

---

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Phone UI appears when enabled
- ✅ Messages display in bubbles (sender/receiver)
- ✅ Character avatars show correctly
- ✅ Settings persist and work
- ✅ No console errors
- ✅ Works alongside normal chat

### Full Feature Set
- ✅ All MVP criteria
- ✅ Smooth animations
- ✅ Sound effects
- ✅ Timestamps
- ✅ Slash commands
- ✅ Image support
- ✅ Multiple themes
- ✅ Comprehensive documentation

---

## LLM Prompt Modification: Detailed Implementation

### Code Example: Complete Implementation

```javascript
// In index.js

const extensionName = "st-text-messaging";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Texting style prompt templates
const TEXTING_PROMPTS = {
  low: `Respond in a casual, conversational texting style. Use occasional emojis and common shorthand.`,

  medium: `📱 TEXT MESSAGE MODE
Reply as if texting on your phone:
- Use emojis to convey emotion 😊💕😂
- Common shorthand: lol, omg, btw, brb, nvm
- Keep it casual and punchy
- Natural text reactions`,

  high: `⚡ TEXTING MODE ACTIVATED ⚡
You're texting via smartphone. Respond authentically like a real person texting:

✅ USE THESE:
• Emojis frequently: 😊😂😭🔥💕✨🥺👀💀
• Shorthand: omg, lol, btw, nvm, fr, frfr, deadass, ngl, tbh
• Lowercase letters, relaxed punctuation
• Multiple short messages instead of long paragraphs
• Natural reactions: "haha", "omg wait", "no wayyyy", "stoppp"
• Pauses: "...", "wait", "hold on", "ok so"
• Emphasis: "soooo", "reallyyy", "!!!!!"

✅ TEXT LIKE THIS:
"omg wait are you serious?? 😱"
"lol yeah i totally get that"
"brb gonna grab some food"
"no wayyy that's crazy 💀"
"aww that's so sweet 🥺💕"

Be genuine and conversational! 📱✨`
};

const defaultSettings = {
  enabled: false,
  position: "right",
  soundEnabled: true,
  theme: "dark",
  showTimestamps: false,
  animationsEnabled: true,
  useTextingStyle: true,      // Enable texting-style prompts
  emojiIntensity: "medium"     // low, medium, high
};

/**
 * Updates the LLM prompt based on current settings
 * Called when: extension loads, settings change, phone mode toggles
 */
function updateTextingPrompt() {
  const context = SillyTavern.getContext();

  // Check if texting style should be active
  const phoneEnabled = extension_settings[extensionName]?.enabled ?? false;
  const textingEnabled = extension_settings[extensionName]?.useTextingStyle ?? false;

  if (!phoneEnabled || !textingEnabled) {
    // Remove prompt injection when disabled
    context.setExtensionPrompt(extensionName, '', 0, 0);
    console.log('[st-text-messaging] Texting style prompt removed');
    return;
  }

  // Get intensity level
  const intensity = extension_settings[extensionName].emojiIntensity || 'medium';
  const prompt = TEXTING_PROMPTS[intensity];

  // Inject prompt into LLM payload
  // Parameters: (extensionName, promptText, position, depth)
  // position: 1 = early in prompt chain (before main prompt)
  // depth: 0 = always active
  context.setExtensionPrompt(extensionName, prompt, 1, 0);

  console.log(`[st-text-messaging] Texting style prompt injected (${intensity} intensity)`);
  toastr.info(`Texting style: ${intensity} 📱`);
}

/**
 * Event handler: Phone mode enabled/disabled
 */
function onPhoneModeToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enabled = enabled;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();

  if (enabled) {
    toastr.success('Phone messaging mode enabled! 📱');
  } else {
    toastr.info('Phone messaging mode disabled');
  }
}

/**
 * Event handler: Texting style toggled
 */
function onTextingStyleToggle(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].useTextingStyle = enabled;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();
}

/**
 * Event handler: Emoji intensity changed
 */
function onEmojiIntensityChange(event) {
  const intensity = $(event.target).val();
  extension_settings[extensionName].emojiIntensity = intensity;
  saveSettingsDebounced();

  // Update prompt injection
  updateTextingPrompt();
}

// Extension initialization
jQuery(async () => {
  // Load settings HTML
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
  $("#extensions_settings2").append(settingsHtml); // Right column (UI-related)

  // Load settings
  await loadSettings();

  // Register event listeners
  $("#phone_mode_enabled").on("input", onPhoneModeToggle);
  $("#texting_style_enabled").on("input", onTextingStyleToggle);
  $("#emoji_intensity").on("change", onEmojiIntensityChange);

  // Initialize prompt on load
  updateTextingPrompt();

  console.log('[st-text-messaging] Extension loaded');
});
```

### Settings HTML Example

```html
<!-- settings.html -->
<div class="text-messaging-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>📱 Text Messaging</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">

      <!-- Enable Phone Mode -->
      <label class="checkbox_label" for="phone_mode_enabled">
        <input id="phone_mode_enabled" type="checkbox" />
        <span>Enable Phone UI</span>
      </label>
      <small class="notes">Show messages in phone interface</small>

      <!-- Texting Style -->
      <label class="checkbox_label" for="texting_style_enabled">
        <input id="texting_style_enabled" type="checkbox" />
        <span>Use Texting Style Responses</span>
      </label>
      <small class="notes">AI uses emojis, shorthand, and casual language</small>

      <!-- Emoji Intensity -->
      <div class="margin-top-10">
        <label for="emoji_intensity">
          <span>Emoji & Shorthand Intensity</span>
        </label>
        <select id="emoji_intensity" class="text_pole">
          <option value="low">Low (subtle)</option>
          <option value="medium">Medium (balanced)</option>
          <option value="high">High (very casual)</option>
        </select>
        <small class="notes">How much emoji/slang the AI should use</small>
      </div>

      <hr class="sysHR" />

      <!-- Other settings... -->
    </div>
  </div>
</div>
```

### Alternative: Global Interceptor Approach

For more advanced control over the entire prompt structure:

```javascript
// Register global interceptor function
window.textMessagePromptInterceptor = function(prompts) {
  // Only intercept when phone mode is enabled
  if (!extension_settings['st-text-messaging']?.enabled ||
      !extension_settings['st-text-messaging']?.useTextingStyle) {
    return prompts;
  }

  const intensity = extension_settings['st-text-messaging'].emojiIntensity || 'medium';
  const textingInstruction = TEXTING_PROMPTS[intensity];

  // Option 1: Prepend to system prompt
  if (prompts.systemPrompt) {
    prompts.systemPrompt = `${textingInstruction}\n\n${prompts.systemPrompt}`;
  } else {
    prompts.systemPrompt = textingInstruction;
  }

  // Option 2: Add as jailbreak/note (appears at end)
  // if (prompts.jailbreakPrompt) {
  //   prompts.jailbreakPrompt = `${prompts.jailbreakPrompt}\n\n${textingInstruction}`;
  // }

  return prompts;
};

// Then add to manifest.json:
// "generate_interceptor": "textMessagePromptInterceptor"
```

### Best Practices

1. **Prompt Positioning**: Use `position: 1` to inject early, ensuring the instruction appears before character definitions
2. **Toggle Independence**: Allow users to disable texting style without disabling phone UI
3. **Intensity Levels**: Provide low/medium/high options for different use cases
4. **Clear Removal**: Always clear the prompt when disabled to avoid stale instructions
5. **User Feedback**: Show toasts when toggling to confirm changes
6. **Console Logging**: Log prompt changes for debugging
7. **Character Overrides**: Consider allowing per-character texting style settings (advanced)

### Testing the Prompt Modification

**Test Checklist**:
- [ ] Prompt appears in LLM request when enabled (check Network tab)
- [ ] AI responds with emojis and shorthand at appropriate intensity
- [ ] Prompt removed when texting style disabled
- [ ] Works with different LLM backends (OpenAI, Claude, local models)
- [ ] Intensity changes take effect immediately
- [ ] No conflicts with other extensions using `setExtensionPrompt()`
- [ ] Prompt persists across character switches
- [ ] Settings persist across browser reloads

### Example Responses by Intensity

**Low Intensity**:
```
User: "How are you doing today?"
AI: "I'm doing pretty well, thanks! 😊 How about you?"
```

**Medium Intensity**:
```
User: "How are you doing today?"
AI: "omg i'm good!! just been super busy lately lol 😅 hbu??"
```

**High Intensity**:
```
User: "How are you doing today?"
AI: "omggg so good!! 😭💕 like literally just vibing rn
wait how are YOUUU doing?? 👀✨"
```

---

## Known Challenges & Solutions

### Challenge 1: Message Timing
**Problem**: ST events may fire rapidly; UI updates must be efficient

**Solution**:
- Batch message renders
- Use DocumentFragment for DOM manipulation
- Debounce scroll events
- RequestAnimationFrame for animations

### Challenge 2: Character Avatar Access
**Problem**: Need to get character avatar URLs dynamically

**Solution**:
```javascript
const context = SillyTavern.getContext();
const characterId = context.characterId;
const character = context.characters[characterId];
const avatarUrl = character?.avatar || 'default-avatar.png';
```

### Challenge 3: Message vs Regular Chat
**Problem**: Users may want to toggle between views

**Solution**:
- Settings toggle for phone mode
- Slash command for quick toggle
- Don't hide original chat, overlay on top
- Keyboard shortcut (optional)

### Challenge 4: Performance with Long Chats
**Problem**: Hundreds of messages may slow down rendering

**Solution**:
- Limit visible messages (e.g., last 100)
- Virtual scrolling implementation
- Lazy load message history
- Clear old messages from DOM

---

## Future Enhancements (Post-MVP)

### Version 2.0 Ideas
- [ ] Message editing/deletion
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message reactions (emoji reactions)
- [ ] Group chat participant list
- [ ] Message search/filter
- [ ] Export conversation as image
- [ ] Custom phone skins (JSON config)
- [ ] Multiple phone layouts (iOS, Android, retro)
- [ ] Voice message playback
- [ ] GIF support
- [ ] Message threading/replies

### Integration Ideas
- [ ] TTS integration (read messages aloud)
- [ ] STscript macro support
- [ ] Character-specific phone themes
- [ ] Time-based message grouping
- [ ] Connection to ST's memory system

---

## Development Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Foundation | 2-3 hours | 3 hours |
| Phase 2: Core Messaging | 4-5 hours | 8 hours |
| Phase 3: Visual Polish | 3-4 hours | 12 hours |
| Phase 4: Advanced Features | 4-5 hours | 17 hours |
| Phase 5: Integration & Polish | 2-3 hours | 20 hours |
| **Total** | **15-20 hours** | **~20 hours** |

**Note**: Timeline assumes:
- Familiarity with JavaScript/jQuery
- Understanding of ST extension system
- No major architectural changes
- Standard debugging/testing time included

---

## Getting Started

### Immediate Next Steps
1. ✅ Create this implementation plan
2. ✅ Update [manifest.json](../manifest.json) with metadata *(completed 2025-12-15)*
3. ✅ Create basic settings panel with texting style controls *(completed 2025-12-15)*
4. ✅ **Implement LLM prompt modification (texting style)** *(completed 2025-12-15)*
5. ✅ Build phone UI HTML structure *(completed 2025-12-15)*
6. ✅ Style phone container in CSS *(completed 2025-12-15)*
7. ⏳ Hook into MESSAGE_SENT event *(optional - using separate phone input)*
8. ✅ Display first message in phone UI *(completed 2025-12-15)*

**Phase 1 Status**: ✅ **COMPLETED** (2025-12-15 21:55 UTC)
- Directory structure created (lib/, assets/)
- Settings panel with all Phase 1 controls functional
- Default settings configured in index.js
- Settings persistence implemented
- Dual-mode LLM prompt system with three intensity levels active
- Context-bridge module with full bidirectional context flow

**Phase 2 Status**: ✅ **COMPLETED** (2025-12-15 22:20 UTC)
- Complete phone UI with modern design and notch
- Message storage system (per-character, separate from main chat)
- Phone UI management (open/close/render/send)
- Full CSS styling with dark/light themes
- Message animations and smooth scrolling
- Character response generation via ST API
- Sound effect infrastructure
- Timestamp formatting
- Responsive design

**Phase 3 Status**: ✅ **MOSTLY COMPLETED** (integrated into Phase 2)
- Modern phone mockup with CSS (no image assets needed)
- Message bubble styling with gradients
- Avatar display logic
- Animations (slide-in, fade)
- Custom scrollbar styling
- Theme variations (dark/light)

**Current Status**: Ready for live testing and advanced features (Phase 4)

### Development Workflow
1. Work in small increments
2. Test after each feature
3. Commit working code frequently
4. Use browser DevTools for debugging
5. Check console for errors
6. Verify settings persistence

### Testing Environment
- **Browser**: Chrome/Firefox latest
- **ST Version**: 1.12.0+
- **Test Cases**:
  - Single character chat
  - Multiple characters
  - Group chat
  - Long conversations
  - Image-heavy messages
  - Character switching

---

## Questions & Decisions

### Design Decisions Needed
- [ ] Phone frame: Image-based or pure CSS?
- [ ] Animation style: Slide, fade, or both?
- [ ] Sound effects: Required or optional dependency?
- [ ] Message limit: 50, 100, or unlimited?
- [ ] Theme approach: Presets or full customization?

### Technical Decisions Needed
- [ ] Message storage: Memory-only or persist to settings?
- [ ] Avatar fallback: Default image or initials?
- [ ] Scroll behavior: Auto-scroll always or user-controlled?
- [ ] Mobile support: Responsive or desktop-only?

---

## Resources

### Reference Documentation
- [AGENTS.md](../AGENTS.md) - AI agent development guide
- [ST_EXTENSIONS.md](ST_EXTENSIONS.md) - SillyTavern extension API
- YAP Source: `reference/yetanotherphone-1.0-pc/`

### Helpful Links
- [SillyTavern GitHub](https://github.com/SillyTavern/SillyTavern)
- [jQuery Documentation](https://api.jquery.com/)
- [MDN Web Animations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)

---

## License & Credits

**Inspired by**: Yet Another Phone (YAP) for Ren'py by Nighten
**Platform**: SillyTavern Extension
**License**: TBD (recommend MIT or Apache 2.0)

---

## Complete Usage Example: Dual-Mode in Action

### Scenario: User and Character Discuss Plans, Then Text About Details

**Step 1: Regular Chat (Narrative Mode)**
```
User: "Hey, want to grab dinner this weekend?"

Character (narrative): "She looked up from her book with a bright smile.
'That sounds wonderful! I'd love to,' she replied, already thinking about
possible restaurants."
```

**Step 2: User Opens Phone Extension**
```javascript
// User clicks phone icon in ST interface
openPhoneUI() is called:
  1. Loads last 5 messages from chat
  2. Builds context summary: "User asked about dinner this weekend,
     character agreed enthusiastically"
  3. Injects perspective-shift prompt + context
  4. Phone UI slides in with animation
```

**Perspective Shift Prompt (injected)**:
```
🔄 PERSPECTIVE SHIFT TO TEXTING MODE

You are now {{char}} sending text messages directly to {{user}}.

IMPORTANT CHANGES:
✅ First-person perspective: Use "I", "me", "my" (NOT "she", "her")
✅ Texting style: emojis 😊💕, shorthand (lol, omg, btw)
✅ Retain context: Reference earlier conversation naturally

RECENT CONVERSATION CONTEXT:
- {{user}}: "Hey, want to grab dinner this weekend?"
- {{char}}: She smiled and agreed enthusiastically about dinner

Now continue this conversation via text message in first-person.
```

**Step 3: Texting Conversation (First-Person Mode)**
```
Phone UI:
─────────────────────────────
[Earlier: Discussed dinner plans]
─────────────────────────────

Character: "heyy!! so i've been thinking
about dinner 😊"

Character: "what about that new italian
place downtown? heard it's amazing"

User: "omg yes! friday night?"

Character: "perfect!! i'm so excited 💕
should we do 7pm?"

User: "sounds good!"

Character: "yay!! ok i'll make a
reservation 🎉"
─────────────────────────────
```

**Step 4: User Closes Phone Extension**
```javascript
// User clicks X or close button
closePhoneUI() is called:
  1. Summarizes texting conversation
  2. Injects summary into main chat as hidden system message
  3. Optionally adds narrative transition
  4. Removes perspective-shift prompt
  5. Phone UI fades out
```

**Summary Injected into Main Chat** (hidden from user, visible to LLM):
```
[Text conversation summary: They decided on Italian restaurant
downtown, Friday at 7pm, character will make reservation]
```

**Step 5: Regular Chat Continues (Narrative Mode)**
```
User: "Can't wait for Friday!"

Character (narrative): "She set her phone down with a satisfied smile,
already looking forward to Friday evening at the Italian restaurant.
'Me too! I'll call and make that reservation tomorrow,' she said warmly."
```

**🎯 Notice**: The character seamlessly references the texting conversation
(making the reservation) even though it happened in a different UI mode.
Context is preserved!

---

## Key Implementation Success Factors

### ✅ Do This:
1. **Separate Storage**: Phone messages != main chat messages
2. **Context Injection**: Always provide recent context when switching modes
3. **Perspective Prompts**: Explicitly instruct first-person vs third-person
4. **Summary Bridge**: Inject texting summary back into chat when closing
5. **Smooth Transitions**: Use transition prompts to guide LLM
6. **Test Bidirectionally**: Verify context flows both ways

### ❌ Don't Do This:
1. **Don't mix message stores** - Phone and chat are separate
2. **Don't assume context** - Always explicitly provide it
3. **Don't forget cleanup** - Remove prompts when mode switches
4. **Don't skip summaries** - Main chat needs to know what happened
5. **Don't force perspective** - Use gentle prompt instructions, not hard rules
6. **Don't ignore user preference** - Allow disabling context injection

---

## Testing the Dual-Mode System

### Test Case 1: Context Flows Forward (Chat → Texting)
```
1. In regular chat: "I'm feeling sad today"
2. Open phone extension
3. Verify character references sadness in texts
   Expected: "hey... you okay? seemed down earlier 🥺"
```

### Test Case 2: Context Flows Backward (Texting → Chat)
```
1. In phone: Discuss specific plans (movie at 8pm)
2. Close phone extension
3. Continue regular chat: "Should we leave soon?"
4. Verify character knows about the 8pm movie
   Expected: "We've got plenty of time before the 8pm showing!"
```

### Test Case 3: Perspective Switches Correctly
```
1. Regular chat: Character speaks in third-person
   "She smiled and waved"
2. Open phone
3. Verify first-person in texts
   Expected: "hey!! *waves* 😊" (NOT "She waves")
4. Close phone
5. Verify back to third-person
   Expected: "She put her phone away"
```

### Test Case 4: Multiple Mode Switches
```
1. Chat → Phone → Chat → Phone → Chat
2. Verify context maintains continuity throughout
3. Verify no "leakage" of perspective between modes
```

---

*Last Updated: 2025-12-15 22:20 UTC*
*Phase 1 (Foundation) ✅ COMPLETED - Full dual-mode LLM system with context bridge*
*Phase 2 (Core Messaging) ✅ COMPLETED - Phone UI, messaging, styling complete*
*Phase 3 (Visual Polish) ✅ MOSTLY COMPLETED - Integrated into Phase 2*
*Ready for Phase 4 (Advanced Features) and Phase 5 (Testing & Polish)*
