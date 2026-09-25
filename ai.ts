import { GoogleGenAI } from '@google/genai';
import {
  getAvailableSlots,
  findNextAvailableSlotForAnyBarber,
  getSalonsByCityName,
  getAllSalons,
  getServicesBySalon,
  getBarbersBySalon,
  getActiveOffersAll,
  getCustomerByPhone,
  getBookingsByPhone,
  getSalonDetailForBot,
  getSalonReviews,
} from './db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

type AIProvider = 'gemini' | 'groq' | 'none';
let activeProvider: AIProvider = 'none';
let aiClient: GoogleGenAI | null = null;
let groqKey: string | null = null;

if (GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key-here') {
  activeProvider = 'groq';
  groqKey = GROQ_API_KEY;
  console.log('[AI] Groq AI initialized');
} else if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key-here') {
  activeProvider = 'gemini';
  try {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[AI] Gemini AI initialized');
  } catch (e: any) {
    console.warn('[AI] Failed to init Gemini:', e?.message);
    activeProvider = 'none';
  }
} else {
  console.warn('[AI] No AI key configured. Set GEMINI_API_KEY or GROQ_API_KEY in .env');
}

export function getActiveAIProvider(): AIProvider {
  return activeProvider;
}

export function isAiAvailable(): boolean {
  return activeProvider !== 'none';
}

async function callGroq(systemPrompt: string, userInput: string, history: { role: string; text: string }[]): Promise<string> {
  if (!groqKey) throw new Error('Groq API key not configured');

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: userInput },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq error ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const SYSTEM_PROMPT = `You are AutoZap, a WhatsApp assistant for a salon booking platform. Your job is to understand natural language queries and convert them into structured commands.

Available commands you can output:
- BOOK: Start a new booking flow
- PROFILE: Show user profile
- BOOKINGS: Show user bookings
- RATE {token} {rating} {comment?}: Rate a booking
- RESCHEDULE {token}: Reschedule a booking
- CANCEL {token}: Cancel a booking
- OFFERS: Show active offers
- SLOT {barber_id}: Check barber slots
- NEARBY: Find nearby salons
- REFER: Get referral code
- RECURRING: Show recurring bookings
- HELP: Show help
- GREETING: Respond to greetings
- UNKNOWN: When you cannot determine intent

Rules:
1. If user says "hi", "hello", "salam", "assalamualaikum", "hey", "good morning" etc → GREETING
2. If user says "book", "appointment", "schedule", "cut", "haircut", "barber", "salon", "new booking", "1" → BOOK
3. If user mentions "profile", "my info", "account" → PROFILE
4. If user says "my bookings", "appointments", "history", "3" → BOOKINGS
5. If user says "rate", "review", "rating" with a token number like #A7K2 → RATE
6. If user says "reschedule", "change date", "change time", "reschedule #XYZ123" → RESCHEDULE
7. If user says "cancel", "remove", "cancel #XYZ123" → CANCEL
8. If user says "offers", "discount", "deals", "promotions" → OFFERS
9. If user says "slot", "available", "free", "slot 2" → SLOT
10. If user says "nearby", "near me", "close", "location" → NEARBY
11. If user says "refer", "referral", "share", "invite" → REFER
12. If user says "recurring", "repeat", "subscription" → RECURRING
13. If user says "help", "commands", "menu", "what can you do" → HELP

Output ONLY as JSON:
{"action": "COMMAND", "params": {}, "reply": "short user-friendly response in Urdu/English mix"}

Example:
User: "mujhe nayi booking karni hai"
Ouput: {"action":"BOOK","params":{},"reply":"Chaliye nayi booking shuru karte hain! Kahan se hain aap?"}

User: "hello"
Output: {"action":"GREETING","params":{},"reply":"Assalamualaikum! 👋 Main AutoZap hoon. Kya aap booking karwana chahenge?"}

User: "rate #A7K2 5 great service"
Output: {"action":"RATE","params":{"token":"#A7K2","rating":5,"comment":"great service"},"reply":"Shukriya! Aapki rating submit kar di gayi hai ✅"}

User: "mere bookings dikhao"
Output: {"action":"BOOKINGS","params":{},"reply":"Yeh rahi aapki bookings:"}

User: "cancel #B3X9M"
Output: {"action":"CANCEL","params":{"token":"#B3X9M"},"reply":"Kya aap ye booking cancel karna chahte hain?"}

IMPORTANT: Keep it simple. If unsure, use UNKNOWN. Always respond bilingually (Urdu/Hindi + English mix).`;

const MAX_HISTORY = 5;

interface AiResult {
  action: string;
  params: Record<string, any>;
  reply: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  _ts: number;
}

const conversations = new Map<string, ConversationMessage[]>();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key] of conversations) {
    const lastMsg = conversations.get(key);
    if (lastMsg && lastMsg.length > 0) {
      const lastTimestamp = lastMsg[lastMsg.length - 1] as any;
      if (lastTimestamp._ts && lastTimestamp._ts < cutoff) {
        conversations.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

export function getConversation(sender: string): ConversationMessage[] {
  return conversations.get(sender) || [];
}

export function addToConversation(sender: string, role: 'user' | 'assistant', text: string) {
  const conv = conversations.get(sender) || [];
  conv.push({ role, text, _ts: Date.now() });
  if (conv.length > MAX_HISTORY * 2) {
    conv.splice(0, conv.length - MAX_HISTORY * 2);
  }
  conversations.set(sender, conv);
}

export function clearConversation(sender: string) {
  conversations.delete(sender);
}

export async function processWithAI(sender: string, userInput: string): Promise<AiResult | null> {
  if (!isAiAvailable()) {
    return null;
  }

  try {
    const conv = getConversation(sender);
    let text = '';

    if (activeProvider === 'groq') {
      text = await callGroq(SYSTEM_PROMPT, userInput, conv);
    } else if (activeProvider === 'gemini' && aiClient) {
      const historyParts = conv.map(c => ({
        role: c.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: c.text }]
      }));

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: '{"action":"OK","params":{},"reply":"Ready"}' }] },
          ...historyParts,
          { role: 'user', parts: [{ text: userInput }] },
        ],
      });

      text = response.text?.trim() || '';
    } else {
      return null;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { action: 'UNKNOWN', params: {}, reply: 'Maaf karna, main samajh nahi paya. Kya aap dobara bata sakte hain?' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    addToConversation(sender, 'user', userInput);
    addToConversation(sender, 'assistant', parsed.reply || '');

    return {
      action: parsed.action || 'UNKNOWN',
      params: parsed.params || {},
      reply: parsed.reply || '',
    };
  } catch (e: any) {
    console.warn('[AI] Error:', e?.message);
    return null;
  }
}
