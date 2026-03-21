import RealtimeHealthChat from "@/components/RealtimeHealthChat";
import { Card } from "@/components/ui/Card";

export default function VoiceAssistantPage() {
  const wsUrl = process.env.WS_URL || "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 py-10 px-4 sm:px-6 lg:px-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-8 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float delay-200" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <h1 className="px-2 text-3xl md:text-4xl font-extrabold text-white mb-6 text-center">Voice Health Assistant</h1>
        <Card title="Realtime Health Chat" description="Use voice-based intelligence to discuss symptoms, risk, and next steps." className="p-4 md:p-6">
          <div className="min-h-[60vh] rounded-2xl overflow-hidden bg-white/80 dark:bg-slate-900/70">
            <RealtimeHealthChat wsUrl={wsUrl} />
          </div>
        </Card>
      </div>
    </div>
  );
}
