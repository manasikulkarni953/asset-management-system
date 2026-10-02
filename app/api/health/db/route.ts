import { NextResponse } from 'next/server';
import { checkDatabaseConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await checkDatabaseConnection({
      logToConsole: false,
      forceCheck: true,
    });

    if (result.ok) {
      return NextResponse.json(
        {
          status: 'ok',
          database: 'connected',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
      },
      { status: 500 }
    );
  }
}
