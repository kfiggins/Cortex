export async function main(): Promise<void> {
  console.log('Cortex starting...');
}

// Only run when executed directly (not imported in tests)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
