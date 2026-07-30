# Sokin Design Specification

A personal finance management application with a dark, premium aesthetic inspired by Circora Studio. Built with Next.js, Tailwind CSS, and shadcn/ui (Radix UI primitives).

---

## 1. Brand Identity

**Name:** Sokin
**Aesthetic:** Minimalist, dark-mode-first, premium fintech
**Inspiration:** Circora Studio design language -- high contrast, clean lines, generous whitespace

---

## 2. Color System

### 2.1 Brand Colors

| Token   | Hex       | HSL               | Role                        |
|---------|-----------|--------------------|-----------------------------|
| `dark`  | `#1A1A1A` | `0 0% 10.2%`      | Primary background          |
| `cream` | `#F5F5F0` | `36 18% 96.5%`    | Primary foreground / accent |

The entire UI is built on the tension between these two colors. Cream is never pure white -- it carries a warm undertone that softens the dark background.

### 2.2 Semantic Tokens (CSS Custom Properties)

#### Light Mode

| Token                    | HSL Value          | Approx Hex  |
|--------------------------|--------------------|-------------|
| `--background`           | `0 0% 100%`       | `#FFFFFF`   |
| `--foreground`           | `240 10% 3.9%`    | `#0A0E27`   |
| `--primary`              | `240 5.9% 10%`    | `#191D2E`   |
| `--primary-foreground`   | `0 0% 98%`        | `#FAFAF8`   |
| `--secondary`            | `240 4.8% 95.9%`  | `#F3F3F1`   |
| `--muted`                | `240 4.8% 95.9%`  | `#F3F3F1`   |
| `--muted-foreground`     | `240 3.8% 46.1%`  | `#767676`   |
| `--destructive`          | `0 84.2% 60.2%`   | `#EF4444`   |
| `--border`               | `240 5.9% 90%`    | `#E5E5E3`   |
| `--ring`                 | `240 5.9% 10%`    | `#191D2E`   |

#### Dark Mode (Default)

| Token                    | HSL Value          | Approx Hex  |
|--------------------------|--------------------|-------------|
| `--background`           | `240 10% 3.9%`    | `#0A0E27`   |
| `--foreground`           | `0 0% 98%`        | `#FAFAF8`   |
| `--primary`              | `0 0% 98%`        | `#FAFAF8`   |
| `--primary-foreground`   | `240 5.9% 10%`    | `#191D2E`   |
| `--secondary`            | `240 3.7% 15.9%`  | `#27293C`   |
| `--muted`                | `240 3.7% 15.9%`  | `#27293C`   |
| `--muted-foreground`     | `240 5% 64.9%`    | `#A5A5A5`   |
| `--destructive`          | `0 62.8% 30.6%`   | `#7F1D1D`   |
| `--border`               | `240 3.7% 15.9%`  | `#27293C`   |
| `--ring`                 | `240 4.9% 83.9%`  | `#D5D5D0`   |

#### Sidebar (Dark Mode)

| Token                          | HSL Value            | Approx Hex  |
|--------------------------------|----------------------|-------------|
| `--sidebar-background`         | `240 5.9% 10%`      | `#191D2E`   |
| `--sidebar-foreground`         | `240 4.8% 95.9%`    | `#F3F3F1`   |
| `--sidebar-primary`            | `224.3 76.3% 48%`   | `#4F98FF`   |
| `--sidebar-accent`             | `240 3.7% 15.9%`    | `#27293C`   |
| `--sidebar-border`             | `240 3.7% 15.9%`    | `#27293C`   |
| `--sidebar-ring`               | `217.2 91.2% 59.8%` | `#4F98FF`   |

### 2.3 Opacity Scale

Cream is applied at consistent opacity stops to create depth hierarchy:

