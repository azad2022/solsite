import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const settingsPath = path.resolve(process.cwd(), 'data/settings.json');

try {
  if (!fs.existsSync(settingsPath)) process.exit(0);

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings || typeof settings !== 'object') process.exit(0);

  // A missing chatbot configuration must never implicitly enable the public bot.
  // The admin panel can explicitly enable it later through /api/cms/settings.
  if (!settings.chatbot || typeof settings.chatbot !== 'object') {
    settings.chatbot = {
      enabled: false,
      title: 'پشتیبان هوشمند سولمینت',
      initialMessage: 'سلام! 👋 من پشتیبان هوشمند سولمینت هستم. چطور می‌توانم کمکتان کنم؟',
      systemPrompt: '',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    };
    const tempPath = `${settingsPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tempPath, settingsPath);
    console.log('✅ CMS settings normalized: missing chatbot configuration defaults to disabled.');
  }
} catch (error) {
  console.error('⚠️ Could not normalize CMS settings:', error?.message || error);
}
