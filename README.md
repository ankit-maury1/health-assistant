# Health Assistant

An advanced AI-powered web application for predicting **Heart Disease** and **Diabetes** risk using machine learning algorithms. Get personalized health insights and recommendations through comprehensive analysis of key health metrics and lifestyle factors.

## 🌟 Features

- **Heart Disease Prediction**: Analyze your heart health risk based on multiple cardiovascular indicators
- **Diabetes Risk Assessment**: Evaluate your diabetes risk using comprehensive health metrics
- **AI-Powered Recommendations**: Receive personalized, actionable health suggestions powered by Large Language Models (LLM)
- **Real-time Analysis**: Get instant predictions with detailed probability scores
- **Progressive Web App (PWA)**: Install as a standalone app on your device with offline capabilities
- **Modern UI/UX**: Beautiful, responsive interface with dark mode support
- **Privacy-Focused**: Secure health data processing with client-side and server-side validation

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher)
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- A running **backend API server** (Python-based ML service)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ankit-maury1/health-assistant.git
   cd health-assistant
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   BACKEND_API_URL=http://localhost:8000
   ```

   Replace `http://localhost:8000` with your actual backend API URL.

### Running the Application

1. **Development mode**

   Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

2. **Production build**

   Build the application for production:

   ```bash
   npm run build
   npm start
   # or
   yarn build
   yarn start
   ```

3. **Linting**

   Run ESLint to check code quality:

   ```bash
   npm run lint
   # or
   yarn lint
   ```

## 📁 Project Structure

```
health-assistant/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes (Next.js backend)
│   │   ├── health/           # Health check endpoint
│   │   ├── predict-diabetes/ # Diabetes prediction proxy
│   │   └── heart-disease/    # Heart disease prediction proxy
│   ├── diabetes/             # Diabetes prediction page
│   ├── heart-disease/        # Heart disease prediction page
│   ├── offline/              # Offline fallback page (PWA)
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
├── components/               # Reusable React components
│   ├── layout/               # Layout components
│   └── ui/                   # UI components (Cards, Selects, etc.)
├── lib/                      # Utility libraries
├── public/                   # Static assets
│   ├── icons/                # PWA icons
│   └── manifest.json         # PWA manifest
├── next.config.ts            # Next.js configuration with PWA
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Project dependencies
```

## 🛠️ Technologies Used

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first CSS framework
- **PWA Support** - Progressive Web App capabilities via `@ducanh2912/next-pwa`

### Backend Integration
- **Next.js API Routes** - Proxy layer for backend communication
- **Python ML Backend** - Machine learning prediction service (external)

## 📊 How to Use

### 1. Diabetes Risk Assessment

1. Navigate to the **Diabetes Risk** page
2. Fill in the required health information:
   - **Gender**: Your biological gender
   - **Age**: Your age in years
   - **Height & Weight**: For BMI calculation
   - **Hypertension**: Whether you have high blood pressure
   - **Heart Disease**: Existing heart conditions
   - **Smoking History**: Your smoking status
   - **HbA1c Level**: Average blood sugar level (%)
   - **Blood Glucose Level**: Current blood glucose (mg/dL)
3. Click **Predict** to get your diabetes risk assessment
4. Review the results, including:
   - Risk prediction (Diabetic/Non-Diabetic)
   - Probability score
   - Personalized AI-generated recommendations

### 2. Heart Disease Risk Assessment

1. Navigate to the **Heart Disease Risk** page
2. Fill in the cardiovascular health metrics:
   - **Age**: Your age in years
   - **Sex**: Your biological sex
   - **Chest Pain Type**: Type of chest pain experienced
   - **Resting Blood Pressure**: Blood pressure at rest (mm Hg)
   - **Cholesterol**: Serum cholesterol (mg/dL)
   - **Fasting Blood Sugar**: Blood sugar after fasting
   - **Resting ECG**: Electrocardiogram results
   - **Max Heart Rate**: Maximum heart rate achieved
   - **Exercise Angina**: Exercise-induced angina
   - **Oldpeak**: ST depression induced by exercise
   - **ST Slope**: Slope of peak exercise ST segment
3. Submit the form to receive your heart disease risk analysis
4. Get detailed results with AI-powered health suggestions

## 🔌 API Endpoints

The application uses Next.js API routes as a proxy to the Python backend:

### Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Check if the backend ML service is online
- **Response**: `{ status: 'online' | 'offline' }`

### Diabetes Prediction
- **Endpoint**: `POST /api/predict-diabetes`
- **Description**: Predict diabetes risk
- **Request Body**:
  ```json
  {
    "gender": 0 | 1,
    "age": number,
    "hypertension": 0 | 1,
    "heartDisease": 0 | 1,
    "smokingHistory": number,
    "bmi": number,
    "hbA1cLevel": number,
    "bloodGlucoseLevel": number,
    "height": number,
    "weight": number
  }
  ```
- **Response**: Risk prediction with AI recommendations

### Heart Disease Prediction
- **Endpoint**: `POST /api/heart-disease`
- **Description**: Predict heart disease risk
- **Request Body**: Cardiovascular health metrics
- **Response**: Risk assessment with personalized advice

## 📱 PWA Features

The application is a Progressive Web App with:

- **Installable**: Add to home screen on mobile and desktop
- **Offline Support**: Access core features without internet
- **Service Worker**: Background sync and caching
- **Responsive Design**: Optimized for all screen sizes
- **App-like Experience**: Standalone display mode

### Installing as PWA

1. Visit the app in your browser
2. Click the install prompt (or menu → "Install App")
3. The app will be added to your home screen/app list

## 🔐 Security Features

- **Content Security Policy (CSP)**: Prevents XSS attacks
- **Input Validation**: Server-side and client-side validation
- **HTTPS Enforcement**: Upgrade insecure requests
- **X-Frame-Options**: Prevents clickjacking
- **No Data Storage**: Health data is not stored permanently

## 🎨 Theming

The app supports light and dark themes:
- Theme is automatically detected from system preferences
- Toggle theme using the theme switcher in the navigation
- Theme preference is saved locally

## 🌐 Backend Setup

This frontend requires a Python-based machine learning backend. The backend should:

1. Expose a health check endpoint at `/check-api-health`
2. Provide diabetes prediction at `/api/predict-diabetes`
3. Provide heart disease prediction at `/api/heart-disease`
4. Return predictions with AI-generated suggestions

Set the `BACKEND_API_URL` environment variable to point to your backend service.

## 📄 License

This project was created by Group 1 Team for Project Sem 7 CSE ECB.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue in the GitHub repository.

---

**Built with** ❤️ **using Next.js, React, and AI**
