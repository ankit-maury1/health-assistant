// "use client";

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useSession } from "next-auth/react";
// import { PcmCapture } from "@/lib/audio/pcmCapture";
// import { PcmPlayer } from "@/lib/audio/pcmPlayer";
// import { RealtimeInitPayload, useRealtimeHealthSocket } from "@/hooks/useRealtimeHealthSocket";

// type ConditionType = "diabetes" | "heart-disease";

// interface HistoryEntry {
//   _id?: string;
//   date?: string;
//   condition?: string;
//   inputMetrics?: Record<string, unknown>;
//   riskScore?: number;
//   riskLevel?: string;
//   prediction?: string;
//   probability?: number;
//   result?: {
//     prediction?: string;
//     probability?: number;
//     riskScore?: number;
//     riskLevel?: string;
//     advice?: {
//       risk_level?: string;
//       score?: number;
//       suggestions?: unknown;
//       [key: string]: unknown;
//     };
//     [key: string]: unknown;
//   };
// }

// interface PredictionHistoryResponse {
//   history?: HistoryEntry[];
// }

// interface ProfileResponse {
//   healthData?: Record<string, unknown> | null;
// }

// interface ChatMessage {
//   id: string;
//   role: "user" | "assistant";
//   text: string;
// }

// interface SanitizedHistoryItem extends Record<string, unknown> {
//   date: string | null;
//   inputMetrics: Record<string, unknown>;
//   predictionSummary: {
//     prediction: string | null;
//     probability: number | null;
//     riskScore: number | null;
//     riskLevel: string | null;
//   };
// }

// const NOISE_FLOOR_INITIAL_RMS = 0.006;
// const NOISE_FLOOR_EMA_ALPHA = 0.08;
// const NOISE_FLOOR_MAX_RMS = 0.03;
// const NOISE_GATE_MIN_OPEN_RMS = 0.012;
// const NOISE_GATE_MIN_CLOSE_RMS = 0.009;
// const USER_SPEECH_HOLD_MS = 250;
// const PRE_SPEECH_FRAME_COUNT = 2;
// const AUDIO_BATCH_TARGET_FRAMES = 4; // larger batch to reduce websocket packet overhead
// const AUDIO_MAX_QUEUE_FRAMES = 8;
// const AUDIO_MAX_HOLD_MS = 40; // increase hold to accumulate more samples before send
// const AUDIO_HIGH_BUFFERED_BYTES = 64 * 1024; // use lower threshold to avoid excess buffering delay

// function toSafeNumber(value: unknown): number | null {
//   if (typeof value === "number" && Number.isFinite(value)) {
//     return value;
//   }
//   if (typeof value === "string") {
//     const parsed = Number(value);
//     return Number.isFinite(parsed) ? parsed : null;
//   }
//   return null;
// }

// function toSafeString(value: unknown): string | null {
//   return typeof value === "string" && value.trim() ? value.trim() : null;
// }

// const DIABETES_KEYS = new Set([
//   "gender",
//   "age",
//   "height",
//   "weight",
//   "hypertension",
//   "heartDisease",
//   "smokingHistory",
//   "bmi",
//   "hbA1cLevel",
//   "bloodGlucoseLevel",
// ]);

// const HEART_KEYS = new Set([
//   "age",
//   "sex",
//   "chest_pain_type",
//   "resting_bp",
//   "cholesterol",
//   "fasting_blood_sugar",
//   "resting_ecg",
//   "max_heart_rate",
//   "exercise_angina",
//   "oldpeak",
//   "st_slope",
// ]);

// function normalizeRiskLevel(value: string | null): string | null {
//   if (!value) {
//     return null;
//   }

//   const normalized = value.toLowerCase();
//   if (normalized.includes("high")) return "high";
//   if (normalized.includes("moderate")) return "moderate";
//   if (normalized.includes("low")) return "low";
//   return normalized;
// }

// function compactObject(input: Record<string, unknown>): Record<string, unknown> {
//   const output: Record<string, unknown> = {};
//   Object.entries(input).forEach(([key, value]) => {
//     if (value === null || value === undefined || value === "") {
//       return;
//     }
//     output[key] = value;
//   });
//   return output;
// }

// function estimateChunkRms(pcm16: Int16Array): number {
//   if (pcm16.length === 0) {
//     return 0;
//   }

//   let sumSquares = 0;
//   for (let i = 0; i < pcm16.length; i += 1) {
//     const normalized = pcm16[i] / 32768;
//     sumSquares += normalized * normalized;
//   }
//   return Math.sqrt(sumSquares / pcm16.length);
// }

// function pickConditionFields(
//   data: Record<string, unknown>,
//   condition: ConditionType,
// ): Record<string, unknown> {
//   const allowList = condition === "diabetes" ? DIABETES_KEYS : HEART_KEYS;
//   const output: Record<string, unknown> = {};

//   Object.entries(data).forEach(([key, value]) => {
//     if (!allowList.has(key) || value === null || value === undefined || value === "") {
//       return;
//     }
//     output[key] = value;
//   });

//   return output;
// }

// function sanitizeHistoryEntry(entry: HistoryEntry): SanitizedHistoryItem {
//   const prediction =
//     toSafeString(entry.prediction)
//     ?? toSafeString(entry.result?.prediction)
//     ?? null;

//   const probability =
//     toSafeNumber(entry.probability)
//     ?? toSafeNumber(entry.result?.probability)
//     ?? null;

//   const riskScore =
//     toSafeNumber(entry.riskScore)
//     ?? toSafeNumber(entry.result?.riskScore)
//     ?? toSafeNumber(entry.result?.advice?.score)
//     ?? null;

//   const riskLevel =
//     toSafeString(entry.riskLevel)
//     ?? toSafeString(entry.result?.riskLevel)
//     ?? toSafeString(entry.result?.advice?.risk_level)
//     ?? null;

//   // Keep only compact fields to avoid sending long LLM guide/suggestions.
//   return {
//     date: toSafeString(entry.date),
//     inputMetrics: compactObject(entry.inputMetrics ?? {}),
//     predictionSummary: {
//       prediction,
//       probability,
//       riskScore,
//       riskLevel: normalizeRiskLevel(riskLevel),
//     },
//   };
// }

// interface SessionUser {
//   id?: string;
//   name?: string | null;
//   email?: string | null;
// }

// interface RealtimeHealthChatProps {
//   wsUrl?: string;
// }

// function createTimestampChatId(): string {
//   return Date.now().toString();
// }

// function prettyConnectionLabel(value: string): string {
//   switch (value) {
//     case "live":
//       return "Live";
//     case "connecting":
//       return "Connecting";
//     case "reconnecting":
//       return "Reconnecting";
//     case "closed":
//       return "Disconnected";
//     case "error":
//       return "Error";
//     default:
//       return "Idle";
//   }
// }

// export default function RealtimeHealthChat({ wsUrl }: RealtimeHealthChatProps) {
//   const { data: session, status } = useSession();
//   const typedUser = session?.user as SessionUser | undefined;
//   const messageIdCounterRef = useRef(0);

//   const [conditionType, setConditionType] = useState<ConditionType>("diabetes");
//   const [chatId, setChatId] = useState<string>(createTimestampChatId);
//   const [extraContext, setExtraContext] = useState("");
//   const [loadingData, setLoadingData] = useState(false);
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [assistantDraft, setAssistantDraft] = useState("");
//   const [profileHealthData, setProfileHealthData] = useState<Record<string, unknown>>({});
//   const [history, setHistory] = useState<HistoryEntry[]>([]);
//   const [isMicStreaming, setIsMicStreaming] = useState(false);
//   const [uiError, setUiError] = useState<string | null>(null);
//   const [isSessionStarted, setIsSessionStarted] = useState(false);
//   const [micPermission, setMicPermission] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
//   const [autoStartMicOnReady, setAutoStartMicOnReady] = useState(false);
//   const [audioChunksSent, setAudioChunksSent] = useState(0);
//   const [assistantSpeaking, setAssistantSpeaking] = useState(false);
//   const [lastSentChunkSizeBytes, setLastSentChunkSizeBytes] = useState(0);
//   const [lastSentChunkAt, setLastSentChunkAt] = useState<number | null>(null);
//   const [lastSentChunkRms, setLastSentChunkRms] = useState(0);
//   const [sentChunksPerSecond, setSentChunksPerSecond] = useState(0);
//   const [visualizerLevel, setVisualizerLevel] = useState(0.12);
//   const visualizerPhaseRef = useRef(0);

