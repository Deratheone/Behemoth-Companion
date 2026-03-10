/**
 * Simple Gemini AI chatbot using AI SDK
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `You are Behemoth Companion, a helpful and friendly AI chatbot. Answer questions naturally and conversationally. Keep responses concise and clear.

When the user shares their location, time, and/or weather data, you will receive it in the format:
[Context: Current date/time: ... | User location: Latitude ..., Longitude ... | Current weather: ...]

Use this contextual information to provide more relevant and personalized responses. For example:
- Give time-appropriate greetings (good morning, afternoon, evening)
- Provide location-aware information when relevant
- Consider the current date/time for time-sensitive queries
- Use weather data to give context-aware advice (e.g., "Since it's raining, you might want to...")
- Answer weather-related questions accurately using the provided current conditions

If no context is provided, respond normally without assuming location, time, or weather information.`;

export async function chatWithGemini(message: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt: message,
      temperature: 0.7,
    });
    
    return text.trim();
  } catch (error: any) {
    console.error('Gemini API error:', error?.message);
    throw new Error('Failed to get AI response');
  }
}
