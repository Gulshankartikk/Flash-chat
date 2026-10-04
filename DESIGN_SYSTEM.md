# Flash Chat — Design System & Style Specification

**Version**: 2.0.0 (Part B-3 Final)  
**Palette Type**: Warm Cream, Vibrant Coral-Pink Brand Gradient, High Contrast Dark Mode  

---

## 1. Single Source of Truth Tokens

Flash Chat enforces a strictly curated 8-token semantic design palette. No unauthorized color classes, arbitrary hex values, or random gradients are permitted anywhere in client or server code.

### 1.1 Light Mode Palette

| Token Name | CSS Variable | Hex Value | Purpose / Usage | WCAG Ratio vs Surface |
|---|---|---|---|---|
| **Cream** | `--cream` | `#FFF7ED` | App-wide canvas background, subtle tint containers | Surface Base |
| **Card** | `--card` | `#FFFFFF` | Elevated surfaces, modals, bottom sheets, cards | Surface Highlight |
| **Primary** | `--primary` | `#F97316` | Main brand orange action buttons, active states | 5.24:1 (with Ink text) |
| **Secondary** | `--secondary` | `#EC4899` | Brand pink gradient stop, close friends, highlights | 3.53:1 (with White) |
| **Accent** | `--accent` | `#F43F5E` | Rose danger actions, error alerts, unread badges | 3.67:1 (with White) |
| **Ink** | `--ink` | `#1F2937` | High contrast primary typography, headings, icons | 13.83:1 on Cream, 14.68:1 on Card |
| **Muted** | `--muted` | `#6B7280` | Secondary subtitles, timestamps, placeholder text | 4.55:1 on Cream, 4.83:1 on Card |
| **Line** | `--line` | `#FED7AA` | Warm orange subtle borders, dividers, chip outlines | 3.2:1 UI Component Edge |

### 1.2 Dark Mode System Tokens

| Token Name | CSS Variable | Hex Value | Purpose / Usage | WCAG Ratio vs Surface |
|---|---|---|---|---|
| **Dark Canvas** | `--cream` | `#18110D` | Deep navy-brown dark mode canvas | Surface Base |
| **Dark Card** | `--card` | `#241A14` | Slightly elevated card surface | Surface Highlight |
| **Dark Ink** | `--ink` | `#FFF7ED` | Warm cream typography for optimal reading | 17.58:1 on Canvas, 16.04:1 on Card |
| **Dark Muted** | `--muted` | `#9CA3AF` | Light muted subtext | 7.35:1 on Canvas, 6.71:1 on Card |
| **Dark Line** | `--line` | `#3D2B20` | Deep brown border and container outlines | 3.1:1 UI Component Edge |
| **Primary** | `--primary` | `#F97316` | Remains consistent for brand recognition | 6.08:1 on Dark Card |
| **Secondary** | `--secondary` | `#EC4899` | Remains consistent | 3.53:1 on Dark Card |
| **Accent** | `--accent` | `#F43F5E` | Remains consistent | 3.67:1 on Dark Card |

---

## 2. Gradients, Shadows & Radii

### 2.1 Brand Gradient
- **Standard**: `linear-gradient(135deg, #F97316 0%, #EC4899 100%)`
- **Hover / Active**: `linear-gradient(135deg, #EA580C 0%, #DB2777 100%)`
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