| Opacity | Tailwind Class    | Usage                                |
|---------|-------------------|--------------------------------------|
| 5%      | `bg-cream/5`      | Subtlest hover states, card fills    |
| 10%     | `bg-cream/10`     | Default card backgrounds, borders    |
| 20%     | `border-cream/20` | Stronger dividers, outline buttons   |
| 40%     | `text-cream/40`   | Metadata, timestamps, deemphasized   |
| 60%     | `text-cream/60`   | Labels, secondary descriptions       |
| 80%     | `text-cream/80`   | Strong secondary text                |
| 100%    | `text-cream`      | Primary foreground text              |

### 2.4 Status / Semantic Colors

| Purpose        | Color       | Hex       | Usage                          |
|----------------|-------------|-----------|--------------------------------|
| Success        | Green       | `#10B981` | Positive trends, active states |
| Warning        | Amber       | `#F59E0B` | Approaching limits, caution    |
| Error          | Red         | `#EF4444` | Over budget, destructive       |
| Info           | Blue        | `#3B82F6` | General data, chart default    |
| Purple         | Purple      | `#8B5CF6` | Category accent                |
| Pink           | Pink        | `#EC4899` | Category accent                |

### 2.5 Chart Palette

Used for data visualizations (Recharts / lightweight-charts):

```
#3B82F6  Blue
#EF4444  Red
#10B981  Green
#F59E0B  Amber
#8B5CF6  Purple
#EC4899  Pink
#6B7280  Gray
```

Budget progress bars shift color by threshold:
- `< 50%` spent: Cream (`rgba(245,245,240,0.8)`)
- `>= 50%`: Green (`#10B981`)
- `>= 70%`: Amber (`#F59E0B`)
- `>= 90%`: Red (`#EF4444`)

### 2.6 Category Colors (Goals, Budgets)

| Category       | Background     | Text           |
|----------------|----------------|----------------|
| Emergency Fund | `bg-red-100`   | `text-red-800` |
| Vacation       | `bg-blue-100`  | `text-blue-800`|
| Home/Property  | `bg-green-100` | `text-green-800`|
| Vehicle        | `bg-purple-100`| `text-purple-800`|
| Education      | `bg-yellow-100`| `text-yellow-800`|
| Retirement     | `bg-indigo-100`| `text-indigo-800`|
| Other          | `bg-gray-100`  | `text-gray-800`|

---

## 3. Typography

### 3.1 Font Families

| Font         | Type       | Weights       | Usage                                      |
|--------------|------------|---------------|---------------------------------------------|
| **Outfit**   | Sans-serif | 300-700       | Everything: headings, body, UI labels (97%) |
| **Roboto Mono** | Monospace | 400, 500  | Section numbering ("01 /"), technical text (3%) |

Loaded from Google Fonts with `display=swap` and `preconnect` for performance.

### 3.2 Type Scale

| Level            | Size                              | Weight     | Tracking        | Usage                      |
|------------------|-----------------------------------|------------|-----------------|----------------------------|
| **Display**      | `text-5xl` to `text-8xl` (responsive) | Medium (500) | `tracking-tight` | Hero "Sokin" branding     |
| **H1**           | `text-3xl md:text-4xl lg:text-5xl`    | Medium (500) | `tracking-tight` | Section headings          |
| **H2 / Page**    | `text-2xl md:text-3xl`                | Medium (500) | `tracking-tight` | Page headers              |
| **H3 / Card**    | `text-2xl`                            | Semibold (600) | `tracking-tight` | Card titles               |
| **Body Large**   | `text-lg`                             | Regular (400) | Default         | Descriptions, paragraphs  |
| **Body**         | `text-base`                           | Regular (400) | Default         | Standard content          |
| **Label**        | `text-sm`                             | Medium (500) | Default         | Labels, form text         |
| **Caption**      | `text-xs`                             | Semibold (600) | Default        | Metadata, badges, timestamps |

### 3.3 Text Color Hierarchy (Dark Mode)

```
text-cream        -- Primary headings, values
text-cream/80     -- Strong secondary text
text-cream/70     -- Body / descriptive text
text-cream/60     -- Labels, captions
text-cream/40     -- Metadata, deemphasized
```

### 3.4 Special Treatments

