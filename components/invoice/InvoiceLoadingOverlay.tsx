"use client";

interface Props {
  visible:  boolean;
  message?: string;
}

export default function InvoiceLoadingOverlay({
  visible,
  message = "Processing, please wait…",
}: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)" }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-5 shadow-2xl max-w-sm text-center">
        <div
          className="w-14 h-14 rounded-full border-4 border-border"
          style={{
            borderTopColor:   "#FFB800",
            borderRightColor: "#1B2A8A",
            animation:        "spin 0.8s linear infinite",
          }}
        />

        <div>
          <p className="font-bold text-foreground text-base">{message}</p>
          <p className="text-muted-foreground text-xs mt-1">
            Please do not close or refresh this page.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