//   const pcmCaptureRef = useRef<PcmCapture | null>(null);
//   const pcmPlayerRef = useRef<PcmPlayer | null>(null);
//   const lastAssistantAudioAtRef = useRef(0);
//   const lastUserSpeechAtRef = useRef(0);
//   const suppressAssistantAudioUntilRef = useRef(0);
//   const userSpeakingRef = useRef(false);
//   const assistantSpeakingRef = useRef(false);
//   const sentChunkTimesRef = useRef<number[]>([]);
//   const queuedAudioFramesRef = useRef<Int16Array[]>([]);
//   const preSpeechFramesRef = useRef<Int16Array[]>([]);
//   const noiseFloorRmsRef = useRef(NOISE_FLOOR_INITIAL_RMS);
//   const queueFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const pendingClearHistoryRef = useRef(false);
//   const serverSupportsClearHistoryRef = useRef(true);

//   const createMessageId = useCallback((role: ChatMessage["role"]) => {
//     messageIdCounterRef.current += 1;
//     return `${role}-${Date.now()}-${messageIdCounterRef.current}`;
//   }, []);

//   const resolvedWsUrl = wsUrl?.trim() || "";
//   const userId = typedUser?.id || typedUser?.email || "";
//   const displayName = typedUser?.name?.trim() || "there";

//   const conditionHistory = useMemo(() => {
//     const compacted = history
//       .filter((entry) => entry.condition === conditionType)
//       .slice(0, 5)
//       .map((entry) => sanitizeHistoryEntry(entry))
//       .map((entry) => ({
//         ...entry,
//         inputMetrics: pickConditionFields(entry.inputMetrics, conditionType),
//       }));

//     // Drop duplicate entries that often come from repeated write events in history.
//     const seen = new Set<string>();
//     return compacted.filter((entry) => {
//       const key = JSON.stringify(entry.inputMetrics) + JSON.stringify(entry.predictionSummary);
//       if (seen.has(key)) {
//         return false;
//       }
//       seen.add(key);
//       return true;
//     }).slice(0, 5);
//   }, [conditionType, history]);

//   const scopedHealthData = useMemo(() => {
//     return pickConditionFields(profileHealthData, conditionType);
//   }, [conditionType, profileHealthData]);

//   const initPayload: RealtimeInitPayload | null = useMemo(() => {
//     if (!userId || status !== "authenticated") {
//       return null;
//     }

//     return {
//       userId,
//       chatId,
//       name: displayName,
//       conditionType,
//       healthData: scopedHealthData,
//       history: conditionHistory,
//       extraContext: extraContext.trim() || undefined,
//     };
//   }, [chatId, conditionHistory, conditionType, displayName, extraContext, scopedHealthData, status, userId]);

//   const commitAssistantDraft = useCallback(() => {
//     setAssistantDraft((currentDraft) => {
//       const finalText = currentDraft.trim();
//       if (finalText) {
//         setMessages((prev) => [
//           ...prev,
//           {
//             id: createMessageId("assistant"),
//             role: "assistant",
//             text: finalText,
//           },
//         ]);
//       }
//       return "";
//     });
//   }, [createMessageId]);

//   const handleAssistantDelta = useCallback((delta: string) => {
//     setAssistantDraft((prev) => prev + delta);
//   }, []);

//   const handleAssistantTurnComplete = useCallback(() => {
//     pendingClearHistoryRef.current = true;
//     commitAssistantDraft();
//   }, [commitAssistantDraft]);

//   useEffect(() => {
//     assistantSpeakingRef.current = assistantSpeaking;
//   }, [assistantSpeaking]);

//   const stopAssistantPlayback = useCallback((suppressMs = 0) => {
//     pcmPlayerRef.current?.interrupt();
//     setAssistantSpeaking(false);
//     if (suppressMs > 0) {
//       suppressAssistantAudioUntilRef.current = Date.now() + suppressMs;
//     }
//   }, []);

//   const handleAssistantAudio = useCallback(async (audioBase64: string) => {
//     try {
//       if (userSpeakingRef.current || Date.now() < suppressAssistantAudioUntilRef.current) {
//         return;
//       }

//       if (!pcmPlayerRef.current) {
//         pcmPlayerRef.current = new PcmPlayer(24000);
//       }
//       lastAssistantAudioAtRef.current = Date.now();
//       setAssistantSpeaking(true);
//       await pcmPlayerRef.current.playBase64Chunk(audioBase64);
//     } catch (audioError) {
//       console.error("Audio playback error", audioError);
//     }
//   }, []);

//   const handleRealtimeError = useCallback((message: string) => {
//     // Older backend versions don't support clear_history; ignore this specific capability error.
//     if (
//       pendingClearHistoryRef.current
//       && message.includes("Unknown event type")
//       && message.includes("user_audio")
//       && message.includes("user_interrupt")
//       && message.includes("ping")
//     ) {
//       pendingClearHistoryRef.current = false;
//       serverSupportsClearHistoryRef.current = false;
//       return;
//     }

//     // Newer backend(s) may return an explicit clear_history unsupported string.
//     if (message.toLowerCase().includes("clear_history")) {
//       pendingClearHistoryRef.current = false;
//       serverSupportsClearHistoryRef.current = false;
//       return;
//     }

//     setUiError(message);
//   }, []);

//   const updateOutgoingAudioTelemetry = useCallback((chunkSizeBytes: number, rms: number) => {
//     const now = Date.now();
//     const nextTimes = [...sentChunkTimesRef.current.filter((ts) => now - ts <= 1000), now];
//     sentChunkTimesRef.current = nextTimes;

//     setSentChunksPerSecond(nextTimes.length);
//     setLastSentChunkRms(rms);
//     setLastSentChunkAt(now);
//     setLastSentChunkSizeBytes(chunkSizeBytes);
//   }, []);

//   const {
//     connectionState,
//     isInitialized,
//     lastError,
//     connect,
//     disconnect,
//     sendAudioChunk,
//     sendClearHistory,
//     getBufferedAmount,
//   } = useRealtimeHealthSocket({
//     wsUrl: resolvedWsUrl,
//     initPayload,
//     autoReconnect: true,
//     onAssistantDelta: handleAssistantDelta,
//     onAssistantTurnComplete: handleAssistantTurnComplete,
//     onAssistantAudio: handleAssistantAudio,
//     onErrorEvent: handleRealtimeError,
//   });

//   const clearQueuedAudioFrames = useCallback(() => {
//     queuedAudioFramesRef.current = [];
//     if (queueFlushTimeoutRef.current) {
//       clearTimeout(queueFlushTimeoutRef.current);
//       queueFlushTimeoutRef.current = null;
//     }
//   }, []);

//   const clearPreSpeechFrames = useCallback(() => {
//     preSpeechFramesRef.current = [];
//   }, []);

//   const pushPreSpeechFrame = useCallback((frame: Int16Array) => {
//     const clone = frame.slice();
//     preSpeechFramesRef.current.push(clone);
//     if (preSpeechFramesRef.current.length > PRE_SPEECH_FRAME_COUNT) {
//       preSpeechFramesRef.current.splice(0, preSpeechFramesRef.current.length - PRE_SPEECH_FRAME_COUNT);
//     }
//   }, []);

//   const flushQueuedAudio = useCallback(() => {
//     const queuedFrames = queuedAudioFramesRef.current;
//     if (queuedFrames.length === 0) {
//       return;
//     }

