# AI Assignment Grader

## Overview

This is an AI-powered assignment grading application built with React frontend and Express backend. The application allows professors to create assignments with question-answer pairs, upload student submissions, and automatically grade them using OpenAI's GPT models. It features a modern dashboard interface for managing assignments, reviewing submissions, and analyzing grading results.

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
- **Fallback Storage**: In-memory storage implementation for development/testing

### Database Schema Design
- **Users**: Professor accounts with authentication capabilities
- **Assignments**: Course assignments with questions, expected answers, and point values
- **Submissions**: Student submission files with metadata and processing status
- **Grading Results**: AI analysis results with detailed scoring and feedback

### Authentication and Authorization
- **Session Management**: PostgreSQL session store for persistent user sessions
- **User Roles**: Role-based access control with professor and student distinctions
- **Security**: Express session middleware with secure cookie configuration

### File Processing Pipeline
- **Upload Handling**: Multi-format file support (PDF, DOC, DOCX, TXT)
- **Content Extraction**: Text processing for various document formats
- **Validation**: File type and size validation with error handling
- **Storage**: File content stored as text in database for AI processing

## External Dependencies

### AI Integration
- **OpenAI API**: GPT-5 model for automated assignment grading and feedback generation
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