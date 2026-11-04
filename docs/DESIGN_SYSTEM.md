# Flash Chat — Design System & Style Specification

**Version**: 2.5.0 (Dark Purple / Magenta Premium Final)  
**Palette Type**: Premium Dark Purple Night Canvas, Electric Magenta Action, Lavender Accents, High Contrast WCAG AAA  

---

## 1. Single Source of Truth Tokens

Flash Chat enforces a strictly curated 8-token semantic design palette. No unauthorized color classes, arbitrary hex values, or random gradients are permitted anywhere in client or server code.

### 1.1 Light Mode Palette

| Token Name | CSS Variable | Hex Value | Purpose / Usage | WCAG Ratio vs Surface |
|---|---|---|---|---|
| **Cream** | `--cream` | `#FAF5FF` | Soft luminous lavender-cream background canvas | Surface Base |
| **Card** | `--card` | `#FFFFFF` | Elevated surfaces, modals, bottom sheets, cards | Surface Highlight |
| **Primary** | `--primary` | `#E879F9` | Brand magenta-violet action buttons, active states | 7.23:1 (with Ink text) |
| **Secondary** | `--secondary` | `#EC4899` | Brand pink gradient stop, close friends, highlights | 3.53:1 (with White) |
| **Accent** | `--accent` | `#F43F5E` | Rose danger actions, error alerts, unread badges | 3.67:1 (with White) |
| **Ink** | `--ink` | `#1E1035` | High contrast deep purple typography, headings | 16.57:1 on Cream, 17.79:1 on Card |
| **Muted** | `--muted` | `#6B5B82` | Secondary subtitles, timestamps, placeholder text | 5.68:1 on Cream, 6.10:1 on Card |
| **Line** | `--line` | `#E9D5FF` | Subtle lavender borders, dividers, chip outlines | 3.1:1 UI Component Edge |

### 1.2 Dark Mode System Tokens (Premium Dark Purple / Magenta)

| Token Name | CSS Variable | Hex Value | Purpose / Usage | WCAG Ratio vs Surface |
|---|---|---|---|---|
| **Dark Canvas** | `--cream` | `#0B0814` | Deep night purple dark mode canvas | Surface Base |
| **Dark Card** | `--card` | `#17112A` | Elevated royal violet card surface | Surface Highlight |
| **Dark Ink** | `--ink` | `#FDF4FF` | Crisp high-contrast violet-white typography | 18.47:1 on Canvas, 17.01:1 on Card |
| **Dark Muted** | `--muted` | `#A78BFA` | Light pastel lavender subtext | 7.29:1 on Canvas, 6.71:1 on Card |
| **Dark Line** | `--line` | `#2E224F` | Deep violet border and container outlines | 3.2:1 UI Component Edge |
| **Primary** | `--primary` | `#D946EF` | Electric vibrant magenta | 5.28:1 on Dark Card |
| **Secondary** | `--secondary` | `#A855F7` | Neon violet accent | 3.96:1 on Dark Card |
| **Accent** | `--accent` | `#F43F5E` | Vibrant rose danger & badges | 3.67:1 on Dark Card |

---

## 2. Gradients, Shadows & Radii

### 2.1 Brand Gradient
- **Standard**: `linear-gradient(135deg, #A855F7 0%, #D946EF 50%, #EC4899 100%)`
- **Hover / Active**: `linear-gradient(135deg, #9333EA 0%, #C026D3 50%, #DB2777 100%)`
- **Usage**: Primary CTA buttons, unread story rings, active call buttons, Flash AI badge.

### 2.2 Shadow Scale
- **Soft (Light)**: `0 8px 30px rgba(249, 115, 22, 0.12)`
- **Soft (Dark)**: `0 8px 30px rgba(0, 0, 0, 0.40)`
- **Elevated Modals**: `0 20px 40px -15px rgba(0, 0, 0, 0.25)`

### 2.3 Border Radius Scale
- **`rounded-xl` (16px)**: Standard cards, list items, input fields, message bubbles.
- **`rounded-2xl` (24px)**: Modals, bottom sheets, hero banners, media previews.
- **`rounded-3xl` (32px)**: Large dialogue dialogs, floating action bars.
- **`rounded-full` (9999px)**: Avatars, action chips, status pills, icon buttons.

---

## 3. Touch Targets & Typography Rules

1. **Touch Target Size**: All interactive buttons, icon buttons, and navigation links enforce a minimum bounding box of **44x44px** on mobile viewports (`min-h-[44px]`).
2. **Font Scaling**: Standard typography uses `Inter` font with `16px` base input font size to prevent automatic iOS Safari viewport zoom upon input focus.
3. **Focus States**: High contrast `:focus-visible` ring of `2px solid var(--primary)` or `var(--ink)` with `2px` offset.
4. **Empty & Loading States**: Every list screen (Chats, Contacts, Support, Social, Pocket) implements structured `Skeleton` loaders and `EmptyState` fallbacks.

---

## 4. Brand Guidelines: Flash AI

- **Visible AI Assistant Name**: Strictly **Flash AI** across all screens, navigation tabs, buttons, and system messages.
- **Provider Disclosure**: The phrase *"Flash AI is powered by Google Gemini"* is restricted exclusively to the `AiProviderDisclosure` component and the first-time `AiConsentDialog`. No other visible UI contains the string "Gemini".
