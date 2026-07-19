import { REGISTER_BIT_WIDTH } from "../../domain/constants";
import { formatRegisterAsBinary, formatRegisterAsHex, formatRegisterBits } from "../../utils/registerFormatters";

type RegisterAccent = "cyan" | "amber" | "green";

interface RegisterCardProps {
  readonly label: string;
  readonly value: number;
  readonly accent: RegisterAccent;
}

const accentClassNames: Record<RegisterAccent, string> = {
  cyan: "border-lab-cyan text-lab-cyan",
  amber: "border-lab-amber text-lab-amber",
  green: "border-lab-green text-lab-green",
};

export function RegisterCard({ label, value, accent }: RegisterCardProps) {
  const bits = formatRegisterBits(value);

  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">{label}</h2>
        <span className={`rounded border px-2 py-1 font-mono text-sm font-semibold ${accentClassNames[accent]}`}>
          {formatRegisterAsHex(value)}
        </span>
      </div>

      <div className="mb-4 font-mono text-2xl font-bold tracking-normal text-white">{formatRegisterAsBinary(value)}</div>

      <div className="grid grid-cols-8 gap-1">
        {bits.map((isSet, index) => {
          const bitLabel = REGISTER_BIT_WIDTH - index - 1;
          return (
            <div key={bitLabel} className="text-center">
              <div
                className={
                  isSet
                    ? "flex aspect-square items-center justify-center rounded border border-lab-green bg-lab-green/15 font-mono text-sm font-bold text-lab-green"
                    : "flex aspect-square items-center justify-center rounded border border-lab-line bg-lab-bg font-mono text-sm font-bold text-lab-muted"
                }
              >
                {isSet ? "1" : "0"}
              </div>
              <div className="mt-1 font-mono text-[10px] text-lab-muted">{bitLabel}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
