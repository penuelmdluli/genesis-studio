export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 animate-pulse" />
        <div className="w-32 h-2 bg-white/10 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
