/**
 * LLM Test Service
 *
 * 테스트 실행 로직 + 자동 스케줄러
 */

import { prisma } from '../index.js';

const LLM_TEST_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;
const SCHEDULER_CHECK_INTERVAL_MS = 30_000; // 30초마다 체크

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false; // 동시 실행 방지

// ==================== Helper Functions ====================

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function buildChatCompletionUrl(endpointUrl: string): string {
  let url = endpointUrl.trim().replace(/\/+$/, '');
  if (url.endsWith('/chat/completions')) return url;
  if (url.endsWith('/completions')) return url.replace(/\/completions$/, '/chat/completions');
  if (url.endsWith('/v1')) return `${url}/chat/completions`;
  return `${url}/chat/completions`;
}

function extractJSON<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch { /* continue */ }

  const withoutTags = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();

  try {
    return JSON.parse(withoutTags) as T;
  } catch { /* continue */ }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch { /* continue */ }
  }

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed) as T;
      } catch { /* continue */ }
    }
  }

  throw new Error(`No valid JSON found in response`);
}

async function sendLLMRequestJSON<T>(
  endpoint: string,
  modelName: string,
  apiKey: string | null,
  messages: { role: string; content: string }[],
  jsonSchema?: { name: string; schema: object },
  extraHeaders?: Record<string, string> | null
): Promise<{ data: T; latencyMs: number }> {
  const url = buildChatCompletionUrl(endpoint);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'content-type' && lowerKey !== 'authorization') {
        headers[key] = value;
      }
    }
  }

  let lastError: Error | null = null;
  let useStructuredOutput = true;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();

    try {
      const requestBody: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: 0.7,
      };

      if (useStructuredOutput && jsonSchema) {
        requestBody.response_format = {
          type: 'json_schema',
          json_schema: {
            name: jsonSchema.name,
            strict: true,
            schema: jsonSchema.schema,
          },
        };
      }

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      }, LLM_TEST_TIMEOUT_MS);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 400 && errorText.includes('response_format')) {
          useStructuredOutput = false;
        }
        throw new Error(`LLM request failed (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const responseData = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = responseData.choices?.[0]?.message?.content || '';

      const parsed = extractJSON<T>(content);
      return { data: parsed, latencyMs };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`[LLMTest] Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);

      if (lastError.message.includes('No valid JSON') || lastError.message.includes('JSON parse')) {
        useStructuredOutput = false;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}

// ==================== JSON Schemas ====================

const QUESTION_SCHEMA = {
  name: 'question_response',
  schema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The generated question' },
    },
    required: ['question'],
    additionalProperties: false,
  },
};

const ANSWER_SCHEMA = {
  name: 'answer_response',
  schema: {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The answer to the question' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level' },
    },
    required: ['answer', 'confidence'],
    additionalProperties: false,
  },
};

const EVALUATION_SCHEMA = {
  name: 'evaluation_response',
  schema: {
    type: 'object',
    properties: {
      score: { type: 'number', description: 'Score from 1-100' },
      reasoning: { type: 'string', description: 'Brief reasoning for the score' },
    },
    required: ['score', 'reasoning'],
    additionalProperties: false,
  },
};

interface QuestionResponse { question: string; }
interface AnswerResponse { answer: string; confidence: 'high' | 'medium' | 'low'; }
interface EvaluationResponse { score: number; reasoning: string; }

// ==================== Test Execution ====================

export interface TestPairInput {
  id: string;
  name: string;
  questionerModelName: string;
  questionerEndpoint: string;
  questionerApiKey: string | null;
  questionerExtraHeaders?: Record<string, string> | null;
  testModelName: string;
  testEndpoint: string;
  testApiKey: string | null;
  testExtraHeaders?: Record<string, string> | null;
  questionPrompt: string;
  evaluationPrompt: string;
}

export interface TestResult {
  latencyMs: number;
  score: number | null;
  status: string;
  errorMessage: string | null;
}

/**
 * 단일 테스트 실행
 */
