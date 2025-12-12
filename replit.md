# AI Assignment Grader

## Overview

This is an AI-powered assignment grading application built with React frontend and Express backend. The application allows professors to create assignments with question-answer pairs, upload student submissions, and automatically grade them using OpenAI's GPT models. It features a modern dashboard interface for managing assignments, reviewing submissions, and analyzing grading results.

## Multi-College System

The application supports multiple colleges with individual login credentials and grading quotas.

### Registered Colleges
- **Leapup (Main Admin)**: Code `LEAPUP`, Quota: Unlimited
  - Login: username `admin`, password `leapup2025`
- **SXCA College**: Code `SXCA`, Quota: 100 assignments
  - Login: username `admin`, password `sxca2024`

### How the Quota System Works
- Each college has a set number of AI grading operations they can perform
- Quota is consumed when a submission is graded by the AI
- When quota is exceeded, grading operations are blocked
- College admins can view their quota usage in the dashboard
- Null quota represents unlimited grading capability (e.g., Leapup main admin)

## Student Portal

Each college has a dedicated student portal for assignment submissions.

### Accessing the Student Portal
- **General Portal**: `/student/{COLLEGE_CODE}` (e.g., `/student/SXCA`) - shows all assignments
- **Assignment-Specific Portal**: `/student/{COLLEGE_CODE}/{ASSIGNMENT_SLUG}` (e.g., `/student/SXCA/test`)
- No authentication required - students only need their name and student ID
- Assignment slugs are URL-friendly versions of assignment titles (lowercase, spaces replaced with hyphens)

### Student Portal Features
- View list of assignments for their college (general portal)
- Direct link to specific assignment submission (assignment-specific portal)
- Enter student name and student ID
- Upload submission files (PDF, DOC, DOCX, PPTX, TXT, MD, PNG, JPG, GIF supported)
- Automatic AI grading upon submission (if college has available quota)
- Receive confirmation upon successful submission

### Admin Settings - Portal Links
- Navigate to Settings page in admin dashboard to view all student portal links
- Each assignment automatically generates a unique portal link using its slug
- Links can be copied directly from the Settings page
- Links update automatically when new assignments are created

## Plagiarism Detection

The application includes AI-powered plagiarism detection to check submissions for:
1. **AI-Generated Content**: Detects if a submission was likely written by AI
2. **Similarity with Other Submissions**: Compares submissions to find copied content

### How to Use
- Navigate to the Submissions page
- Click "Check Plagiarism" button on any submission card
- Results show AI detection status and similarity with other submissions

### Plagiarism Results
- **AI Detection**: Shows if content is "AI Generated" or "Human Written" with confidence percentage
- **Similarity Score**: Percentage of content matching other submissions
- **Similar Submissions**: Lists matching submissions with student name, ID, and similarity percentage
- **Matched Phrases**: Shows specific phrases that matched between submissions

### API Endpoints
- `POST /api/submissions/:id/plagiarism-check` - Run plagiarism check on a submission
- `GET /api/submissions/:id/plagiarism` - Get existing plagiarism result
- `POST /api/assignments/:id/check-all-plagiarism` - Check all submissions for an assignment

## Export Functionality

The admin dashboard (Submissions page) includes export features:
- **Date Filter**: Filter submissions by specific date before exporting
- **Export CSV**: Download all submissions with grades in CSV format (Excel compatible)
- **Export Word**: Download detailed submissions report in Word document format
- Export includes: Assignment title, student info, submission date, grade, score, percentage, and feedback

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Custom component library built with Radix UI primitives and styled with Tailwind CSS
- **State Management**: TanStack Query for server state management and form handling with React Hook Form
- **Styling**: Tailwind CSS with CSS variables for theming and shadcn/ui design system

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Development Setup**: Vite for development server and build tooling
- **File Processing**: Multer for file upload handling with memory storage
- **API Design**: RESTful endpoints for assignments, submissions, and grading operations

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle migrations for database schema versioning
- **Connection**: Neon Database serverless PostgreSQL for cloud hosting

### Database Schema Design
- **Colleges**: Institution accounts with quotas and unique codes
- **Users**: Professor accounts linked to colleges with authentication credentials
- **Assignments**: Course assignments with questions, expected answers, and point values
- **Submissions**: Student submission files with metadata and processing status
- **Grading Results**: AI analysis results with detailed scoring and feedback

### Authentication and Authorization
- **Session Management**: Express-session with memory store for user sessions
- **College-based Login**: Users authenticate with college code, username, and password
- **Quota Enforcement**: All grading operations check and enforce college quotas
- **Route Protection**: All API routes (except auth endpoints) require authentication

### File Processing Pipeline
- **Upload Handling**: Multi-format file support (PDF, DOC, DOCX, PPTX, XLSX, XLS, CSV, TXT, MD, PNG, JPG, GIF)
- **Content Extraction**: Text processing using pdfjs-dist, mammoth, xlsx, jszip libraries
- **Image/Photo Extraction**: OpenAI Vision API (GPT-4o) for extracting text from images, slides, and photos
- **Validation**: File type and size validation with error handling
- **Storage**: File content stored as text in database for AI processing

## External Dependencies

### AI Integration
- **OpenAI API**: GPT models for automated assignment grading and feedback generation
- **Prompt Engineering**: Structured prompts for consistent grading across submissions
- **Response Processing**: JSON-structured AI responses with scoring and detailed feedback

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with automatic scaling
- **Connection Pooling**: Built-in connection management for production workloads

### UI and Styling
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide Icons**: Consistent icon library for UI elements

### Development Tools
- **Vite**: Fast development server with hot module replacement
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production builds
- **Replit Integration**: Development environment plugins for Replit platform

### Form and Data Handling
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition
- **TanStack Query**: Async state management with caching and synchronization

### File Upload and Processing
- **React Dropzone**: Drag-and-drop file upload interface
- **Multer**: Express middleware for handling multipart/form-data
- **Document Processing**: Built-in text extraction for common file formats
