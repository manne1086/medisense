
# MediSense AI — Intelligent Medical Assistant

A patient-first AI medical assistant using Retrieval-Augmented Generation (RAG) to provide accurate, personalized health insights from uploaded medical reports and past records.

## Features

✅ **AI Doctor (RAG-Powered)** — Chat interface that leverages your medical history to answer health questions with precision

✅ **Report Analysis** — Upload lab reports, imaging scans, or health checkups for AI-powered extraction and analysis

✅ **My Reports** — View, manage, and delete your stored medical records with full history

✅ **Prescription Analysis** — Upload and analyze medication prescriptions with alternatives

✅ **Medical Triage** — Get health assessments and severity ratings for symptoms

✅ **Secure Authentication** — Google OAuth 2.0 login with JWT tokens

✅ **Biomarker Tracking** — Longitudinal trend analysis across multiple reports

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + Glass UI
- Recharts (data visualization)
- Lucide Icons

**Backend:**
- Express.js
- MongoDB (medical records storage)
- Groq AI API (models: llama-3.3-70b, llama-3.2-11b-vision)
- OCR for PDF extraction

## Project Structure

```
medisense/
├── components/           # React UI components
│   ├── AIDoctor.tsx          # RAG-powered AI chat
│   ├── ModuleAnalysis.tsx    # Report upload & analysis
│   ├── ModulePrescription.tsx# Prescription parser
│   ├── MyReports.tsx         # Report management
│   ├── FloatingAssistant.tsx # Chat widget
│   ├── Login.tsx             # OAuth login
│   └── Icons.tsx             # Icon exports
│
├── services/            # API & utility services
│   ├── grokService.ts        # AI & analysis service
│   ├── authService.ts        # Authentication
│   ├── storageService.ts     # Record CRUD ops
│   └── analysisService.ts    # Prescription analysis
│
├── server/              # Express backend
│   ├── index.js              # Server & routes
│   ├── models/
│   │   ├── User.js
│   │   └── MedicalRecord.js
│   └── routes/
│       └── analyze.js        # PDF/image analysis
│
├── App.tsx              # Main app component
├── index.tsx            # React entry point
├── types.ts             # TypeScript types
└── vite.config.ts       # Vite configuration
```

## Setup & Installation

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Groq API key
- Google OAuth credentials

### Frontend Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your API keys:
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key
   VITE_GROQ_TEXT_MODEL=llama-3.3-70b-versatile
   VITE_GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend Setup

1. Navigate to server and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create `server/.env` with your configuration:
   ```env
   MONGO_URI=mongodb://localhost:27017/medisense
   JWT_SECRET=your_jwt_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GROQ_API_KEY=your_groq_api_key
   PORT=5000
   ```

3. Start the backend:
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## Key Features Explained

### RAG-Powered AI Doctor
The AI Doctor ingests all your past medical records (biomarkers, summaries, risks, medications) when answering questions. It provides:
- Context-aware responses based on your actual health data
- Trend analysis across multiple reports
- Medication & risk cross-references
- Personalized health guidance

### Report Analysis Pipeline
1. Upload lab report, scan, or health document (JPG, PNG, PDF)
2. AI Vision extracts biomarkers and clinical data
3. AI generates patient-friendly summary
4. Stores in database for future RAG context
5. Shows trends vs. past reports

### My Reports
- Browse all stored medical records chronologically
- View detailed analysis, risks, and recommendations
- Delete individual reports
- Access full context for AI Doctor

## API Endpoints

### Authentication
- `GET /auth/google` — Google OAuth entry
- `GET /auth/google/callback` — OAuth callback

### Records
- `GET /api/records` — Fetch user's medical records
- `POST /api/records` — Save new medical record
- `DELETE /api/records/:id` — Delete specific report
- `DELETE /api/records` — Clear all records

### Analysis
- `POST /api/analyze` — Analyze prescription or document
- `POST /api/analyze/extract-pdf` — Extract text from PDF

## Security & Privacy

- 🔐 JWT-based authentication with Google OAuth
- 🔒 All records scoped to authenticated user (MongoDB filtering)
- 🛡️ No API keys exposed in frontend code
- ⚠️ Medical Disclaimer: AI outputs are for guidance only, not diagnosis
- 📋 HIPAA-compliant data storage (MongoDB with user isolation)

## Development

### Build for production:
```bash
npm run build
```

### Check for errors:
```bash
npm run build 2>&1 | grep -i error
```

## Troubleshooting

**"Failed to analyze report"**
- Ensure image is clear and shows medical data
- Check that Groq API key is valid in `.env.local`

**"Failed to delete report"**
- Verify the report ID exists in database
- Check user authentication token is valid

**MongoDB connection failed**
- Ensure MongoDB is running locally or Atlas URI is correct
- Check `MONGO_URI` in `server/.env`

**Build errors after file changes**
- Clear cache: `rm -rf dist node_modules && npm install && npm run build`

## License

MIT
