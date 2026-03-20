import RealtimeHealthChat from "@/components/RealtimeHealthChat";

export default function VoiceAssistantPage() {
  const wsUrl = process.env.WS_URL || "";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-2 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
      <RealtimeHealthChat wsUrl={wsUrl} />
    </div>
  );
}
