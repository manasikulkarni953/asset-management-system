export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkDatabaseConnection } = await import('@/lib/db');
    await checkDatabaseConnection({ logToConsole: true });
  }
}
