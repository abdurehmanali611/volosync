// One-off fix script: rebuild Ayomoke's log entries in the real schema shape.
const path = require('path');
const fs = require('fs');
const { Client } = require(path.join(process.cwd(), 'node_modules', 'pg'));
const { normalize } = require(path.join(process.cwd(), 'dist', 'core', 'normalize.js'));

const oldEntriesPath = path.join(process.cwd(), 'data', 'entries', 'old-entries.json');
const entriesPath = path.join(process.cwd(), 'data', 'entries', 'entries.json');

function isMissing(err) {
  return err && (err.code === 'ENOENT' || err.code === 'ENOTEMPTY');
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
}

function mv(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
}

function main() {
  const oldEntries = JSON.parse(fs.readFileSync(oldEntriesPath, 'utf8'));
  const outputs = oldEntries.map((e) => normalize(e));
  const modelOutput = JSON.parse(outputs[0].modelOutput);
  const detail = modelOutput.response.output[0].content[0].text;

  const rendered = '```markdown\n' + detail + '\n```';
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'renders', 'render-6e5133a5-3f56-4e08-bdfe-24b4442fdd5d.txt'),
    rendered,
    'utf8'
  );

  const cleanOutputs = outputs.map((o) => ({ ...o, modelOutput: '[REDACTED]' }));

  // Backup current state
  mv(entriesPath, oldEntriesPath);
  mv(path.join(process.cwd(), 'data', 'jobs.json'), path.join(process.cwd(), 'data', 'jobs.json.bak'));
  mv(path.join(process.cwd(), 'data', 'webhook-events.json'), path.join(process.cwd(), 'data', 'webhook-events.json.bak'));
  rmrf(path.join(process.cwd(), 'data', 'renders'));
  fs.mkdirSync(path.join(process.cwd(), 'data', 'renders'), { recursive: true });

  // Write new entries.json
  fs.writeFileSync(entriesPath, JSON.stringify(cleanOutputs, null, 2), 'utf8');

  const job = {
    jobId: '6e5133a5-3f56-4e08-bdfe-24b4442fdd5d',
    propertyId: 'prop-ayomoke-oyeyemi-7149',
    channel: 'email',
    inputType: 'text',
    input: {
      subject: 'Payment plan option requested',
      from: 'ayomoke.oyeyemi@gmail.com',
      text: "Hi, I'm looking at 7149 Maplewood Drive and wondering if you offer any monthly payment plans instead of paying all 12 months upfront? - Ayo",
    },
    context: {},
    priority: 'high',
    status: 'completed',
    policyVersion: 1,
    attempts: 1,
    maxAttempts: 3,
    enqueuedAt: '2026-12-02T20:36:05.467Z',
    startedAt: '2026-12-02T20:37:09.120Z',
    finishedAt: '2026-12-02T20:37:25.994Z',
    result: {
      summary:
        "Tenant Ayomoke Oyeyemi (ayomoke.oyeyemi@gmail.com) asks about monthly payment plan options instead of 12-month upfront for 7149 Maplewood Drive ($1,800/mo). Landlord's custom answer needed.",
      classification: { category: 'inquiry', priority: 'high' },
      renderRef: 'render-6e5133a5-3f56-4e08-bdfe-24b4442fdd5d',
    },
    error: undefined,
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'jobs.json'),
    JSON.stringify([job], null, 2),
    'utf8'
  );

  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'webhook-events.json'),
    '[]',
    'utf8'
  );

  // Verify against production code path
  const { loadJobs } = require(path.join(process.cwd(), 'dist', 'core', 'jobs.js'));
  const loaded = loadJobs();
  console.log('loadJobs returned:', JSON.stringify(loaded, null, 2));

  // DB verify
  const dbUrl = process.env.VOLOSYPG_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('NO DATABASE URL; skipping db verify. Check .env for VOLOSYPG_DATABASE_URL or DATABASE_URL.');
    process.exitCode = 2;
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  client.on('error', (e) => console.error('client error', e.message));
  const safe = async (label, sql) => {
    try {
      const res = await client.query(sql);
      console.log(label, JSON.stringify(res.rows));
    } catch (err) {
      console.log(label, 'ERR:', err.message);
    }
  };
  await client.connect();
  await safe('properties:', "select id, address, city, state, monthly_rent from properties");
  await safe('tenants:', "select id, name, email, phone, property_id from tenants");
  await safe('jobs:', "select * from jobs");
  await safe('logs:', "select * from logs");
  await client.end();
}

main().catch((e) => {
  console.error('SCRIPT FAILED:', e);
  process.exit(1);
});