- **Tracking tight** (`-0.02em`): All headings and card titles -- gives a premium, condensed feel
- **Tracking wide** (`0.025em`): Occasional button labels, navigation on mobile
- **Monospace numbering**: `01 / About`, `02 / Features` -- Roboto Mono at `text-sm text-cream/60`
- **`leading-none`**: Card titles and labels (tightest line-height for compact cards)
- **`leading-relaxed`**: Alert descriptions, longer-form content

---

## 4. Layout System

### 4.1 Breakpoints

| Name  | Width    | Usage                          |
|-------|----------|--------------------------------|
| `xs`  | 475px    | Small phones                   |
| `sm`  | 640px    | Large phones                   |
| `md`  | 768px    | Tablets, navigation breakpoint |
| `lg`  | 1024px   | Desktops                       |
| `xl`  | 1280px   | Wide desktops                  |
| `2xl` | 1536px   | Ultra-wide                     |

Container max-widths: `2xl: 1400px`

### 4.2 App Shell

```
+------------------------------------------------------------+
|  [Sidebar (desktop)]  |  [Main Content Area]               |
|  hidden md:flex       |  flex-1                            |
|  200px expanded       |                                    |
|  100px collapsed      |  p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12|
|                       |                                    |
+------------------------------------------------------------+
|  [MobileNav (mobile)] -- Sheet drawer from left, 280-300px |
+------------------------------------------------------------+
```

- **Sidebar**: Collapsible with smooth width transition. Shows tooltips when collapsed. Contains logo, 12 nav items, user avatar, sign-out.
- **Mobile Nav**: Hamburger trigger (top-left, z-40). Sheet slides from left with ScrollArea.

### 4.3 Dashboard Grid

```
Metric cards row:
  grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6

Main content area:
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6
  (sections use lg:col-span-6 for 50/50 splits)
```

A `ResponsiveLayoutContainer` adapts layout based on portfolio state:
- **With portfolio**: 2-column (Stock Market + Transactions | Bills + Savings + Analytics)
- **Without portfolio**: Compact rearrangement
- **Mobile**: Single column, some desktop-only sections hidden

### 4.4 Spacing Scale

| Context          | Classes                              |
|------------------|--------------------------------------|
| Page padding     | `p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12`|
| Card padding     | `p-5` (metric), `p-4 lg:p-6` (containers) |
| Section gap      | `gap-4 lg:gap-6`                    |
| Section margin   | `mb-6 lg:mb-8`                      |
| Component gap    | `gap-2` (inline), `gap-3` (related), `gap-4` (form rows) |
| Input padding    | `px-3 py-2`                         |
| Button padding   | `px-4 py-2`                         |

### 4.5 Landing Page Sections

1. **Hero** -- Full viewport height, centered flex, 3D torus background, responsive text scaling from `text-5xl` to `text-8xl`
2. **About** -- 50/50 split on `lg`, full-width on mobile
3. **Features** -- Carousel with touch/drag, dot indicators
4. **Contact** -- 2-column grid on `lg`, single column on mobile

---

## 5. Component Library

Built on **shadcn/ui** (63 installed components), using **Radix UI** primitives with Tailwind styling.

### 5.1 Cards

**Base card**: `rounded-lg border bg-card text-card-foreground shadow-sm`

**Metric Card** (dashboard KPIs):
```
Container:  bg-cream/5 rounded-xl border border-cream/10 p-5
Hover:      hover:bg-cream/10 transition-colors
Icon:       8x8 rounded bg-cream/5 flex items-center justify-center
Title:      text-sm text-cream/60
Value:      text-2xl font-medium
Change:     text-sm + TrendingUp/Down icon + percentage
```

### 5.2 Buttons

| Variant       | Background          | Text         | Border            |
|---------------|---------------------|--------------|-------------------|
| `default`     | `bg-cream`          | `text-dark`  | --                |
| `destructive` | `bg-destructive`    | White        | --                |
| `outline`     | Transparent         | `text-cream` | `border-cream/20` |
| `secondary`   | `bg-cream/10`       | `text-cream` | --                |
| `ghost`       | Transparent         | `text-cream` | --                |
| `link`        | Transparent         | `text-cream` | -- (underline)    |

