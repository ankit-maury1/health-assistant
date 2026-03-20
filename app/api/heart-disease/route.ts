import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/authOptions';
import connectToDatabase from '@/lib/mongodb';
import { encryptHealthData } from '@/lib/encryption';
import rateLimit from '@/lib/rate-limit';

const predictionLimiter = rateLimit({ interval: 60 * 1000 });

function getClientToken(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || 'unknown';
  return forwarded.split(',')[0].trim();
}

function validateHeartDiseaseInput(data: any) {
  const fields = [
    'age', 'sex', 'chest_pain_type', 'resting_bp', 'cholesterol',
    'fasting_blood_sugar', 'resting_ecg', 'max_heart_rate',
    'exercise_angina', 'oldpeak', 'st_slope'
  ];

  for (const field of fields) {
    // All fields are optional. If provided, they must be numeric.
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      continue;
    }
    if (isNaN(Number(data[field]))) {
      return `Invalid field: ${field}`;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    try {
      await predictionLimiter.check(30, getClientToken(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Input Validation
    const validationError = validateHeartDiseaseInput(body);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Proxy the request to the Python backend
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    try {
      const response = await fetch(`${backendUrl}/api/predict-heart-disease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend API error:', response.status, errorText);
        return NextResponse.json(
          { error: `Backend API error: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();

      try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (session?.user?.email) {
          const db = await connectToDatabase();
          const users = db.collection('users');
          const predictionHistory = db.collection('predictionhistories');
          const user = await users.findOne({ email: session.user.email });
          if (user) {
            let riskScore: number = typeof data.riskScore === 'number' ? data.riskScore : Number(data.riskScore ?? data.probability ?? 0);
            if (Number.isNaN(riskScore)) riskScore = 0;
            const riskLevel: string = data.riskLevel ?? (riskScore >= 70 ? 'high' : riskScore >= 40 ? 'moderate' : 'low');

            await predictionHistory.insertOne({
              userId: user._id,
              date: new Date(),
              encryptedInputMetrics: encryptHealthData(body),
              riskScore,
              riskLevel,
              condition: 'heart-disease',
              encryptedResult: encryptHealthData(data),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      } catch (historyErr) {
        console.error('Unable to save heart-disease history:', historyErr);
      }

      return NextResponse.json(data);

    } catch (error: any) {
      console.error('Error proxying to backend:', error);
      return NextResponse.json(
        { error: 'Failed to connect to prediction service' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
