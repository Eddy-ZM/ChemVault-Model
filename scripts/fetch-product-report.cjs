const daysArgument = process.argv.find((argument) => argument.startsWith('--days='));
const days = daysArgument ? Number(daysArgument.slice('--days='.length)) : 30;
const baseUrl = (process.env.CHEMVAULT_MODEL_ORIGIN || 'https://model.chemvault.science').replace(/\/+$/u, '');
const token = process.env.CHEMVAULT_METRICS_TOKEN || '';

if (!token) {
  console.error('CHEMVAULT_METRICS_TOKEN is required.');
  process.exit(1);
}
if (!Number.isInteger(days) || days < 1 || days > 90) {
  console.error('--days must be an integer from 1 to 90.');
  process.exit(1);
}

(async () => {
  const response = await fetch(`${baseUrl}/api/product-events/report?days=${days}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Product report request failed (${response.status}): ${body.slice(0, 300)}`);
  console.log(JSON.stringify(JSON.parse(body), null, 2));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