Sizes: `default` (h-10 px-4 py-2), `sm` (h-9 px-3), `lg` (h-11 px-8), `icon` (h-10 w-10)

### 5.3 Badges (Status Indicators)

| Status     | Background          | Text              |
|------------|---------------------|--------------------|
| Active     | `bg-green-500/20`   | `text-green-400`   |
| Warning    | `bg-yellow-500/20`  | `text-yellow-400`  |
| Expired    | `bg-red-500/20`     | `text-red-400`     |
| Priority Low | `bg-gray-100`     | `text-gray-800`    |
| Priority Med | `bg-yellow-100`   | `text-yellow-800`  |
| Priority High | `bg-red-100`     | `text-red-800`     |

### 5.4 Borders & Radius

| Token         | Value                        | Usage                |
|---------------|------------------------------|----------------------|
| `rounded-xl`  | 0.75rem                      | Cards, containers    |
| `rounded-lg`  | `var(--radius)` (0.5rem)     | Standard elements    |
| `rounded-md`  | `calc(var(--radius) - 2px)`  | Smaller elements     |
| `rounded-sm`  | `calc(var(--radius) - 4px)`  | Compact elements     |
| `rounded-full`| 9999px                       | Pills, avatars       |

Default border color: `border-cream/10` (subtle) or `border-cream/20` (stronger)

---

## 6. Iconography

### 6.1 Icon Library

**Lucide React** (`lucide-react` v0.454.0) -- sole icon library. Centralized exports from `/frontend/src/lib/icons.ts`.

### 6.2 Icon Inventory (66 icons)

**Navigation (22):** ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Menu, X, ArrowRight, ArrowLeft, ArrowDown, PanelLeft, MoreHorizontal, ChevronsLeft, ChevronsRight, ChevronsUpDown, Filter, GripVertical, Search, Dot, Circle

**Financial (14):** DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Wallet, CreditCard, Building, Activity, ArrowUpDown, Target, Clock, Minus, Plus, PlusCircle

**Status (11):** Check, CheckCircle, AlertCircle, AlertTriangle, Info, Bell, BellOff, Upload, Download, Share, Trash2

**Account (8):** Eye, EyeOff, Lock, Unlock, User, Settings, Save, Home

**Utility (6):** Calendar, CalendarIcon, Pencil, Receipt, Loader2, RefreshCw

**Category (4):** ShoppingBag, Coffee, Car, Utensils

**Communication (3):** MessageCircle, Phone, Mail

### 6.3 Icon Sizing Convention

| Context          | Size      | Tailwind      |
|------------------|-----------|---------------|
| Metric card icon | 20x20     | `h-5 w-5`    |
| Nav icon         | 20x20     | `h-5 w-5`    |
| Button icon      | 16x16     | `h-4 w-4`    |
| Inline / badge   | 12x12     | `h-3 w-3`    |
| Header icon      | 24x24     | `h-6 w-6`    |

---

## 7. Motion & Animation

### 7.1 Libraries

| Library          | Version | Purpose                             |
|------------------|---------|-------------------------------------|
| Framer Motion    | Latest  | Component animations, page transitions |
| GSAP + ScrollTrigger | 3.13.0 | Scroll-triggered animations, complex sequences |
| Three.js + R3F   | 0.179.1 | 3D rendered scenes (landing page)   |

### 7.2 Standard Transitions

| Pattern           | Config                                      | Usage                 |
|-------------------|---------------------------------------------|-----------------------|
| **Fade-in-up**    | `opacity: 0→1, y: 20→0, duration: 0.5s`   | Cards, sections       |
| **Stagger**       | `0.1s` delay between children               | List items, grid items|
| **Hover lift**    | `bg-cream/5 → bg-cream/10, 0.2s`           | Card hover states     |
| **Accordion**     | `height: 0 → auto, 0.2s ease-out`          | Collapsibles          |

