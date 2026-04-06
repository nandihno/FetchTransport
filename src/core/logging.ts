export function logStep(message: string): void {
  console.log(`[fetchtransport] ${message}`);
}

export function logSummary(title: string, lines: string[]): void {
  console.log(`[fetchtransport] ${title}`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}