//     if (getBufferedAmount() > AUDIO_HIGH_BUFFERED_BYTES) {
//       queuedAudioFramesRef.current = [queuedFrames[queuedFrames.length - 1]];
//       return;
//     }

//     let totalSamples = 0;
//     let weightedRmsNumerator = 0;
//     let weightedRmsDenominator = 0;
//     for (let i = 0; i < queuedFrames.length; i += 1) {
//       const frame = queuedFrames[i];
//       totalSamples += frame.length;
//       const frameRms = estimateChunkRms(frame);
//       weightedRmsNumerator += frameRms * frame.length;
//       weightedRmsDenominator += frame.length;
//     }

//     const merged = new Int16Array(totalSamples);
//     let offset = 0;
//     for (let i = 0; i < queuedFrames.length; i += 1) {
//       const frame = queuedFrames[i];
//       merged.set(frame, offset);
//       offset += frame.length;
//     }

//     queuedAudioFramesRef.current = [];
//     if (queueFlushTimeoutRef.current) {
//       clearTimeout(queueFlushTimeoutRef.current);
//       queueFlushTimeoutRef.current = null;
//     }

//     const sent = sendAudioChunk(merged);
//     if (!sent) {
//       setUiError("Audio stream stopped because realtime session is not active.");
//       return;
//     }

//     const mergedRms = weightedRmsDenominator > 0 ? weightedRmsNumerator / weightedRmsDenominator : 0;
//     updateOutgoingAudioTelemetry(merged.byteLength, mergedRms);
//     setAudioChunksSent((prev) => prev + 1);
//   }, [getBufferedAmount, sendAudioChunk, updateOutgoingAudioTelemetry]);

//   const enqueueAudioFrame = useCallback((frame: Int16Array) => {
//     const queue = queuedAudioFramesRef.current;
//     queue.push(frame);

//     if (queue.length > AUDIO_MAX_QUEUE_FRAMES) {
//       queue.splice(0, queue.length - AUDIO_MAX_QUEUE_FRAMES);
//     }

//     if (queue.length >= AUDIO_BATCH_TARGET_FRAMES) {
//       flushQueuedAudio();
//       return;
//     }

//     if (!queueFlushTimeoutRef.current) {
//       queueFlushTimeoutRef.current = setTimeout(() => {
//         queueFlushTimeoutRef.current = null;
//         flushQueuedAudio();
//       }, AUDIO_MAX_HOLD_MS);
//     }
//   }, [flushQueuedAudio]);

//   const handleCapturedChunk = useCallback((chunk: Int16Array) => {
//     // Half-duplex flow: let assistant finish speaking before sending user audio.
//     if (assistantSpeakingRef.current) {
//       userSpeakingRef.current = false;
//       clearQueuedAudioFrames();
//       pushPreSpeechFrame(chunk);
//       return;
//     }

//     const now = Date.now();
//     const rms = estimateChunkRms(chunk);
//     const currentNoiseFloor = noiseFloorRmsRef.current;
//     const openThreshold = Math.max(NOISE_GATE_MIN_OPEN_RMS, currentNoiseFloor * 2.8);
//     const closeThreshold = Math.max(NOISE_GATE_MIN_CLOSE_RMS, currentNoiseFloor * 2.1);
//     const hasSpeech = userSpeakingRef.current ? rms >= closeThreshold : rms >= openThreshold;

//     if (!hasSpeech) {
//       const nextNoiseFloor = (1 - NOISE_FLOOR_EMA_ALPHA) * currentNoiseFloor + (NOISE_FLOOR_EMA_ALPHA * rms);
//       noiseFloorRmsRef.current = Math.min(NOISE_FLOOR_MAX_RMS, Math.max(0, nextNoiseFloor));
//     }

//     if (hasSpeech) {
//       if (!userSpeakingRef.current) {
//         userSpeakingRef.current = true;

//         if (preSpeechFramesRef.current.length > 0) {
//           preSpeechFramesRef.current.forEach((frame) => {
//             enqueueAudioFrame(frame);
//           });
//           clearPreSpeechFrames();
//         }
//       }

//       lastUserSpeechAtRef.current = now;

//       enqueueAudioFrame(chunk);
//       return;
//     }

//     if (userSpeakingRef.current && now - lastUserSpeechAtRef.current <= USER_SPEECH_HOLD_MS) {
//       enqueueAudioFrame(chunk);
//       return;
//     }

//     if (userSpeakingRef.current) {
//       userSpeakingRef.current = false;
//       // Flush any held frame so short utterances still reach the server.
//       flushQueuedAudio();
//     }

//     pushPreSpeechFrame(chunk);
//   }, [clearPreSpeechFrames, clearQueuedAudioFrames, enqueueAudioFrame, flushQueuedAudio, pushPreSpeechFrame]);

//   useEffect(() => {
//     if (status !== "authenticated") {
//       return;
//     }

//     setLoadingData(true);
//     setUiError(null);

//     const loadContext = async () => {
//       try {
//         const [profileRes, historyRes] = await Promise.all([
//           fetch("/api/user/profile"),
//           fetch("/api/predictions/history?limit=5"),
//         ]);

//         if (!profileRes.ok || !historyRes.ok) {
//           throw new Error("Unable to load health context");
//         }

//         const profileJson = (await profileRes.json()) as ProfileResponse;
//         const historyJson = (await historyRes.json()) as PredictionHistoryResponse;

//         setProfileHealthData(profileJson.healthData ?? {});
//         const sortedHistory = [...(historyJson.history ?? [])].sort((a, b) => {
//           const left = new Date(b.date ?? 0).getTime();
//           const right = new Date(a.date ?? 0).getTime();
//           return left - right;
//         });
//         setHistory(sortedHistory);

//         const latestCondition = sortedHistory[0]?.condition;
//         if (latestCondition === "heart-disease" || latestCondition === "diabetes") {
//           setConditionType(latestCondition);
//         }
//       } catch (error) {
//         console.error(error);
//         setUiError("Unable to load user health details right now.");
//       } finally {
//         setLoadingData(false);
//       }
//     };

//     loadContext();
//   }, [status]);

//   useEffect(() => {
//     if (connectionState === "live") {
//       setIsSessionStarted(true);
//     }
//   }, [connectionState]);

//   useEffect(() => {
//     if (!isSessionStarted) {
//       return;
//     }

//     if (connectionState !== "error" && !lastError && !uiError) {
//       return;
//     }

//     const stopOnError = async () => {
//       await pcmCaptureRef.current?.stop();
//       setIsMicStreaming(false);
//       disconnect();
//       setIsSessionStarted(false);
//     };

//     void stopOnError();
//   }, [connectionState, disconnect, isSessionStarted, lastError, uiError]);

//   useEffect(() => {
//     const checkMicPermission = async () => {
//       if (typeof navigator === "undefined" || !("permissions" in navigator)) {
//         setMicPermission("unknown");
//         return;
//       }

//       try {
//         const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
//         const state = result.state === "granted" || result.state === "denied" || result.state === "prompt"
//           ? result.state
//           : "unknown";
//         setMicPermission(state);
//         result.onchange = () => {
//           const next = result.state === "granted" || result.state === "denied" || result.state === "prompt"
//             ? result.state
//             : "unknown";
//           setMicPermission(next);
//         };
//       } catch {
//         setMicPermission("unknown");
//       }
//     };

//     void checkMicPermission();
//   }, []);

//   useEffect(() => {
//     return () => {
//       void pcmCaptureRef.current?.stop();
//       void pcmPlayerRef.current?.close();
//       pcmCaptureRef.current = null;
//       pcmPlayerRef.current = null;
//     };
//   }, []);

//   const toggleMic = async () => {
//     if (isMicStreaming) {
//       await pcmCaptureRef.current?.stop();
//       clearQueuedAudioFrames();
//       userSpeakingRef.current = false;
//       noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
//       setIsMicStreaming(false);
//       return;
//     }