export async function runTest(pair: TestPairInput): Promise<TestResult> {
  try {
    // 1. 질문 생성
    console.log(`[LLMTest] Generating question for pair ${pair.id}...`);
    const questionerExtra = pair.questionerExtraHeaders as Record<string, string> | null | undefined;
    const testExtra = pair.testExtraHeaders as Record<string, string> | null | undefined;

    const questionResult = await sendLLMRequestJSON<QuestionResponse>(
      pair.questionerEndpoint,
      pair.questionerModelName,
      pair.questionerApiKey,
      [
        { role: 'system', content: 'You are a question generator. Always respond in JSON format: {"question": "your question here"}' },
        { role: 'user', content: pair.questionPrompt },
      ],
      QUESTION_SCHEMA,
      questionerExtra
    );
    const question = questionResult.data.question;
    console.log(`[LLMTest] Question: "${question.slice(0, 100)}..."`);

    // 2. 테스트 LLM 응답
    console.log(`[LLMTest] Sending to test LLM...`);
    const testResult = await sendLLMRequestJSON<AnswerResponse>(
      pair.testEndpoint,
      pair.testModelName,
      pair.testApiKey,
      [
        { role: 'system', content: 'You are a helpful AI assistant. Answer the question accurately and concisely. Always respond in JSON format: {"answer": "your answer", "confidence": "high|medium|low"}' },
        { role: 'user', content: question },
      ],
      ANSWER_SCHEMA,
      testExtra
    );
    const testLatencyMs = testResult.latencyMs;
    const answer = testResult.data.answer;
    const confidence = testResult.data.confidence;
    console.log(`[LLMTest] Response in ${testLatencyMs}ms (confidence: ${confidence}): "${answer.slice(0, 100)}..."`);

    // 3. 평가
    console.log(`[LLMTest] Evaluating...`);
    const evalResult = await sendLLMRequestJSON<EvaluationResponse>(
      pair.questionerEndpoint,
      pair.questionerModelName,
      pair.questionerApiKey,
      [
        { role: 'system', content: 'You are an AI response evaluator. Always respond in JSON format: {"score": <1-100>, "reasoning": "brief explanation"}' },
        { role: 'user', content: `${pair.evaluationPrompt}\n\nQuestion: ${question}\n\nResponse to evaluate:\n${answer}\n\n(Model's self-reported confidence: ${confidence})` },
      ],
      EVALUATION_SCHEMA,
      questionerExtra
    );

    const score = Math.min(100, Math.max(1, Math.round(evalResult.data.score)));
    console.log(`[LLMTest] Score: ${score}, Reasoning: ${evalResult.data.reasoning.slice(0, 100)}...`);

    return { latencyMs: testLatencyMs, score, status: 'SUCCESS', errorMessage: null };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? (error.name === 'AbortError' ? 'Request timed out' : error.message)
      : 'Unknown error';
    console.error(`[LLMTest] Error for pair ${pair.id}:`, errorMessage);

    return {
      latencyMs: 0,
      score: null,
      status: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      errorMessage,
    };
  }
}

/**
 * 테스트 실행 + DB 저장
 */
export async function runTestAndSave(pairId: string): Promise<TestResult> {
  const pair = await prisma.lLMTestPair.findUnique({ where: { id: pairId } });
  if (!pair) throw new Error(`Test pair not found: ${pairId}`);

  const result = await runTest(pair as unknown as TestPairInput);

  await prisma.lLMTestResult.create({
    data: {
      pairId,
      latencyMs: result.latencyMs,
      score: result.score,
      status: result.status,
      errorMessage: result.errorMessage,
    },
  });

  await prisma.lLMTestPair.update({
    where: { id: pairId },
    data: { lastRunAt: new Date() },
  });

  return result;
}

// ==================== Scheduler ====================

/**
 * 실행이 필요한 테스트 쌍 조회
 */
async function getTestPairsDue() {
  const pairs = await prisma.lLMTestPair.findMany({
    where: { enabled: true },
  });

  const now = Date.now();

  return pairs.filter(pair => {
    if (!pair.lastRunAt) return true; // 한 번도 실행 안 됨
    const elapsed = now - pair.lastRunAt.getTime();
    const intervalMs = pair.intervalMinutes * 60 * 1000;
    return elapsed >= intervalMs;
  });
}

/**
 * 스케줄러 틱 - 실행 필요한 쌍들을 순차 실행
 */
async function schedulerTick() {
  if (isRunning) {
    console.log('[LLMTest Scheduler] Previous run still in progress, skipping...');
    return;
  }

  isRunning = true;
  try {
    const duePairs = await getTestPairsDue();

    if (duePairs.length === 0) return;

    console.log(`[LLMTest Scheduler] Running ${duePairs.length} test(s)...`);

    for (const pair of duePairs) {
      try {
        console.log(`[LLMTest Scheduler] Running test: ${pair.name} (${pair.id})`);
        await runTestAndSave(pair.id);
      } catch (error) {
        console.error(`[LLMTest Scheduler] Failed: ${pair.name}`, error);
      }
    }

    console.log(`[LLMTest Scheduler] Completed ${duePairs.length} test(s)`);
  } catch (error) {
    console.error('[LLMTest Scheduler] Error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * 스케줄러 시작
 */
export function startLLMTestScheduler() {
  if (schedulerTimer) {
    console.log('[LLMTest Scheduler] Already running');
    return;
  }

  console.log(`[LLMTest Scheduler] Started (checking every ${SCHEDULER_CHECK_INTERVAL_MS / 1000}s)`);
  schedulerTimer = setInterval(schedulerTick, SCHEDULER_CHECK_INTERVAL_MS);

  // 서버 시작 후 10초 뒤 첫 체크
  setTimeout(schedulerTick, 10_000);
}

/**
 * 스케줄러 중지
 */
export function stopLLMTestScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[LLMTest Scheduler] Stopped');
  }
}
