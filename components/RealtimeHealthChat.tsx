"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PcmCapture } from "@/lib/audio/pcmCapture";
import { PcmPlayer } from "@/lib/audio/pcmPlayer";
import { RealtimeInitPayload, useRealtimeHealthSocket } from "@/hooks/useRealtimeHealthSocket";

type ConditionType = "diabetes" | "heart-disease";

interface HistoryEntry {
  _id?: string;
  date?: string;
  condition?: string;
  inputMetrics?: Record<string, unknown>;
  riskScore?: number;
  riskLevel?: string;
  prediction?: string;
  probability?: number;
  result?: {
    prediction?: string;
    probability?: number;
    riskScore?: number;
    riskLevel?: string;
    advice?: {
      risk_level?: string;
      score?: number;
      suggestions?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

interface PredictionHistoryResponse {
  history?: HistoryEntry[];
}

interface ProfileResponse {
  healthData?: Record<string, unknown> | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface SanitizedHistoryItem extends Record<string, unknown> {
  date: string | null;
  inputMetrics: Record<string, unknown>;
  predictionSummary: {
    prediction: string | null;
    probability: number | null;
    riskScore: number | null;
    riskLevel: string | null;
  };
}

const NOISE_FLOOR_INITIAL_RMS = 0.006;
const NOISE_FLOOR_EMA_ALPHA = 0.08;
const NOISE_FLOOR_MAX_RMS = 0.03;
const NOISE_GATE_MIN_OPEN_RMS = 0.012;
const NOISE_GATE_MIN_CLOSE_RMS = 0.009;
const USER_SPEECH_HOLD_MS = 250;
const PRE_SPEECH_FRAME_COUNT = 2;
const AUDIO_BATCH_TARGET_FRAMES = 2;
const AUDIO_MAX_QUEUE_FRAMES = 6;
const AUDIO_MAX_HOLD_MS = 24;
const AUDIO_HIGH_BUFFERED_BYTES = 128 * 1024;

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toSafeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const DIABETES_KEYS = new Set([
  "gender",
  "age",
  "height",
  "weight",
  "hypertension",
  "heartDisease",
  "smokingHistory",
  "bmi",
  "hbA1cLevel",
  "bloodGlucoseLevel",
]);

const HEART_KEYS = new Set([
  "age",
  "sex",
  "chest_pain_type",
  "resting_bp",
  "cholesterol",
  "fasting_blood_sugar",
  "resting_ecg",
  "max_heart_rate",
  "exercise_angina",
  "oldpeak",
  "st_slope",
]);

function normalizeRiskLevel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("high")) return "high";
  if (normalized.includes("moderate")) return "moderate";
  if (normalized.includes("low")) return "low";
  return normalized;
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    output[key] = value;
  });
  return output;
}

function estimateChunkRms(pcm16: Int16Array): number {
  if (pcm16.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < pcm16.length; i += 1) {
    const normalized = pcm16[i] / 32768;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / pcm16.length);
}

function pickConditionFields(
  data: Record<string, unknown>,
  condition: ConditionType,
): Record<string, unknown> {
  const allowList = condition === "diabetes" ? DIABETES_KEYS : HEART_KEYS;
  const output: Record<string, unknown> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (!allowList.has(key) || value === null || value === undefined || value === "") {
      return;
    }
    output[key] = value;
  });

  return output;
}