//     try {
//       if (micPermission !== "granted") {
//         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//         stream.getTracks().forEach((track) => track.stop());
//         setMicPermission("granted");
//       }

//       if (!pcmCaptureRef.current) {
//         pcmCaptureRef.current = new PcmCapture(44100, 4096);
//       }

//       noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
//       setAudioChunksSent(0);
//       await pcmCaptureRef.current.start(async (chunk) => {
//         handleCapturedChunk(chunk);
//       });
//       setIsMicStreaming(true);
//       setUiError(null);
//     } catch (audioErr) {
//       console.error(audioErr);
//       setUiError("Microphone access denied or unavailable.");
//       setIsMicStreaming(false);
//     }
//   };

//   const requestMicPermission = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       stream.getTracks().forEach((track) => track.stop());
//       setMicPermission("granted");
//       setUiError(null);
//     } catch {
//       setMicPermission("denied");
//       setUiError("Microphone permission denied. Please allow it in browser settings.");
//     }
//   };

//   const startNewChat = async () => {
//     if (isSessionStarted) {
//       return;
//     }

//     if (isMicStreaming) {
//       await pcmCaptureRef.current?.stop();
//       setIsMicStreaming(false);
//     }

//     stopAssistantPlayback();
//     userSpeakingRef.current = false;
//     suppressAssistantAudioUntilRef.current = 0;
//     pendingClearHistoryRef.current = false;
//     clearPreSpeechFrames();

//     commitAssistantDraft();
//     setMessages([]);
//     setChatId(createTimestampChatId());
//     setUiError(null);
//   };

//   const handleStartSession = () => {
//     if (!resolvedWsUrl) {
//       setUiError("Missing WS_URL in environment.");
//       return;
//     }

//     if (!initPayload) {
//       setUiError("User context is not ready yet.");
//       return;
//     }

//     setUiError(null);
//     setAutoStartMicOnReady(true);
//     setIsSessionStarted(true);
//     connect();
//   };

//   const handleEndSession = async () => {
//     await pcmCaptureRef.current?.stop();
//     clearQueuedAudioFrames();
//     setIsMicStreaming(false);
//     stopAssistantPlayback();
//     userSpeakingRef.current = false;
//     noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
//     suppressAssistantAudioUntilRef.current = 0;
//     pendingClearHistoryRef.current = false;
//     clearPreSpeechFrames();
//     disconnect();
//     setIsSessionStarted(false);
//     setAutoStartMicOnReady(false);
//   };

//   const handleResetSession = async () => {
//     await pcmCaptureRef.current?.stop();
//     clearQueuedAudioFrames();
//     setIsMicStreaming(false);
//     stopAssistantPlayback();
//     userSpeakingRef.current = false;
//     noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
//     suppressAssistantAudioUntilRef.current = 0;
//     pendingClearHistoryRef.current = false;
//     clearPreSpeechFrames();
//     disconnect();
//     setIsSessionStarted(false);
//     setAutoStartMicOnReady(false);
//     commitAssistantDraft();
//     setMessages([]);
//     setChatId(createTimestampChatId());
//     setUiError(null);
//   };

//   useEffect(() => {
//     if (!autoStartMicOnReady || !isInitialized || isMicStreaming) {
//       return;
//     }

//     const startMic = async () => {
//       try {
//         if (micPermission !== "granted") {
//           const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//           stream.getTracks().forEach((track) => track.stop());
//           setMicPermission("granted");
//         }

//         if (!pcmCaptureRef.current) {
//           pcmCaptureRef.current = new PcmCapture(44100, 4096);
//         }

//         noiseFloorRmsRef.current = NOISE_FLOOR_INITIAL_RMS;
//         setAudioChunksSent(0);
//         await pcmCaptureRef.current.start(async (chunk) => {
//           handleCapturedChunk(chunk);
//         });
//         setIsMicStreaming(true);
//         setUiError(null);
//       } finally {
//         setAutoStartMicOnReady(false);
//       }
//     };

//     void startMic();
//   }, [autoStartMicOnReady, handleCapturedChunk, isInitialized, isMicStreaming, micPermission]);

//   useEffect(() => {
//     if (connectionState !== "live") {
//       clearQueuedAudioFrames();
//       clearPreSpeechFrames();
//     }
//   }, [clearPreSpeechFrames, clearQueuedAudioFrames, connectionState]);

//   useEffect(() => {
//     if (assistantSpeaking) {
//       return;
//     }

//     if (!pendingClearHistoryRef.current) {
//       return;
//     }

//     if (!serverSupportsClearHistoryRef.current) {
//       pendingClearHistoryRef.current = false;
//       return;
//     }

//     const cleared = sendClearHistory();
//     if (cleared) {
//       pendingClearHistoryRef.current = false;
//     }
//   }, [assistantSpeaking, sendClearHistory]);

//   useEffect(() => {
//     if (!assistantSpeaking) {
//       return;
//     }

//     const interval = setInterval(() => {
//       if (Date.now() - lastAssistantAudioAtRef.current > 800) {
//         setAssistantSpeaking(false);
//       }
//     }, 250);

//     return () => clearInterval(interval);
//   }, [assistantSpeaking]);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       visualizerPhaseRef.current += 0.35;

//       const idleWave = 0.12 + ((Math.sin(visualizerPhaseRef.current) + 1) * 0.04);
//       const speakingPulse = 0.52 + ((Math.sin(visualizerPhaseRef.current * 1.6) + 1) * 0.18);
//       const listeningPulse = Math.min(
//         0.85,
//         Math.max(0.16, (lastSentChunkRms / 0.05) + ((Math.sin(visualizerPhaseRef.current * 1.2) + 1) * 0.06)),
//       );

//       let target = idleWave;
//       if (assistantSpeaking) {
//         target = speakingPulse;
//       } else if (isMicStreaming) {
//         target = listeningPulse;
//       }

//       setVisualizerLevel((prev) => (prev * 0.78) + (target * 0.22));
//     }, 80);

//     return () => clearInterval(interval);
//   }, [assistantSpeaking, isMicStreaming, lastSentChunkRms]);

//   const isSessionActive = connectionState === "live" || connectionState === "connecting" || connectionState === "reconnecting";
//   const isAiSpeaking = assistantSpeaking && isSessionActive;
//   const visualizerScale = 1 + (visualizerLevel * 0.35);
//   const canStartSession = Boolean(resolvedWsUrl && initPayload);

//   const waveBars = useMemo(() => {
//     const bars = 32;
//     return Array.from({ length: bars }, (_, index) => {
//       const phase = visualizerPhaseRef.current + (index * 0.45);
//       const wave = (Math.sin(phase) + 1) / 2;
//       const intensity = 10 + Math.round(((visualizerLevel * 48) + (wave * 44)));
//       return {
//         id: `wave-${index}`,
//         height: Math.min(84, Math.max(10, intensity)),
//         opacity: 0.35 + (wave * 0.55),
//       };
//     });
//   }, [visualizerLevel]);

//   const liveStatusLabel = isAiSpeaking
//     ? "AI is speaking"
//     : isMicStreaming
//       ? "Listening"
//       : isSessionActive
//         ? "Ready"
//         : "Idle";

//   const handlePrimaryMicButton = async () => {
//     if (!isSessionActive) {
//       handleStartSession();
//       return;
//     }

//     await toggleMic();
//   };

//   const handleConditionChange = (nextCondition: ConditionType) => {
//     if (nextCondition === conditionType) {
//       return;
//     }

//     setConditionType(nextCondition);
//   };

//   const primaryButtonLabel = connectionState === "connecting"
//     ? "Starting..."
//     : isMicStreaming
//       ? "Stop Mic"
//       : "Start Mic";

//   if (status === "loading") {
//     return <p className="text-sm text-slate-600">Loading your session...</p>;
//   }

