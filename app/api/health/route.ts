import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
        console.error('BACKEND_API_URL is not defined');
        return NextResponse.json(
            { status: 'offline', error: 'Configuration error' },
            { status: 500 }
        );
    }

    const response = await fetch(`${backendUrl}/check-api-health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'offline' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Handle boolean response from backend
    if (data === true) {
      return NextResponse.json({ status: 'online' });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error checking backend health:', error);
    return NextResponse.json(
      { status: 'offline' },
      { status: 500 }
    );
  }
}
