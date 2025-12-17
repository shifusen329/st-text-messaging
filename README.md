# SillyTavern Text Messaging Extension

A phone-style messaging interface for SillyTavern that creates an immersive texting experience with your AI characters. Inspired by Yet Another Phone (YAP) for Ren'py.

## Features

### Dual-Mode Conversation System
- **Regular Chat Mode**: Traditional narrative perspective (3rd person storytelling)
- **Texting Mode**: First-person direct messaging with authentic texting style
- **Seamless Context Transfer**: What happens in chat affects texting and vice versa

### Phone UI
- Modern smartphone-style interface with dark/light themes
- iMessage-style color scheme option (blue/green bubbles)
- Smooth animations and custom scrollbar
- Character avatar display in header
- Timestamp support (relative and absolute)
- Sound effects for send/receive (optional)

### Group Chat Support
- Full group chat compatibility with multiple characters
- **Inherits all SillyTavern group settings automatically**:
  - Reply order strategies (Natural, List, Pooled, Manual)
  - Generation mode (Swap/Join character cards)
  - Allow self responses setting
  - Auto mode with configurable delay
  - Muted character handling
  - Talkativeness values
- Stacked avatar display in group header
- Color-coded message bubbles per character
- Inline character avatars next to messages

### Smart AI Responses
- Three intensity levels for texting style (low/medium/high)
- Automatic emoji and shorthand injection
- Custom prompt support for power users
- Context-aware responses that reference previous conversation

### Mobile Support
- Full-screen UI on mobile devices (no fake phone frame needed!)
- Touch-friendly controls with proper tap target sizes
- Virtual keyboard handling
- Safe area support for notched devices
- Multiple access methods configurable via settings

### Access Methods
All toggle methods are configurable in settings:
- **Floating Button**: Phone icon in corner (desktop-optimized)
- **Top Bar Icon**: Quick access near input area
- **Wand Menu Item**: "Open Phone" in extensions menu
- **Slash Command**: Type `/phone` to toggle

## Installation

### Via SillyTavern Extension Installer (Recommended)
1. Open SillyTavern
2. Go to Extensions > Install Extension
3. Enter the repository URL
4. Click Install

### Manual Installation
1. Navigate to your SillyTavern installation
2. Go to `public/scripts/extensions/third-party/`
3. Clone or copy this repository as `st-text-messaging`
4. Restart SillyTavern

## Usage

### Basic Usage
1. Enable the extension in Settings > Extensions > Text Messaging
2. Check "Enable Phone UI"
3. Click the phone icon (or use `/phone` command) to open
4. Start texting with your character!
5. Close the phone to return to normal chat

### Settings Overview

#### Main Settings
| Setting | Description |
|---------|-------------|
| Enable Phone UI | Master toggle for the extension |
| Use Texting Style | Enable AI texting behavior (emojis, shorthand) |
| Emoji Intensity | Low/Medium/High texting style intensity |
| Phone Position | Left/Center/Right placement |
| Phone Theme | Dark/Light appearance |
| Color Scheme | Default (purple) or iMessage (blue/green) |
| Sound Effects | Play sounds on send/receive |
| Show Timestamps | Display message times |
| Enable Animations | Smooth transitions and effects |

#### Toggle Access Options
| Setting | Description |
|---------|-------------|
| Floating Button | Show floating phone button (corner) |
| Top Bar Icon | Add phone icon near input |
| Wand Menu Item | Add to extensions menu |
| /phone Command | Enable slash command |

#### Group Chat Settings
| Setting | Description |
|---------|-------------|
| Show Character Avatars | Display character avatar next to their messages |
| Color Code Characters | Different bubble colors per character |

**Note**: Group chat behavior (reply order, generation mode, auto mode, etc.) is controlled through SillyTavern's native group settings panel, not this extension.

#### Advanced: Custom Prompt
For users who want full control over the AI's texting behavior:
- Enable "Use Custom Prompt" to edit the system prompt injection
- Use `{{char}}` and `{{user}}` placeholders for names
- Reset to Default button restores the preset prompt
- Preview Current shows active prompt

## How It Works

### Context Bridge
The extension maintains conversation context across modes:

1. **Opening Phone**: Recent chat messages are summarized and injected as context
2. **During Texting**: Messages sync to main chat (prefixed with 📱)
3. **Closing Phone**: Texting summary available for narrative continuity

### Perspective Switching
- **Regular Chat**: Character speaks in third person ("She smiled and replied...")
- **Texting Mode**: Character speaks as themselves ("omg yes!! 😊")

### Example Flow
```
Regular Chat: "She picked up her phone, excited to text you."
    ↓ [Open Phone]
Texting: "heyy!! what's up? 😊"
Texting: "i was just thinking about you lol"
    ↓ [Close Phone]
Regular Chat: "After texting, she felt even more excited about their plans."
```

### Group Chat Integration
The phone UI uses SillyTavern's native `/trigger` command for group generation, which means:
- All your group settings are respected automatically
- Character selection follows your configured reply order
- No separate configuration needed in the extension

## Prerequisites

- SillyTavern 1.12.0 or higher
- Any LLM backend (OpenAI, Claude, local models, etc.)

## Troubleshooting

### Phone won't open
- Make sure "Enable Phone UI" is checked in settings
- Check browser console for errors
- Try refreshing the page

### AI not using texting style
- Ensure "Use Texting Style" is enabled
- Try increasing the Emoji Intensity
- Some models respond better to higher intensity prompts

### Mobile issues
- If toggle button is hidden, try the `/phone` slash command
- Check Toggle Access Options in settings
- Ensure at least one access method is enabled

### Messages not syncing
- Check browser console for errors
- Verify character is selected before opening phone

## Support and Contributions

### Getting Help
- Open an issue on the GitHub repository
- Check existing issues for similar problems

### Contributing
Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear description

### Development
See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for technical details and architecture documentation.

## License

MIT License - See LICENSE file for details.

## Credits

- Inspired by [Yet Another Phone (YAP)](https://github.com/example/yap) for Ren'py by Nighten
- Built for [SillyTavern](https://github.com/SillyTavern/SillyTavern)
