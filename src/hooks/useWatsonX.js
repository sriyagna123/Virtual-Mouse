/**
 * useWatsonX.js
 * Hook for IBM WatsonX AI integration.
 * Sends gesture context to WatsonX Llama 3.3 70B and streams back AI tips/analysis.
 */

import { useState, useRef, useCallback } from 'react';

const WATSONX_URL = 'https://eu-de.ml.cloud.ibm.com';
const MODEL_ID = 'meta-llama/llama-3-3-70b-instruct';
const PROJECT_ID = '935d5af6-f4b5-4936-9198-407361efaaae';
const API_KEY = 't7xu22ms7IfdSq57bKMHlx6falgrmozttXYoJyz00VmM';

/**
 * Fetches an IAM access token from IBM Cloud using the API key.
 * Tokens are cached for 55 minutes.
 */
let cachedToken = null;
let tokenExpiry = 0;

async function getIAMToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const resp = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${API_KEY}`,
  });

  if (!resp.ok) throw new Error(`IAM token error: ${resp.statusText}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = now + 55 * 60 * 1000; // 55 minutes
  return cachedToken;
}

/**
 * Sends a prompt to WatsonX and returns the generated text.
 */
async function queryWatsonX(prompt) {
  const token = await getIAMToken();

  const payload = {
    model_id: MODEL_ID,
    project_id: PROJECT_ID,
    input: prompt,
    parameters: {
      decoding_method: 'greedy',
      max_new_tokens: 250,
      stop_sequences: ['\n\n'],
      repetition_penalty: 1.1,
    },
  };

  const resp = await fetch(
    `${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`WatsonX error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.results?.[0]?.generated_text?.trim() || 'No response generated.';
}

/**
 * useWatsonX hook
 * Provides AI-powered gesture tips, analysis, and accessibility recommendations.
 */
export function useWatsonX() {
  const [aiTip, setAiTip] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [gestureHistory, setGestureHistory] = useState([]);
  const lastQueryTime = useRef(0);

  /**
   * Request an AI tip based on the current gesture and session context.
   * Throttled to once every 8 seconds to avoid excessive API calls.
   */
  const requestGestureTip = useCallback(async (gesture, sessionStats) => {
    const now = Date.now();
    if (now - lastQueryTime.current < 8000) return; // throttle
    lastQueryTime.current = now;

    // Update gesture history
    setGestureHistory((prev) => {
      const next = [...prev, gesture].slice(-10);
      return next;
    });

    setAiLoading(true);
    setAiError(null);

    const prompt = `You are an AI assistant for a virtual mouse application powered by hand gesture recognition.

Current gesture detected: "${gesture}"
Session stats: FPS=${sessionStats.fps}, Confidence=${sessionStats.confidence}%, Gestures used: ${sessionStats.gestureHistory?.join(', ') || 'none'}

In 1-2 short sentences, provide a helpful tip or insight about the current gesture or how to improve control accuracy. Be concise and practical.

Tip:`;

    try {
      const text = await queryWatsonX(prompt);
      setAiTip(text);
    } catch (err) {
      setAiError('AI assistant unavailable. Check your connection.');
      console.error('[WatsonX]', err);
    } finally {
      setAiLoading(false);
    }
  }, []);

  /**
   * Ask WatsonX for accessibility recommendations based on session data.
   */
  const requestAccessibilityAdvice = useCallback(async (sessionData) => {
    setAiLoading(true);
    setAiError(null);

    const prompt = `You are an accessibility expert for a hand-gesture-controlled virtual mouse.

Session data:
- Average FPS: ${sessionData.avgFps}
- Primary gestures used: ${sessionData.topGestures?.join(', ')}
- Session duration: ${sessionData.duration} seconds
- Confidence range: ${sessionData.minConfidence}%-${sessionData.maxConfidence}%

Provide 2-3 brief accessibility improvement suggestions for this user. Focus on comfort and efficiency.

Suggestions:`;

    try {
      const text = await queryWatsonX(prompt);
      setAiTip(text);
    } catch (err) {
      setAiError('AI assistant unavailable.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  /**
   * Get a welcome message explaining how to use the app.
   */
  const requestWelcomeMessage = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);

    const prompt = `You are the AI guide for a futuristic virtual mouse app controlled by hand gestures via webcam using MediaPipe Hands.

Write a friendly 2-sentence welcome message that:
1. Explains the app excitingly
2. Tells the user the first step to get started

Welcome:`;

    try {
      const text = await queryWatsonX(prompt);
      setAiTip(text);
    } catch (err) {
      setAiTip('Welcome to Virtual Mouse AI! Position your hand in front of the camera to begin controlling your cursor with gestures.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  return {
    aiTip,
    aiLoading,
    aiError,
    gestureHistory,
    requestGestureTip,
    requestAccessibilityAdvice,
    requestWelcomeMessage,
  };
}