//   if (status !== "authenticated") {
//     return (
//       <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
//         Please sign in first to start a personalized realtime health conversation.
//       </div>
//     );
//   }

//   return (
//     <section className="relative mx-auto flex min-h-[78vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950 px-3 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:px-4 sm:py-6 md:rounded-3xl md:px-8 md:py-8">
//       <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_38%),radial-gradient(circle_at_80%_90%,rgba(129,140,248,0.20),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))]" />

//       <header className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
//         <div>
//           <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Voice AI Assistant</p>
//           <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl md:text-3xl">Realtime Health Guide</h2>
//           <p className="mt-2 text-sm text-slate-300">
//             {loadingData
//               ? "Preparing your health context..."
//               : `Status: ${liveStatusLabel} · ${prettyConnectionLabel(connectionState)}`}
//           </p>
//         </div>

//         <div className="flex max-w-full items-center gap-2 self-start truncate rounded-full border border-cyan-300/30 bg-slate-900/60 px-3 py-1 text-[11px] text-cyan-100 backdrop-blur sm:px-4 sm:text-xs">
//           <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
//           Session {chatId}
//         </div>
//       </header>

//       <div className="relative z-10 mt-5 flex flex-1 flex-col items-center justify-center px-2">
//         <div className="relative flex h-[300px] w-[300px] items-center justify-center md:h-[360px] md:w-[360px]">
//           <div
//             className="absolute h-full w-full rounded-full bg-cyan-400/15 blur-3xl transition-transform duration-200"
//             style={{ transform: `scale(${1.02 + (visualizerLevel * 0.45)})` }}
//           />
//           <div
//             className="absolute h-[78%] w-[78%] rounded-full bg-indigo-400/20 blur-2xl transition-transform duration-200"
//             style={{ transform: `scale(${1 + (visualizerLevel * 0.3)})` }}
//           />

//           <div className="relative flex h-full w-full items-center justify-center">
//             <div className="absolute inset-0 flex items-center justify-center">
//               <div className="h-[88%] w-[88%] rounded-full border border-cyan-300/35" />
//             </div>

//             <div
//               className="relative h-[48%] w-[48%] rounded-full border border-cyan-200/70 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.7),rgba(34,211,238,0.3)_28%,rgba(56,189,248,0.15)_44%,rgba(15,23,42,0.9)_70%)] shadow-[0_0_50px_rgba(34,211,238,0.6),0_0_100px_rgba(56,189,248,0.32)] transition-transform duration-200"
//               style={{ transform: `scale(${visualizerScale})` }}
//             />
//           </div>
//         </div>

//         <div className="mt-6 flex h-24 w-full max-w-2xl items-end justify-center gap-1.5 px-2">
//           {waveBars.map((bar) => (
//             <div
//               key={bar.id}
//               className="w-[7px] rounded-full bg-linear-to-t from-indigo-400 via-cyan-300 to-cyan-100 transition-all duration-150"
//               style={{
//                 height: `${bar.height}px`,
//                 opacity: bar.opacity,
//                 boxShadow: "0 0 16px rgba(34,211,238,0.5)",
//               }}
//             />
//           ))}
//         </div>

//         <p className="mt-4 text-center text-sm text-cyan-100/90">
//           {isAiSpeaking
//             ? "Assistant is speaking"
//             : isMicStreaming
//               ? "Listening to your voice"
//               : "Press Start to begin voice conversation"}
//         </p>

//         {(lastError || uiError) ? (
//           <div className="mt-4 w-full max-w-xl rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100">
//             {uiError || lastError}
//           </div>
//         ) : null}

//         {assistantDraft ? (
//           <div className="mt-4 w-full max-w-xl wrap-anywhere rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
//             {assistantDraft}
//           </div>
//         ) : null}
//       </div>

//       <div className="relative z-10 mt-6 flex flex-col items-center gap-3">
//         <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
//           <label className="w-full sm:w-auto">
//             <span className="sr-only">Prediction condition</span>
//             <select
//               value={conditionType}
//               onChange={(event) => handleConditionChange(event.target.value as ConditionType)}
//               className="w-full rounded-full border border-cyan-300/35 bg-slate-900/80 px-4 py-3 text-sm font-medium text-cyan-100 outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 sm:min-w-[220px]"
//               disabled={isSessionActive}
//               aria-label="Select prediction condition"
//             >
//               <option value="diabetes">Diabetes</option>
//               <option value="heart-disease">Heart disease</option>
//             </select>
//           </label>

//           <button
//             type="button"
//             onClick={() => {
//               void handlePrimaryMicButton();
//             }}
//             className={`w-full sm:w-auto sm:min-w-[190px] rounded-full px-6 py-3 text-sm font-semibold text-white transition-all ${
//               isAiSpeaking
//                 ? "bg-cyan-500 shadow-[0_0_22px_rgba(34,211,238,0.85)]"
//                 : isMicStreaming
//                   ? "bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.7)]"
//                   : "bg-slate-700 hover:bg-slate-600"
//             } disabled:cursor-not-allowed disabled:bg-slate-700/70`}
//             disabled={!canStartSession || connectionState === "connecting"}
//           >
//             {primaryButtonLabel}
//           </button>

//           <button
//             type="button"
//             onClick={() => {
//               void handleResetSession();
//             }}
//             className="w-full sm:w-auto rounded-full border border-cyan-300/40 bg-slate-900/70 px-6 py-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
//             disabled={connectionState === "connecting"}
//           >
//             Reset
//           </button>
//         </div>

//         <p className="px-2 text-center text-xs text-slate-400">
//           Condition: {conditionType === "heart-disease" ? "Heart disease" : "Diabetes"} · Mic: {micPermission} · Chunks/sec: {sentChunksPerSecond}
//         </p>
//         {isSessionActive ? (
//           <p className="px-2 text-center text-[11px] text-slate-500">
//             End or reset the current session to change condition.
//           </p>
//         ) : null}
//       </div>
//     </section>
//   );
// }



"use client";

/**
 * RealtimeHealthChat.tsx
 * ──────────────────────
 * BUG FIXES vs original:
 *
 * ① PcmCapture was instantiated with 44100 Hz — Gemini requires 16 kHz.
 *   Fixed: new PcmCapture(16_000, 512).
 *
 * ② Half-duplex block: when assistantSpeakingRef was true, ALL user audio
 *   was dropped and VAD was never triggered. This prevented barge-in. The
 *   backend already handles START_OF_ACTIVITY_INTERRUPTS; just let it.
 *   Fixed: removed the early-return block, always send captured audio.
 *   The local pcmPlayer.interrupt() is called when user starts speaking.
 *
 * ③ Noise gate used hard-coded RMS thresholds that were tuned for 44 kHz
 *   (more samples → more averaging → lower RMS). At 16 kHz with 20 ms chunks
 *   (320 samples) the thresholds were too high, silencing the user.
 *   Fixed: lowered and simplified thresholds; removed EMA noise floor because
 *   it was accumulating silence RMS from the assistant-speaking period.
 *
 * ④ sendClearHistory was called after every turn_complete, sending an extra
 *   WebSocket frame mid-conversation. Reverted to opt-in only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PcmCapture } from "@/lib/audio/pcmCapture";
import { PcmPlayer } from "@/lib/audio/pcmPlayer";
import {
  RealtimeInitPayload,
  useRealtimeHealthSocket,
} from "@/hooks/useRealtimeHealthSocket";

// ── Types ─────────────────────────────────────────────────────────────────────

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
    advice?: { risk_level?: string; score?: number; [k: string]: unknown };
    [k: string]: unknown;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

interface RealtimeHealthChatProps {
  wsUrl?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gemini Live requires exactly 16 kHz. */
const CAPTURE_SAMPLE_RATE = 16_000;
/** 512-sample buffer @ 16 kHz = 32 ms per ScriptProcessor callback. */
const CAPTURE_BUFFER_SIZE = 512;

