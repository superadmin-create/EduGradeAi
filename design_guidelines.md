# Design Guidelines: AI-Powered Assignment Grading Platform

## Design Approach
**System-Based Approach** - Drawing from institutional platforms (Canvas, Google Classroom) combined with modern productivity tools (Linear, Notion) for a professional academic interface that prioritizes clarity, trust, and efficient workflows.

## Core Design Principles
- **Institutional Trust**: Professional, authoritative design that conveys reliability
- **Data Clarity**: Clean information hierarchy for complex grading workflows
- **Efficient Navigation**: Quick access to frequent tasks and data
- **Academic Professionalism**: Balanced formality with modern usability

---

## Typography System

**Font Families** (Google Fonts):
- Primary: Inter (system interface, body text)
- Headings: Plus Jakarta Sans (professional warmth)

**Scale**:
- H1: 3xl/4xl, semibold (page headers)
- H2: 2xl, semibold (section headers)
- H3: xl, medium (card headers, subsections)
- Body: base/lg, normal (content)
- Small: sm, medium (labels, metadata)
- Tiny: xs, normal (captions, helper text)

---

## Layout System

**Spacing Primitives**: Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: py-12, py-16
- Card gaps: gap-6, gap-8

**Container Strategy**:
- Full-width dashboard: max-w-7xl
- Content sections: max-w-6xl
- Forms/cards: max-w-2xl

**Grid Patterns**:
- Stats/metrics: grid-cols-3 lg:grid-cols-4
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Assignment lists: Single column with row items

---

## Component Library

### Navigation
**Top Navigation Bar**:
- Fixed header with institution logo left, user profile/notifications right
- College selector dropdown (if multi-college access)
- Quick action buttons (New Assignment, Upload, Reports)
- Height: h-16, border-b with subtle shadow

**Sidebar Navigation** (Dashboard pages):
- Width: w-64, collapsible to w-16 on mobile
- Grouped menu items: Dashboard, Assignments, Grading Queue, Analytics, Settings
- Active state with subtle background and accent border-left indicator

### Login/Authentication Pages
**Multi-College Login**:
- Centered card layout (max-w-md)
- Institution logo header
- College/Institution selector as prominent dropdown with search
- Standard email/password fields with "Remember me" checkbox
- SSO options if applicable (displayed as button alternatives)
- Footer with "Contact Administrator" link

### Dashboard Components
**Stats Cards**:
- Grid layout displaying: Total Assignments, Pending Grading, Completed Today, Quota Remaining
- Each card: large number (text-3xl, font-bold), label below (text-sm), icon indicator
- Border with subtle shadow, p-6 padding

**Assignment Table/List**:
- Headers: Assignment Name, Course, Submitted, Status, Actions
- Row items with hover state (subtle background change)
- Status badges (pill-shaped): Pending, In Progress, Graded, Reviewed
- Quick action icons (View, Grade, Download) aligned right

**Quota Tracking Component**:
- Progress bar showing used/total quota
- Percentage and numbers display
- Warning state when approaching limit (amber accent)
- Displays time period (e.g., "Monthly Quota: 450/500")

### Grading Interface
**Assignment Detail View**:
- Two-column layout: Document viewer (left 60%), grading panel (right 40%)
- Document viewer: PDF/file display area with zoom controls
- Grading panel: scrollable with sections for rubric, feedback, score input
- AI suggestions displayed as expandable cards within grading panel

**Grading Actions**:
- Primary CTA: "Submit Grade" button (prominent, high contrast)
- Secondary actions: Save Draft, Request Review, Export
- Floating action bar if scrolling (sticky bottom)

### Forms & Inputs
**Standard Inputs**:
- Labels above fields (font-medium, text-sm)
- Input height: h-12, rounded corners (rounded-md)
- Border on all states, focus ring with accent
- Helper text below (text-xs, muted)

**Textareas** (for feedback):
- Min height: h-32
- Character counter if limited
- Expandable to accommodate content

**Dropdowns/Selects**:
- Consistent h-12 height
- Icon indicator (chevron down)
- Search within dropdown for long lists

### Data Display
**Tables**:
- Alternating row backgrounds for readability
- Sticky headers on scroll
- Sortable columns with icon indicators
- Pagination at bottom (showing X-Y of Z entries)

**Cards**:
- Border with subtle shadow
- Padding: p-6
- Rounded corners: rounded-lg
- Hover state: slight shadow increase

### Overlays
**Modals**:
- Centered overlay with backdrop blur/darken
- Max width: max-w-2xl for forms, max-w-4xl for complex views
- Header with title and close icon
- Footer with action buttons right-aligned

**Toast Notifications**:
- Positioned top-right, stacked
- Auto-dismiss after 5 seconds
- Icons for success/error/warning states
- Dismiss button (×)

---

## Images

**Hero Section** (Marketing/Landing):
- Large background image: Professional academic setting - modern classroom with students collaborating, bright natural lighting, diverse group of students with laptops/tablets
- Image treatment: Subtle gradient overlay (dark bottom fade) for text legibility
- Placement: Full-width hero spanning 70vh
- Text overlay: White text with drop shadow for readability
- CTA buttons: Background blur effect (backdrop-blur-sm with semi-transparent bg)

**Dashboard/App Pages**: 
- No decorative images; focus on data visualization and functional UI
- Institution logos displayed in header and login (constrained to h-8 or h-10)
- Empty states: Simple illustration placeholders (line art style)

---

## Iconography
**Library**: Heroicons (outline style for navigation, solid for status indicators)
- Navigation: Document, ClipboardList, ChartBar, Cog
- Actions: Plus, Download, Eye, Pencil
- Status: Check, Clock, ExclamationTriangle

---

## Responsive Behavior
- **Mobile** (base): Single column, collapsible sidebar to bottom nav, stacked stats
- **Tablet** (md): Two-column grids, expanded sidebar
- **Desktop** (lg+): Full multi-column layouts, persistent sidebar, optimal data density