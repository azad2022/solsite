import { ChatbotSettings, DeepSeekAiSettings } from '../types';
import { getSupabaseClient } from './supabaseClient';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Public-site chatbot transport.
 *
 * The browser deliberately does not receive or send the DeepSeek API key.
 * The Supabase Edge Function owns provider credentials and site knowledge.
 */
export async function sendDeepSeekChatMessage(
  messages: ChatMessage[],
  _chatbotSettings: ChatbotSettings,
  _deepseekSettings: DeepSeekAiSettings
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is unavailable.');
  }

  const cleanMessages = messages
    .filter(message => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-12)
    .map(message => ({
      role: message.role,
      content: message.content.trim().slice(0, 2000)
    }))
    .filter(message => message.content.length > 0);

  if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== 'user') {
    throw new Error('Invalid chat history.');
  }

  const { data, error } = await client.functions.invoke('deepseek-chat', {
    body: { messages: cleanMessages }
  });

  if (error) {
    throw new Error(error.message || 'Chat service request failed.');
  }

  if (!data?.success || typeof data.content !== 'string') {
    throw new Error(data?.message || 'Chat service returned an invalid response.');
  }

  return data.content.trim();
}