### 7.3 Custom Keyframes

| Animation          | Keyframes                          | Duration | Usage            |
|--------------------|------------------------------------|----------|------------------|
| `loading-dot`      | opacity 0.3 → 1 → 0.3             | 1.2s     | Loading dots     |
| `loading-pulse`    | opacity 0.6 → 0.4, scale 0.8 → 1.2| 1.5s    | Pulse spinner    |
| `spin`             | rotate 0 → 360deg                  | 1.0s     | Border spinner   |

### 7.4 3D Scenes (Landing Page Only)

| Component                  | Description                                       |
|----------------------------|---------------------------------------------------|
| `ScrollTriggered3DScene`   | Full-page scroll-bound torus, scales 1.0 → 2.8   |
| `MobileHero3DScene`        | Responsive hero-only torus, adjusted FOV          |
| `TwistedTorus`             | Metallic torus mesh (#e8e8e8, metalness 0.8)      |

Lazy-loaded with `dynamic(() => import(...), { ssr: false })` for performance.

---

## 8. Visual Effects

### 8.1 Backdrop & Blur

| Effect              | Class                | Usage                        |
|---------------------|----------------------|------------------------------|
| Light blur          | `backdrop-blur-sm`   | Landing page fixed header    |
| Medium blur         | `backdrop-blur-md`   | Mobile menu overlay          |
| Minimal blur        | `backdrop-blur-[1px]`| Subtle overlays              |

### 8.2 Shadows

| Level | Class       | Usage                              |
|-------|-------------|------------------------------------|
| Small | `shadow-sm` | Cards, calendar                    |
| Medium| `shadow-md` | Tooltips                           |
| Large | `shadow-lg` | Dialogs, dropdowns, popovers       |

### 8.3 Gradients

Used sparingly, primarily in fallback/error UI:
- `bg-gradient-to-br from-blue-50 to-purple-50` (light accent gradients)

### 8.4 Interactive States

| State    | Treatment                                               |
|----------|---------------------------------------------------------|
| Hover    | `hover:bg-cream/10`, `hover:border-cream`, opacity shift |
| Focus    | Focus ring with `ring` token color                      |
| Disabled | `opacity-50`, pointer-events-none                       |
| Active   | Background fill change, border highlight                |

---

## 9. Assets

### 9.1 Static Assets (`/frontend/public/`)

| Asset                    | Purpose                    |
|--------------------------|----------------------------|
| `sokin-icon.png`         | App icon / favicon         |
| `apple-touch-icon.png`   | iOS home screen            |
| `placeholder-logo.svg/png` | Logo fallback           |
| `manifest.json`          | PWA manifest               |
| `sw.js`                  | Service worker (push notifications) |

### 9.2 Feature Images (`/frontend/public/images/features/`)

| Image                     | Feature Section            |
|---------------------------|----------------------------|
| `expense-tracking.png/svg`| Expense tracking feature   |
| `data-visualization.png/svg` | Data viz feature        |
| `budget-tracking.png`     | Budget management feature  |
| `goal-setting.png/svg`    | Goal setting feature       |

---

## 10. Design Principles Summary

1. **Dark-first**: The app defaults to dark mode (`bg-dark text-cream`). Light mode is supported but secondary.
2. **Cream hierarchy**: Depth is created through opacity of a single cream color, not multiple grays.
3. **Tight tracking on headings**: Every heading uses `tracking-tight` for a premium, editorial feel.
4. **Outfit everywhere**: One sans-serif font handles the entire UI. Monospace is decorative only.
5. **Subtle interactivity**: Hover states shift opacity by 5-10%, never dramatic color changes.
6. **Semantic color for data only**: Red/green/amber/blue are reserved for status and charts. The UI chrome stays monochrome (dark + cream).
7. **Mobile-first responsive**: All styles begin at mobile and scale up through breakpoints.
8. **Motion with purpose**: Entry animations are fade-in-up with stagger. No gratuitous motion in the dashboard. 3D is reserved for the landing page.