/**
 * Noise gate tuned for 16 kHz / 320-sample (20 ms) chunks.
 * RMS values are lower at 16 kHz vs 44 kHz because each chunk is shorter.
 */
const NOISE_GATE_OPEN = 0.008;   // open threshold (speech detected)
const NOISE_GATE_CLOSE = 0.006;  // hysteresis: stay open until RMS drops below this
const SPEECH_HOLD_MS = 300;      // hold open after last speech frame (ms)
const PRE_SPEECH_FRAMES = 3;     // frames prepended before gate opens (context)

/** Batch N frames into one WebSocket send to reduce packet overhead. */
const BATCH_FRAMES = 4;
const BATCH_HOLD_MS = 40;
const MAX_QUEUE_FRAMES = 12;
const HIGH_BUFFER_BYTES = 48 * 1024;

// ── Helper utils ──────────────────────────────────────────────────────────────

function toSafeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toSafeString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function estimateRms(pcm: Int16Array): number {
  if (!pcm.length) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const n = pcm[i] / 32768;
    sum += n * n;
  }
  return Math.sqrt(sum / pcm.length);
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function prettyState(s: string): string {
  const map: Record<string, string> = {
    live: "Live", connecting: "Connecting", reconnecting: "Reconnecting",
    closed: "Disconnected", error: "Error", idle: "Idle",
  };
  return map[s] ?? s;
}

const DIABETES_KEYS = new Set([
  "gender","age","height","weight","hypertension","heartDisease",
  "smokingHistory","bmi","hbA1cLevel","bloodGlucoseLevel",
]);
const HEART_KEYS = new Set([
  "age","sex","chest_pain_type","resting_bp","cholesterol","fasting_blood_sugar",
  "resting_ecg","max_heart_rate","exercise_angina","oldpeak","st_slope",
]);

function pickKeys(
  data: Record<string, unknown>,
  cond: ConditionType,
): Record<string, unknown> {
  const allowed = cond === "diabetes" ? DIABETES_KEYS : HEART_KEYS;
  return Object.fromEntries(
    Object.entries(data).filter(([k, v]) => allowed.has(k) && v != null && v !== ""),
  );
}

function normalizeRiskLevel(v: string | null): string | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("moderate")) return "moderate";
  if (s.includes("low")) return "low";
  return s;
}

