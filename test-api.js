const fs = require('fs');
const path = require('path');

// Read .env.local manually - handle BOM and various line endings
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  // Remove BOM if present
  line = line.replace(/^\uFEFF/, '');
  // Skip comments and empty lines
  if (!line || line.startsWith('#')) return;
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
});

console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('ANTHROPIC_API_KEY first 20 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 20));

async function testAPI(name, testFn) {
  try {
    const result = await testFn();
    console.log(`✅ ${name}: WORKING - ${result.substring(0, 30)}...`);
    return true;
  } catch (e) {
    console.log(`❌ ${name}: BROKEN - ${e.message}`);
    return false;
  }
}

async function main() {
  const { Anthropic } = require('@anthropic-ai/sdk');
  const OpenAI = require('openai').default;

  console.log('\n=== API TEST ===\n');

  // Test Claude
  await testAPI('CLAUDE', async () => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 20,
      messages: [{ role: 'user', content: 'Hi' }]
    });
    return res.content[0].text;
  });

  // Test GPT
  await testAPI('GPT-4O', async () => {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 20
    });
    return res.choices[0].message.content;
  });

  // Test Grok
  await testAPI('GROK', async () => {
    const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
    const res = await client.chat.completions.create({
      model: 'grok-3',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 20
    });
    return res.choices[0].message.content;
  });

  // Test DeepSeek
  await testAPI('DEEPSEEK', async () => {
    const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
    const res = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 20
    });
    return res.choices[0].message.content;
  });

  // Test Kimi
  await testAPI('KIMI', async () => {
    const client = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: 'https://api.moonshot.ai/v1' });
    const res = await client.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 20
    });
    return res.choices[0].message.content;
  });

  console.log('\n=== DONE ===');
}

main().catch(console.error);
