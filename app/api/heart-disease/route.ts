import { NextResponse } from 'next/server';

function validateHeartDiseaseInput(data: any) {
  const requiredFields = [
    'age', 'sex', 'chest_pain_type', 'resting_bp', 'cholesterol',
    'fasting_blood_sugar', 'resting_ecg', 'max_heart_rate',
    'exercise_angina', 'oldpeak', 'st_slope'
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || isNaN(Number(data[field]))) {
      return `Invalid or missing field: ${field}`;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
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