function sanitizeHistoryEntry(entry: HistoryEntry): SanitizedHistoryItem {
  const prediction =
    toSafeString(entry.prediction)
    ?? toSafeString(entry.result?.prediction)
    ?? null;

  const probability =
    toSafeNumber(entry.probability)
    ?? toSafeNumber(entry.result?.probability)
    ?? null;

  const riskScore =
    toSafeNumber(entry.riskScore)
    ?? toSafeNumber(entry.result?.riskScore)
    ?? toSafeNumber(entry.result?.advice?.score)
    ?? null;

  const riskLevel =
    toSafeString(entry.riskLevel)
    ?? toSafeString(entry.result?.riskLevel)
    ?? toSafeString(entry.result?.advice?.risk_level)
    ?? null;

  // Keep only compact fields to avoid sending long LLM guide/suggestions.
  return {
    date: toSafeString(entry.date),
    inputMetrics: compactObject(entry.inputMetrics ?? {}),
    predictionSummary: {
      prediction,
      probability,
      riskScore,
      riskLevel: normalizeRiskLevel(riskLevel),
    },
  };
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

interface RealtimeHealthChatProps {
  wsUrl?: string;
}

function createTimestampChatId(): string {
  return Date.now().toString();
}

function prettyConnectionLabel(value: string): string {
  switch (value) {
    case "live":
      return "Live";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "closed":
      return "Disconnected";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

export default function RealtimeHealthChat({ wsUrl }: RealtimeHealthChatProps) {
  const { data: session, status } = useSession();
  const typedUser = session?.user as SessionUser | undefined;
  const messageIdCounterRef = useRef(0);

  const [conditionType, setConditionType] = useState<ConditionType>("diabetes");
  const [chatId, setChatId] = useState<string>(createTimestampChatId);
  const [extraContext, setExtraContext] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [profileHealthData, setProfileHealthData] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isMicStreaming, setIsMicStreaming] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [micPermission, setMicPermission] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [autoStartMicOnReady, setAutoStartMicOnReady] = useState(false);
  const [audioChunksSent, setAudioChunksSent] = useState(0);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [lastSentChunkSizeBytes, setLastSentChunkSizeBytes] = useState(0);
  const [lastSentChunkAt, setLastSentChunkAt] = useState<number | null>(null);
  const [lastSentChunkRms, setLastSentChunkRms] = useState(0);
  const [sentChunksPerSecond, setSentChunksPerSecond] = useState(0);
  const [visualizerLevel, setVisualizerLevel] = useState(0.12);
  const visualizerPhaseRef = useRef(0);

  const pcmCaptureRef = useRef<PcmCapture | null>(null);
  const pcmPlayerRef = useRef<PcmPlayer | null>(null);
  const lastAssistantAudioAtRef = useRef(0);
  const lastUserSpeechAtRef = useRef(0);
  const suppressAssistantAudioUntilRef = useRef(0);
  const userSpeakingRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const sentChunkTimesRef = useRef<number[]>([]);
  const queuedAudioFramesRef = useRef<Int16Array[]>([]);
  const preSpeechFramesRef = useRef<Int16Array[]>([]);
  const noiseFloorRmsRef = useRef(NOISE_FLOOR_INITIAL_RMS);
  const queueFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClearHistoryRef = useRef(false);
  const serverSupportsClearHistoryRef = useRef(true);

  const createMessageId = useCallback((role: ChatMessage["role"]) => {
    messageIdCounterRef.current += 1;
    return `${role}-${Date.now()}-${messageIdCounterRef.current}`;
  }, []);

  const resolvedWsUrl = wsUrl?.trim() || "";
  const userId = typedUser?.id || typedUser?.email || "";
  const displayName = typedUser?.name?.trim() || "there";

  const conditionHistory = useMemo(() => {
    const compacted = history
      .filter((entry) => entry.condition === conditionType)
      .slice(0, 5)
      .map((entry) => sanitizeHistoryEntry(entry))
      .map((entry) => ({
        ...entry,
        inputMetrics: pickConditionFields(entry.inputMetrics, conditionType),
      }));

    // Drop duplicate entries that often come from repeated write events in history.
    const seen = new Set<string>();
    return compacted.filter((entry) => {
      const key = JSON.stringify(entry.inputMetrics) + JSON.stringify(entry.predictionSummary);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).slice(0, 5);
  }, [conditionType, history]);

  const scopedHealthData = useMemo(() => {
    return pickConditionFields(profileHealthData, conditionType);
  }, [conditionType, profileHealthData]);

  const initPayload: RealtimeInitPayload | null = useMemo(() => {
    if (!userId || status !== "authenticated") {
      return null;
    }

    return {
      userId,
      chatId,
      name: displayName,
      conditionType,
      healthData: scopedHealthData,
      history: conditionHistory,
      extraContext: extraContext.trim() || undefined,
    };
  }, [chatId, conditionHistory, conditionType, displayName, extraContext, scopedHealthData, status, userId]);

  const commitAssistantDraft = useCallback(() => {
    setAssistantDraft((currentDraft) => {
      const finalText = currentDraft.trim();
      if (finalText) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId("assistant"),
            role: "assistant",
            text: finalText,
          },
        ]);
      }
      return "";
    });
  }, [createMessageId]);

  const handleAssistantDelta = useCallback((delta: string) => {
    setAssistantDraft((prev) => prev + delta);
  }, []);

  const handleAssistantTurnComplete = useCallback(() => {
    pendingClearHistoryRef.current = true;
    commitAssistantDraft();
  }, [commitAssistantDraft]);

  useEffect(() => {
    assistantSpeakingRef.current = assistantSpeaking;
  }, [assistantSpeaking]);

  const stopAssistantPlayback = useCallback((suppressMs = 0) => {
    pcmPlayerRef.current?.interrupt();
    setAssistantSpeaking(false);
    if (suppressMs > 0) {
      suppressAssistantAudioUntilRef.current = Date.now() + suppressMs;
    }
  }, []);

  const handleAssistantAudio = useCallback(async (audioBase64: string) => {
    try {
      if (userSpeakingRef.current || Date.now() < suppressAssistantAudioUntilRef.current) {
        return;
      }

      if (!pcmPlayerRef.current) {
        pcmPlayerRef.current = new PcmPlayer(24000);
      }
      lastAssistantAudioAtRef.current = Date.now();
      setAssistantSpeaking(true);
      await pcmPlayerRef.current.playBase64Chunk(audioBase64);
    } catch (audioError) {
      console.error("Audio playback error", audioError);
    }
  }, []);

  const handleRealtimeError = useCallback((message: string) => {
    // Older backend versions don't support clear_history; ignore this specific capability error.
    if (
      pendingClearHistoryRef.current
      && message.includes("Unknown event type")
      && message.includes("user_audio")
      && message.includes("user_interrupt")
      && message.includes("ping")
    ) {
      pendingClearHistoryRef.current = false;
      serverSupportsClearHistoryRef.current = false;
      return;
    }

    setUiError(message);
  }, []);

  const updateOutgoingAudioTelemetry = useCallback((chunkSizeBytes: number, rms: number) => {
    const now = Date.now();
    const nextTimes = [...sentChunkTimesRef.current.filter((ts) => now - ts <= 1000), now];
    sentChunkTimesRef.current = nextTimes;

    setSentChunksPerSecond(nextTimes.length);
    setLastSentChunkRms(rms);
    setLastSentChunkAt(now);
    setLastSentChunkSizeBytes(chunkSizeBytes);
  }, []);

  const {
    connectionState,
    isInitialized,
    lastError,
    connect,
    disconnect,
    sendAudioChunk,
    sendClearHistory,
    getBufferedAmount,
  } = useRealtimeHealthSocket({
    wsUrl: resolvedWsUrl,
    initPayload,
    autoReconnect: true,
    onAssistantDelta: handleAssistantDelta,
    onAssistantTurnComplete: handleAssistantTurnComplete,
    onAssistantAudio: handleAssistantAudio,
    onErrorEvent: handleRealtimeError,
  });

  const clearQueuedAudioFrames = useCallback(() => {
    queuedAudioFramesRef.current = [];
    if (queueFlushTimeoutRef.current) {
      clearTimeout(queueFlushTimeoutRef.current);
      queueFlushTimeoutRef.current = null;
    }
  }, []);

  const clearPreSpeechFrames = useCallback(() => {
    preSpeechFramesRef.current = [];
  }, []);

  const pushPreSpeechFrame = useCallback((frame: Int16Array) => {
    const clone = frame.slice();
    preSpeechFramesRef.current.push(clone);
    if (preSpeechFramesRef.current.length > PRE_SPEECH_FRAME_COUNT) {
      preSpeechFramesRef.current.splice(0, preSpeechFramesRef.current.length - PRE_SPEECH_FRAME_COUNT);
    }
  }, []);

  const flushQueuedAudio = useCallback(() => {
    const queuedFrames = queuedAudioFramesRef.current;
    if (queuedFrames.length === 0) {
      return;
    }

    if (getBufferedAmount() > AUDIO_HIGH_BUFFERED_BYTES) {
      queuedAudioFramesRef.current = [queuedFrames[queuedFrames.length - 1]];
      return;
    }

    let totalSamples = 0;
    let weightedRmsNumerator = 0;
    let weightedRmsDenominator = 0;
    for (let i = 0; i < queuedFrames.length; i += 1) {
      const frame = queuedFrames[i];
      totalSamples += frame.length;
      const frameRms = estimateChunkRms(frame);
      weightedRmsNumerator += frameRms * frame.length;
      weightedRmsDenominator += frame.length;
    }

    const merged = new Int16Array(totalSamples);
    let offset = 0;
    for (let i = 0; i < queuedFrames.length; i += 1) {
      const frame = queuedFrames[i];
      merged.set(frame, offset);
      offset += frame.length;
    }

    queuedAudioFramesRef.current = [];
    if (queueFlushTimeoutRef.current) {
      clearTimeout(queueFlushTimeoutRef.current);
      queueFlushTimeoutRef.current = null;
    }

    const sent = sendAudioChunk(merged);
    if (!sent) {
      setUiError("Audio stream stopped because realtime session is not active.");
      return;
    }

    const mergedRms = weightedRmsDenominator > 0 ? weightedRmsNumerator / weightedRmsDenominator : 0;
    updateOutgoingAudioTelemetry(merged.byteLength, mergedRms);
    setAudioChunksSent((prev) => prev + 1);
  }, [getBufferedAmount, sendAudioChunk, updateOutgoingAudioTelemetry]);

  const enqueueAudioFrame = useCallback((frame: Int16Array) => {
    const queue = queuedAudioFramesRef.current;
    queue.push(frame);

    if (queue.length > AUDIO_MAX_QUEUE_FRAMES) {
      queue.splice(0, queue.length - AUDIO_MAX_QUEUE_FRAMES);
    }

    if (queue.length >= AUDIO_BATCH_TARGET_FRAMES) {
      flushQueuedAudio();
      return;
    }

    if (!queueFlushTimeoutRef.current) {
      queueFlushTimeoutRef.current = setTimeout(() => {
        queueFlushTimeoutRef.current = null;
        flushQueuedAudio();
      }, AUDIO_MAX_HOLD_MS);
    }
  }, [flushQueuedAudio]);

  const handleCapturedChunk = useCallback((chunk: Int16Array) => {
    // Half-duplex flow: let assistant finish speaking before sending user audio.
    if (assistantSpeakingRef.current) {
      userSpeakingRef.current = false;
      clearQueuedAudioFrames();
      pushPreSpeechFrame(chunk);
      return;
    }

    const now = Date.now();
    const rms = estimateChunkRms(chunk);
    const currentNoiseFloor = noiseFloorRmsRef.current;
    const openThreshold = Math.max(NOISE_GATE_MIN_OPEN_RMS, currentNoiseFloor * 2.8);
    const closeThreshold = Math.max(NOISE_GATE_MIN_CLOSE_RMS, currentNoiseFloor * 2.1);
    const hasSpeech = userSpeakingRef.current ? rms >= closeThreshold : rms >= openThreshold;

    if (!hasSpeech) {
      const nextNoiseFloor = (1 - NOISE_FLOOR_EMA_ALPHA) * currentNoiseFloor + (NOISE_FLOOR_EMA_ALPHA * rms);
      noiseFloorRmsRef.current = Math.min(NOISE_FLOOR_MAX_RMS, Math.max(0, nextNoiseFloor));
    }

    if (hasSpeech) {
      if (!userSpeakingRef.current) {
        userSpeakingRef.current = true;

        if (preSpeechFramesRef.current.length > 0) {
          preSpeechFramesRef.current.forEach((frame) => {
            enqueueAudioFrame(frame);
          });
          clearPreSpeechFrames();
        }
      }

      lastUserSpeechAtRef.current = now;

      enqueueAudioFrame(chunk);
      return;
    }

    if (userSpeakingRef.current && now - lastUserSpeechAtRef.current <= USER_SPEECH_HOLD_MS) {
      enqueueAudioFrame(chunk);
      return;
    }

    if (userSpeakingRef.current) {
      userSpeakingRef.current = false;
      // Flush any held frame so short utterances still reach the server.
      flushQueuedAudio();
    }

    pushPreSpeechFrame(chunk);
  }, [clearPreSpeechFrames, clearQueuedAudioFrames, enqueueAudioFrame, flushQueuedAudio, pushPreSpeechFrame]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    setLoadingData(true);
    setUiError(null);

    const loadContext = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/predictions/history?limit=5"),
        ]);

        if (!profileRes.ok || !historyRes.ok) {
          throw new Error("Unable to load health context");
        }

        const profileJson = (await profileRes.json()) as ProfileResponse;
        const historyJson = (await historyRes.json()) as PredictionHistoryResponse;

        setProfileHealthData(profileJson.healthData ?? {});
        const sortedHistory = [...(historyJson.history ?? [])].sort((a, b) => {
          const left = new Date(b.date ?? 0).getTime();
          const right = new Date(a.date ?? 0).getTime();
          return left - right;
        });
        setHistory(sortedHistory);

        const latestCondition = sortedHistory[0]?.condition;
        if (latestCondition === "heart-disease" || latestCondition === "diabetes") {
          setConditionType(latestCondition);
        }
      } catch (error) {
        console.error(error);
        setUiError("Unable to load user health details right now.");
      } finally {
        setLoadingData(false);
      }
    };

    loadContext();
  }, [status]);

  useEffect(() => {
    if (connectionState === "live") {
      setIsSessionStarted(true);
    }
  }, [connectionState]);

  useEffect(() => {
    if (!isSessionStarted) {
      return;
    }

    if (connectionState !== "error" && !lastError && !uiError) {
      return;
    }

    const stopOnError = async () => {
      await pcmCaptureRef.current?.stop();
      setIsMicStreaming(false);
      disconnect();
      setIsSessionStarted(false);
    };

    void stopOnError();
  }, [connectionState, disconnect, isSessionStarted, lastError, uiError]);

  useEffect(() => {
    const checkMicPermission = async () => {
      if (typeof navigator === "undefined" || !("permissions" in navigator)) {
        setMicPermission("unknown");
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        const state = result.state === "granted" || result.state === "denied" || result.state === "prompt"
          ? result.state
          : "unknown";
        setMicPermission(state);
        result.onchange = () => {
          const next = result.state === "granted" || result.state === "denied" || result.state === "prompt"
            ? result.state
            : "unknown";
          setMicPermission(next);
        };
      } catch {
        setMicPermission("unknown");
      }
    };

    void checkMicPermission();
  }, []);

  useEffect(() => {
    return () => {
      void pcmCaptureRef.current?.stop();
      void pcmPlayerRef.current?.close();
      pcmCaptureRef.current = null;
      pcmPlayerRef.current = null;
    };
  }, []);

  const toggleMic = async () => {
    if (isMicStreaming) {
      await pcmCaptureRef.current?.stop();
      clearQueuedAudioFrames();
      userSpeakingRef.current = false;
      noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
      setIsMicStreaming(false);
      return;
    }

    try {
      if (micPermission !== "granted") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermission("granted");
      }

      if (!pcmCaptureRef.current) {
        pcmCaptureRef.current = new PcmCapture(16000, 4096);
      }

      noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
      setAudioChunksSent(0);
      await pcmCaptureRef.current.start(async (chunk) => {
        handleCapturedChunk(chunk);
      });
      setIsMicStreaming(true);
      setUiError(null);
    } catch (audioErr) {
      console.error(audioErr);
      setUiError("Microphone access denied or unavailable.");
      setIsMicStreaming(false);
    }
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      setUiError(null);
    } catch {
      setMicPermission("denied");
      setUiError("Microphone permission denied. Please allow it in browser settings.");
    }
  };

  const startNewChat = async () => {
    if (isSessionStarted) {
      return;
    }

    if (isMicStreaming) {
      await pcmCaptureRef.current?.stop();
      setIsMicStreaming(false);
    }

    stopAssistantPlayback();
    userSpeakingRef.current = false;
    suppressAssistantAudioUntilRef.current = 0;
    pendingClearHistoryRef.current = false;
    clearPreSpeechFrames();

    commitAssistantDraft();
    setMessages([]);
    setChatId(createTimestampChatId());
    setUiError(null);
  };

  const handleStartSession = () => {
    if (!resolvedWsUrl) {
      setUiError("Missing WS_URL in environment.");
      return;
    }

    if (!initPayload) {
      setUiError("User context is not ready yet.");
      return;
    }

    setUiError(null);
    setAutoStartMicOnReady(true);
    setIsSessionStarted(true);
    connect();
  };

  const handleEndSession = async () => {
    await pcmCaptureRef.current?.stop();
    clearQueuedAudioFrames();
    setIsMicStreaming(false);
    stopAssistantPlayback();
    userSpeakingRef.current = false;
    noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
    suppressAssistantAudioUntilRef.current = 0;
    pendingClearHistoryRef.current = false;
    clearPreSpeechFrames();
    disconnect();
    setIsSessionStarted(false);
    setAutoStartMicOnReady(false);
  };

  const handleResetSession = async () => {
    await pcmCaptureRef.current?.stop();
    clearQueuedAudioFrames();
    setIsMicStreaming(false);
    stopAssistantPlayback();
    userSpeakingRef.current = false;
    noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
    suppressAssistantAudioUntilRef.current = 0;
    pendingClearHistoryRef.current = false;
    clearPreSpeechFrames();
    disconnect();
    setIsSessionStarted(false);
    setAutoStartMicOnReady(false);
    commitAssistantDraft();
    setMessages([]);
    setChatId(createTimestampChatId());
    setUiError(null);
  };

  useEffect(() => {
    if (!autoStartMicOnReady || !isInitialized || isMicStreaming) {
      return;
    }

    const startMic = async () => {
      try {
        if (micPermission !== "granted") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setMicPermission("granted");
        }

        if (!pcmCaptureRef.current) {
          pcmCaptureRef.current = new PcmCapture(16000, 4096);
        }

        noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
        setAudioChunksSent(0);
        await pcmCaptureRef.current.start(async (chunk) => {
          handleCapturedChunk(chunk);
        });
        setIsMicStreaming(true);
        setUiError(null);
      } finally {
        setAutoStartMicOnReady(false);
      }
    };

    void startMic();
  }, [autoStartMicOnReady, handleCapturedChunk, isInitialized, isMicStreaming, micPermission]);

  useEffect(() => {
    if (connectionState !== "live") {
      clearQueuedAudioFrames();
      clearPreSpeechFrames();
    }
  }, [clearPreSpeechFrames, clearQueuedAudioFrames, connectionState]);

  useEffect(() => {
    if (assistantSpeaking) {
      return;
    }

    if (!pendingClearHistoryRef.current) {
      return;
    }

    if (!serverSupportsClearHistoryRef.current) {
      pendingClearHistoryRef.current = false;
      return;
    }

    const cleared = sendClearHistory();
    if (cleared) {
      pendingClearHistoryRef.current = false;
    }
  }, [assistantSpeaking, sendClearHistory]);

  useEffect(() => {
    if (!assistantSpeaking) {
      return;
    }

    const interval = setInterval(() => {
      if (Date.now() - lastAssistantAudioAtRef.current > 800) {
        setAssistantSpeaking(false);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [assistantSpeaking]);

  useEffect(() => {
    const interval = setInterval(() => {
      visualizerPhaseRef.current += 0.35;

      const idleWave = 0.12 + ((Math.sin(visualizerPhaseRef.current) + 1) * 0.04);
      const speakingPulse = 0.52 + ((Math.sin(visualizerPhaseRef.current * 1.6) + 1) * 0.18);
      const listeningPulse = Math.min(
        0.85,
        Math.max(0.16, (lastSentChunkRms / 0.05) + ((Math.sin(visualizerPhaseRef.current * 1.2) + 1) * 0.06)),
      );

      let target = idleWave;
      if (assistantSpeaking) {
        target = speakingPulse;
      } else if (isMicStreaming) {
        target = listeningPulse;
      }

      setVisualizerLevel((prev) => (prev * 0.78) + (target * 0.22));
    }, 80);

    return () => clearInterval(interval);
  }, [assistantSpeaking, isMicStreaming, lastSentChunkRms]);

  const isSessionActive = connectionState === "live" || connectionState === "connecting" || connectionState === "reconnecting";
  const isAiSpeaking = assistantSpeaking && isSessionActive;
  const visualizerScale = 1 + (visualizerLevel * 0.35);
  const canStartSession = Boolean(resolvedWsUrl && initPayload);

  const waveBars = useMemo(() => {
    const bars = 32;
    return Array.from({ length: bars }, (_, index) => {
      const phase = visualizerPhaseRef.current + (index * 0.45);
      const wave = (Math.sin(phase) + 1) / 2;
      const intensity = 10 + Math.round(((visualizerLevel * 48) + (wave * 44)));
      return {
        id: `wave-${index}`,
        height: Math.min(84, Math.max(10, intensity)),
        opacity: 0.35 + (wave * 0.55),
      };
    });
  }, [visualizerLevel]);

  const liveStatusLabel = isAiSpeaking
    ? "AI is speaking"
    : isMicStreaming
      ? "Listening"
      : isSessionActive
        ? "Ready"
        : "Idle";

  const handlePrimaryMicButton = async () => {
    if (!isSessionActive) {
      handleStartSession();
      return;
    }

    await toggleMic();
  };

  const handleConditionChange = (nextCondition: ConditionType) => {
    if (nextCondition === conditionType) {
      return;
    }

    setConditionType(nextCondition);
  };

  const primaryButtonLabel = connectionState === "connecting"
    ? "Starting..."
    : isMicStreaming
      ? "Stop Mic"
      : "Start Mic";

  if (status === "loading") {
    return <p className="text-sm text-slate-600">Loading your session...</p>;
  }

  if (status !== "authenticated") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        Please sign in first to start a personalized realtime health conversation.
      </div>
    );
  }

  return (
    <section className="relative mx-auto flex min-h-[78vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950 px-3 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:px-4 sm:py-6 md:rounded-3xl md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_38%),radial-gradient(circle_at_80%_90%,rgba(129,140,248,0.20),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))]" />

      <header className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Voice AI Assistant</p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl md:text-3xl">Realtime Health Guide</h2>
          <p className="mt-2 text-sm text-slate-300">
            {loadingData
              ? "Preparing your health context..."
              : `Status: ${liveStatusLabel} · ${prettyConnectionLabel(connectionState)}`}
          </p>
        </div>

        <div className="flex max-w-full items-center gap-2 self-start truncate rounded-full border border-cyan-300/30 bg-slate-900/60 px-3 py-1 text-[11px] text-cyan-100 backdrop-blur sm:px-4 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
          Session {chatId}
        </div>
      </header>

      <div className="relative z-10 mt-5 flex flex-1 flex-col items-center justify-center px-2">
        <div className="relative flex h-[300px] w-[300px] items-center justify-center md:h-[360px] md:w-[360px]">
          <div
            className="absolute h-full w-full rounded-full bg-cyan-400/15 blur-3xl transition-transform duration-200"
            style={{ transform: `scale(${1.02 + (visualizerLevel * 0.45)})` }}
          />
          <div
            className="absolute h-[78%] w-[78%] rounded-full bg-indigo-400/20 blur-2xl transition-transform duration-200"
            style={{ transform: `scale(${1 + (visualizerLevel * 0.3)})` }}
          />

          <div className="relative flex h-full w-full items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[88%] w-[88%] rounded-full border border-cyan-300/35" />
            </div>

            <div
              className="relative h-[48%] w-[48%] rounded-full border border-cyan-200/70 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.7),rgba(34,211,238,0.3)_28%,rgba(56,189,248,0.15)_44%,rgba(15,23,42,0.9)_70%)] shadow-[0_0_50px_rgba(34,211,238,0.6),0_0_100px_rgba(56,189,248,0.32)] transition-transform duration-200"
              style={{ transform: `scale(${visualizerScale})` }}
            />
          </div>
        </div>

        <div className="mt-6 flex h-24 w-full max-w-2xl items-end justify-center gap-1.5 px-2">
          {waveBars.map((bar) => (
            <div
              key={bar.id}
              className="w-[7px] rounded-full bg-linear-to-t from-indigo-400 via-cyan-300 to-cyan-100 transition-all duration-150"
              style={{
                height: `${bar.height}px`,
                opacity: bar.opacity,
                boxShadow: "0 0 16px rgba(34,211,238,0.5)",
              }}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-cyan-100/90">
          {isAiSpeaking
            ? "Assistant is speaking"
            : isMicStreaming
              ? "Listening to your voice"
              : "Press Start to begin voice conversation"}
        </p>

        {(lastError || uiError) ? (
          <div className="mt-4 w-full max-w-xl rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100">
            {uiError || lastError}
          </div>
        ) : null}

        {assistantDraft ? (
          <div className="mt-4 w-full max-w-xl wrap-anywhere rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
            {assistantDraft}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-6 flex flex-col items-center gap-3">
        <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
          <label className="w-full sm:w-auto">
            <span className="sr-only">Prediction condition</span>
            <select
              value={conditionType}
              onChange={(event) => handleConditionChange(event.target.value as ConditionType)}
              className="w-full rounded-full border border-cyan-300/35 bg-slate-900/80 px-4 py-3 text-sm font-medium text-cyan-100 outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 sm:min-w-[220px]"
              disabled={isSessionActive}
              aria-label="Select prediction condition"
            >
              <option value="diabetes">Diabetes</option>
              <option value="heart-disease">Heart disease</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              void handlePrimaryMicButton();
            }}
            className={`w-full sm:w-auto sm:min-w-[190px] rounded-full px-6 py-3 text-sm font-semibold text-white transition-all ${
              isAiSpeaking
                ? "bg-cyan-500 shadow-[0_0_22px_rgba(34,211,238,0.85)]"
                : isMicStreaming
                  ? "bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.7)]"
                  : "bg-slate-700 hover:bg-slate-600"
            } disabled:cursor-not-allowed disabled:bg-slate-700/70`}
            disabled={!canStartSession || connectionState === "connecting"}
          >
            {primaryButtonLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              void handleResetSession();
            }}
            className="w-full sm:w-auto rounded-full border border-cyan-300/40 bg-slate-900/70 px-6 py-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={connectionState === "connecting"}
          >
            Reset
          </button>
        </div>

        <p className="px-2 text-center text-xs text-slate-400">
          Condition: {conditionType === "heart-disease" ? "Heart disease" : "Diabetes"} · Mic: {micPermission} · Chunks/sec: {sentChunksPerSecond}
        </p>
        {isSessionActive ? (
          <p className="px-2 text-center text-[11px] text-slate-500">
            End or reset the current session to change condition.
          </p>
        ) : null}
      </div>
    </section>
  );
}