function sanitizeEntry(entry: HistoryEntry) {
  return {
    date: toSafeString(entry.date),
    inputMetrics: Object.fromEntries(
      Object.entries(entry.inputMetrics ?? {}).filter(([, v]) => v != null && v !== ""),
    ),
    predictionSummary: {
      prediction: toSafeString(entry.prediction) ?? toSafeString(entry.result?.prediction),
      probability: toSafeNumber(entry.probability) ?? toSafeNumber(entry.result?.probability),
      riskScore: toSafeNumber(entry.riskScore) ?? toSafeNumber(entry.result?.riskScore),
      riskLevel: normalizeRiskLevel(
        toSafeString(entry.riskLevel) ?? toSafeString(entry.result?.riskLevel) ?? null,
      ),
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RealtimeHealthChat({ wsUrl }: RealtimeHealthChatProps) {
  const { data: session, status } = useSession();
  const user = session?.user as SessionUser | undefined;

  // ── State ───────────────────────────────────────────────────────────────
  const [conditionType, setConditionType] = useState<ConditionType>("diabetes");
  const [chatId, setChatId] = useState(createId);
  const [extraContext, setExtraContext] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [healthData, setHealthData] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isMicOn, setIsMicOn] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [micPermission, setMicPermission] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [autoStartMic, setAutoStartMic] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [chunksSent, setChunksSent] = useState(0);
  const [chunkRms, setChunkRms] = useState(0);
  const [chunksPerSec, setChunksPerSec] = useState(0);
  const [vizLevel, setVizLevel] = useState(0.12);

  // ── Refs ────────────────────────────────────────────────────────────────
  const captureRef = useRef<PcmCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);

  // Voice activity
  const userSpeakingRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const assistantSpeakingRef = useRef(false);
  const suppressAudioUntilRef = useRef(0);
  const lastAsstAudioAtRef = useRef(0);

  // Audio batching
  const frameQueueRef = useRef<Int16Array[]>([]);
  const preSpeechRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Telemetry
  const sentTimesRef = useRef<number[]>([]);
  const vizPhaseRef = useRef(0);

  // ── Derived ─────────────────────────────────────────────────────────────
  const resolvedUrl = wsUrl?.trim() || "";
  const userId = user?.id || user?.email || "";
  const displayName = user?.name?.trim() || "there";

  const conditionHistory = useMemo(() => {
    const filtered = history
      .filter((e) => e.condition === conditionType)
      .slice(0, 5)
      .map((e) => ({ ...sanitizeEntry(e), inputMetrics: pickKeys(sanitizeEntry(e).inputMetrics, conditionType) }));
    const seen = new Set<string>();
    return filtered
      .filter((e) => {
        const k = JSON.stringify(e.inputMetrics) + JSON.stringify(e.predictionSummary);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 5);
  }, [conditionType, history]);

  const scopedHealth = useMemo(() => pickKeys(healthData, conditionType), [conditionType, healthData]);

  const initPayload: RealtimeInitPayload | null = useMemo(() => {
    if (!userId || status !== "authenticated") return null;
    return {
      userId, chatId, name: displayName, conditionType,
      healthData: scopedHealth, history: conditionHistory,
      extraContext: extraContext.trim() || undefined,
    };
  }, [chatId, conditionHistory, conditionType, displayName, extraContext, scopedHealth, status, userId]);

  // ── Audio helpers ────────────────────────────────────────────────────────

  useEffect(() => {
    assistantSpeakingRef.current = assistantSpeaking;
  }, [assistantSpeaking]);

  const stopAssistantAudio = useCallback((suppressMs = 0) => {
    playerRef.current?.interrupt();
    setAssistantSpeaking(false);
    if (suppressMs > 0) suppressAudioUntilRef.current = Date.now() + suppressMs;
  }, []);

  const clearQueue = useCallback(() => {
    frameQueueRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // ── Socket callbacks ─────────────────────────────────────────────────────

  const commitDraft = useCallback(() => {
    setAssistantDraft((draft) => {
      const text = draft.trim();
      if (text) {
        setMessages((prev) => [...prev, { id: createId(), role: "assistant", text }]);
      }
      return "";
    });
  }, []);

  const onAssistantDelta = useCallback((delta: string) => {
    setAssistantDraft((prev) => prev + delta);
  }, []);

  const onAssistantTurnComplete = useCallback(() => {
    commitDraft();
    // No automatic clear_history — it resets context the model needs.
  }, [commitDraft]);

  const onAssistantAudio = useCallback(async (b64: string) => {
    if (Date.now() < suppressAudioUntilRef.current) return;
    if (!playerRef.current) playerRef.current = new PcmPlayer(24_000);
    lastAsstAudioAtRef.current = Date.now();
    setAssistantSpeaking(true);
    try {
      await playerRef.current.playBase64Chunk(b64);
    } catch (e) {
      console.error("Playback error", e);
    }
  }, []);

  const onRealtimeError = useCallback((msg: string) => {
    setUiError(msg);
  }, []);

  const {
    connectionState, isInitialized, lastError,
    connect, disconnect, sendAudioChunk, getBufferedAmount,
  } = useRealtimeHealthSocket({
    wsUrl: resolvedUrl,
    initPayload,
    autoReconnect: true,
    onAssistantDelta,
    onAssistantTurnComplete,
    onAssistantAudio,
    onErrorEvent: onRealtimeError,
  });

  // ── Audio batching / flush ───────────────────────────────────────────────

  const flushQueue = useCallback(() => {
    const frames = frameQueueRef.current;
    if (!frames.length) return;

    if (getBufferedAmount() > HIGH_BUFFER_BYTES) {
      // Drop all but the freshest frame to reduce latency.
      frameQueueRef.current = [frames[frames.length - 1]];
      return;
    }

    let total = 0;
    let wRms = 0;
    let wLen = 0;
    frames.forEach((f) => {
      total += f.length;
      const r = estimateRms(f);
      wRms += r * f.length;
      wLen += f.length;
    });

    const merged = new Int16Array(total);
    let off = 0;
    frames.forEach((f) => { merged.set(f, off); off += f.length; });
    frameQueueRef.current = [];
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }

    if (!sendAudioChunk(merged)) {
      setUiError("Audio stream stopped — session not active.");
      return;
    }

    const rms = wLen > 0 ? wRms / wLen : 0;
    const now = Date.now();
    const times = [...sentTimesRef.current.filter((t) => now - t <= 1000), now];
    sentTimesRef.current = times;
    setChunksPerSec(times.length);
    setChunkRms(rms);
    setChunksSent((p) => p + 1);
  }, [getBufferedAmount, sendAudioChunk]);

  const enqueueFrame = useCallback((frame: Int16Array) => {
    const q = frameQueueRef.current;
    q.push(frame);
    if (q.length > MAX_QUEUE_FRAMES) q.splice(0, q.length - MAX_QUEUE_FRAMES);
    if (q.length >= BATCH_FRAMES) {
      flushQueue();
      return;
    }
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushQueue();
      }, BATCH_HOLD_MS);
    }
  }, [flushQueue]);

  // ── Core PCM handler ─────────────────────────────────────────────────────

  const handleChunk = useCallback((chunk: Int16Array) => {
    const now = Date.now();
    const rms = estimateRms(chunk);

    // ── FIX ②: DO NOT drop audio when assistant is speaking.
    // The backend VAD handles barge-in via START_OF_ACTIVITY_INTERRUPTS.
    // We just interrupt local playback so the user doesn't hear overlap.
    const isUserSpeaking = userSpeakingRef.current;
    const openThreshold = NOISE_GATE_OPEN;
    const closeThreshold = NOISE_GATE_CLOSE;
    const hasSpeech = isUserSpeaking ? rms >= closeThreshold : rms >= openThreshold;

    if (hasSpeech) {
      if (!isUserSpeaking) {
        // User started speaking — interrupt assistant playback for barge-in.
        userSpeakingRef.current = true;
        if (assistantSpeakingRef.current) {
          stopAssistantAudio(150); // brief suppress so echo doesn't feed back
        }
        // Send pre-speech buffer first (gives model context).
        preSpeechRef.current.forEach((f) => enqueueFrame(f));
        preSpeechRef.current = [];
      }
      lastSpeechAtRef.current = now;
      enqueueFrame(chunk);
      return;
    }

    // Hold gate open for SPEECH_HOLD_MS after last speech frame.
    if (isUserSpeaking && now - lastSpeechAtRef.current <= SPEECH_HOLD_MS) {
      enqueueFrame(chunk);
      return;
    }

    // Speech ended — flush and reset.
    if (isUserSpeaking) {
      userSpeakingRef.current = false;
      flushQueue();
    }

    // Keep a rolling window of pre-speech frames.
    const clone = chunk.slice();
    preSpeechRef.current.push(clone);
    if (preSpeechRef.current.length > PRE_SPEECH_FRAMES) {
      preSpeechRef.current.shift();
    }
  }, [enqueueFrame, flushQueue, stopAssistantAudio]);

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingData(true);

    const load = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/predictions/history?limit=5"),
        ]);

        const isProfileFatal = profileRes.ok === false && ![401, 404].includes(profileRes.status);
        const isHistoryFatal = historyRes.ok === false && ![401, 404].includes(historyRes.status);

        if (isProfileFatal || isHistoryFatal) {
          throw new Error("Failed to load health context");
        }

        const profileJson = profileRes.ok ? await profileRes.json() : { healthData: {} };
        const historyJson = historyRes.ok ? await historyRes.json() : { history: [] };

        setHealthData(profileJson.healthData ?? {});

        const sorted = [...(historyJson.history ?? [])].sort(
          (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
        );
        setHistory(sorted);
        const latest = sorted[0]?.condition;
        if (latest === "heart-disease" || latest === "diabetes") setConditionType(latest);
      } catch (err) {
        console.error(err);
        setUiError("Unable to load health context.");
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, [status]);

  // ── Session effects ───────────────────────────────────────────────────────

  useEffect(() => {
    if (connectionState === "live") setSessionStarted(true);
  }, [connectionState]);

  useEffect(() => {
    if (!sessionStarted) return;
    if (connectionState !== "error" && !lastError && !uiError) return;
    const stopOnError = async () => {
      await captureRef.current?.stop();
      setIsMicOn(false);
      disconnect();
      setSessionStarted(false);
    };
    void stopOnError();
  }, [connectionState, disconnect, lastError, sessionStarted, uiError]);

  useEffect(() => {
    if (connectionState !== "live") {
      clearQueue();
      preSpeechRef.current = [];
    }
  }, [clearQueue, connectionState]);

  // Auto-start mic once session initializes.
  useEffect(() => {
    if (!autoStartMic || !isInitialized || isMicOn) return;

    const start = async () => {
      try {
        if (micPermission !== "granted") {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
          setMicPermission("granted");
        }
        if (!captureRef.current) {
          captureRef.current = new PcmCapture(CAPTURE_SAMPLE_RATE, CAPTURE_BUFFER_SIZE);
        }
        setChunksSent(0);
        await captureRef.current.start(handleChunk);
        setIsMicOn(true);
        setUiError(null);
      } catch (error) {
        console.error("Microphone start error:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to start microphone";
        setUiError(`Microphone error: ${errorMsg}`);
        setIsMicOn(false);
        captureRef.current = null;
      } finally {
        setAutoStartMic(false);
      }
    };
    void start();
  }, [autoStartMic, handleChunk, isInitialized, isMicOn, micPermission]);

  // Decay assistantSpeaking flag when audio stops arriving.
  useEffect(() => {
    if (!assistantSpeaking) return;
    const id = setInterval(() => {
      if (Date.now() - lastAsstAudioAtRef.current > 900) setAssistantSpeaking(false);
    }, 200);
    return () => clearInterval(id);
  }, [assistantSpeaking]);

  // Visualizer animation.
  useEffect(() => {
    const id = setInterval(() => {
      vizPhaseRef.current += 0.35;
      const idle = 0.12 + ((Math.sin(vizPhaseRef.current) + 1) * 0.04);
      const speaking = 0.52 + ((Math.sin(vizPhaseRef.current * 1.6) + 1) * 0.18);
      const listening = Math.min(0.85, Math.max(0.16, (chunkRms / 0.04) + ((Math.sin(vizPhaseRef.current * 1.2) + 1) * 0.06)));
      const target = assistantSpeaking ? speaking : isMicOn ? listening : idle;
      setVizLevel((p) => p * 0.78 + target * 0.22);
    }, 80);
    return () => clearInterval(id);
  }, [assistantSpeaking, chunkRms, isMicOn]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void captureRef.current?.stop();
      void playerRef.current?.close();
      captureRef.current = null;
      playerRef.current = null;
    };
  }, []);

  // Mic permission check.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((r) => {
      const state = r.state === "granted" || r.state === "denied" || r.state === "prompt" ? r.state : "unknown";
      setMicPermission(state);
      r.onchange = () => {
        const next = r.state === "granted" || r.state === "denied" || r.state === "prompt" ? r.state : "unknown";
        setMicPermission(next);
      };
    }).catch(() => setMicPermission("unknown"));
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleMic = async () => {
    if (isMicOn) {
      await captureRef.current?.stop();
      clearQueue();
      userSpeakingRef.current = false;
      setIsMicOn(false);
      return;
    }
    try {
      if (micPermission !== "granted") {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        setMicPermission("granted");
      }
      // ── FIX ①: Use 16 kHz capture rate (was 44100).
      if (!captureRef.current) {
        captureRef.current = new PcmCapture(CAPTURE_SAMPLE_RATE, CAPTURE_BUFFER_SIZE);
      }
      setChunksSent(0);
      await captureRef.current.start(handleChunk);
      setIsMicOn(true);
      setUiError(null);
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : "Unknown microphone error";
      setUiError(`Microphone error: ${errorMsg}`);
      setIsMicOn(false);
      captureRef.current = null;
    }
  };

  const handleStartSession = () => {
    if (!resolvedUrl) { setUiError("Missing WS_URL."); return; }
    if (!initPayload) { setUiError("User context not ready."); return; }
    setUiError(null);
    setAutoStartMic(true);
    setSessionStarted(true);
    connect();
  };

  const handleEndSession = async () => {
    await captureRef.current?.stop();
    clearQueue();
    setIsMicOn(false);
    stopAssistantAudio();
    userSpeakingRef.current = false;
    disconnect();
    setSessionStarted(false);
    setAutoStartMic(false);
  };

  const handleReset = async () => {
    await handleEndSession();
    commitDraft();
    setMessages([]);
    setChatId(createId());
    setUiError(null);
  };

  // ── Derived UI values ─────────────────────────────────────────────────────

  const isActive = ["live","connecting","reconnecting"].includes(connectionState);
  const isAiSpeaking = assistantSpeaking && isActive;
  const vizScale = 1 + vizLevel * 0.35;
  const canStart = Boolean(resolvedUrl && initPayload);

  const waveBars = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => {
      const phase = vizPhaseRef.current + i * 0.45;
      const wave = (Math.sin(phase) + 1) / 2;
      return {
        id: `b${i}`,
        height: Math.min(84, Math.max(10, 10 + Math.round(vizLevel * 48 + wave * 44))),
        opacity: 0.35 + wave * 0.55,
      };
    });
  }, [vizLevel]);

  const statusLabel = isAiSpeaking ? "AI Speaking" : isMicOn ? "Listening" : isActive ? "Ready" : "Idle";
  const btnLabel = connectionState === "connecting" ? "Starting…" : isMicOn ? "Stop Mic" : "Start Mic";

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === "loading") {
    return <p className="text-sm text-slate-400">Loading session…</p>;
  }

  if (status !== "authenticated") {
    return (
      <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4 text-amber-200">
        Please sign in to start a voice health session.
      </div>
    );
  }

  return (
    <section className="relative mx-auto flex min-h-[78vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950 px-3 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:px-4 sm:py-6 md:rounded-3xl md:px-8 md:py-8">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_38%),radial-gradient(circle_at_80%_90%,rgba(129,140,248,0.20),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))]" />

      {/* Header */}
      <header className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Voice AI · Jinni</p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl md:text-3xl">
            Realtime Health Guide
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {loadingData
              ? "Preparing health context…"
              : `${statusLabel} · ${prettyState(connectionState)}`}
          </p>
        </div>
        <div className="flex max-w-full items-center gap-2 self-start truncate rounded-full border border-cyan-300/30 bg-slate-900/60 px-3 py-1 text-[11px] text-cyan-100 backdrop-blur sm:px-4 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
          Session {chatId.slice(-8)}
        </div>
      </header>

      {/* Visualizer */}
      <div className="relative z-10 mt-5 flex flex-1 flex-col items-center justify-center px-2">
        <div className="relative flex h-[300px] w-[300px] items-center justify-center md:h-[360px] md:w-[360px]">
          <div
            className="absolute h-full w-full rounded-full bg-cyan-400/15 blur-3xl transition-transform duration-200"
            style={{ transform: `scale(${1.02 + vizLevel * 0.45})` }}
          />
          <div
            className="absolute h-[78%] w-[78%] rounded-full bg-indigo-400/20 blur-2xl transition-transform duration-200"
            style={{ transform: `scale(${1 + vizLevel * 0.3})` }}
          />
          <div className="relative flex h-full w-full items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[88%] w-[88%] rounded-full border border-cyan-300/35" />
            </div>
            <div
              className="relative h-[48%] w-[48%] rounded-full border border-cyan-200/70 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.7),rgba(34,211,238,0.3)_28%,rgba(56,189,248,0.15)_44%,rgba(15,23,42,0.9)_70%)] shadow-[0_0_50px_rgba(34,211,238,0.6),0_0_100px_rgba(56,189,248,0.32)] transition-transform duration-200"
              style={{ transform: `scale(${vizScale})` }}
            />
          </div>
        </div>

        {/* Wave bars */}
        <div className="mt-6 flex h-24 w-full max-w-2xl items-end justify-center gap-1.5 px-2">
          {waveBars.map((bar) => (
            <div
              key={bar.id}
              className="w-[7px] rounded-full bg-gradient-to-t from-indigo-400 via-cyan-300 to-cyan-100 transition-all duration-150"
              style={{ height: `${bar.height}px`, opacity: bar.opacity, boxShadow: "0 0 16px rgba(34,211,238,0.5)" }}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-cyan-100/90">
          {isAiSpeaking ? "Jinni is speaking" : isMicOn ? "Listening…" : "Press Start Mic to begin"}
        </p>

        {/* Error banner */}
        {(lastError || uiError) ? (
          <div className="mt-4 w-full max-w-xl rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100">
            {uiError || lastError}
          </div>
        ) : null}

        {/* Assistant draft */}
        {assistantDraft ? (
          <div className="mt-4 w-full max-w-xl wrap-anywhere rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
            {assistantDraft}
          </div>
        ) : null}

        {/* Chat messages */}
        {messages.length > 0 && (
          <div className="mt-4 w-full max-w-xl space-y-2 max-h-48 overflow-y-auto">
            {messages.slice(-6).map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-xs ${
                  m.role === "assistant"
                    ? "bg-cyan-900/40 text-cyan-100 border border-cyan-400/20"
                    : "bg-slate-800/60 text-slate-300 border border-slate-600/30 self-end"
                }`}
              >
                <span className="font-semibold opacity-60 mr-1">
                  {m.role === "assistant" ? "Jinni" : "You"}:
                </span>
                {m.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 mt-6 flex flex-col items-center gap-3">
        <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
          <label className="w-full sm:w-auto">
            <span className="sr-only">Condition</span>
            <select
              value={conditionType}
              onChange={(e) => {
                if (!isActive) setConditionType(e.target.value as ConditionType);
              }}
              disabled={isActive}
              className="w-full rounded-full border border-cyan-300/35 bg-slate-900/80 px-4 py-3 text-sm font-medium text-cyan-100 outline-none transition focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 sm:min-w-[220px]"
            >
              <option value="diabetes">Diabetes</option>
              <option value="heart-disease">Heart Disease</option>
            </select>
          </label>

          <button
            type="button"
            disabled={!canStart || connectionState === "connecting"}
            onClick={() => { void (isActive ? toggleMic() : handleStartSession()); }}
            className={`w-full sm:w-auto sm:min-w-[190px] rounded-full px-6 py-3 text-sm font-semibold text-white transition-all ${
              isAiSpeaking
                ? "bg-cyan-500 shadow-[0_0_22px_rgba(34,211,238,0.85)]"
                : isMicOn
                  ? "bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.7)]"
                  : "bg-slate-700 hover:bg-slate-600"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {btnLabel}
          </button>

          <button
            type="button"
            disabled={connectionState === "connecting"}
            onClick={() => { void handleReset(); }}
            className="w-full sm:w-auto rounded-full border border-cyan-300/40 bg-slate-900/70 px-6 py-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        <p className="px-2 text-center text-xs text-slate-500">
          {conditionType === "heart-disease" ? "Heart Disease" : "Diabetes"}
          {" · "}Mic: {micPermission}
          {" · "}Chunks/s: {chunksPerSec}
          {" · "}Total: {chunksSent}
        </p>

        {isActive && (
          <p className="px-2 text-center text-[11px] text-slate-600">
            End or reset session to change condition.
          </p>
        )}
      </div>
    </section>
  );
}