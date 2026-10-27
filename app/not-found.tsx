import type { Metadata } from "next";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "ไม่พบหน้าที่ต้องการ",
};

const STARS = [
  { x: 40, y: 38, r: 2, d: "0s" },
  { x: 118, y: 72, r: 1.5, d: "0.8s" },
  { x: 210, y: 28, r: 2.2, d: "1.6s" },
  { x: 300, y: 64, r: 1.6, d: "0.4s" },
  { x: 392, y: 34, r: 2, d: "1.2s" },
  { x: 470, y: 82, r: 1.5, d: "2s" },
  { x: 76, y: 118, r: 1.4, d: "1.4s" },
  { x: 440, y: 130, r: 1.8, d: "0.2s" },
];

function CampScene() {
  return (
    <svg
      aria-hidden="true"
      className="w-full h-auto"
      viewBox="0 0 520 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nf-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3f5a4f" />
          <stop offset="1" stopColor="#6b857a" />
        </linearGradient>
        <radialGradient id="nf-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect fill="url(#nf-sky)" height="260" rx="28" width="520" />

      {STARS.map((s) => (
        <circle
          key={`${s.x}-${s.y}`}
          className="nf-twinkle"
          cx={s.x}
          cy={s.y}
          fill="#fff"
          r={s.r}
          style={{ animationDelay: s.d }}
        />
      ))}

      {/* moon */}
      <circle cx="420" cy="62" fill="#fdf6df" r="22" />
      <circle cx="430" cy="55" fill="#4d695d" r="19" />

      {/* hills */}
      <path
        d="M0 190 Q90 140 190 178 T380 168 T520 186 V260 H0 Z"
        fill="#547064"
      />
      <path
        d="M0 214 Q120 178 240 206 T520 204 V260 H0 Z"
        fill="#465f54"
      />

      {/* pine trees */}
      {[
        { x: 52, s: 1 },
        { x: 92, s: 0.75 },
        { x: 450, s: 1.05 },
        { x: 486, s: 0.7 },
      ].map((t) => (
        <g key={t.x} transform={`translate(${t.x} ${222 - 70 * t.s}) scale(${t.s})`}>
          <polygon fill="#2f4a3f" points="0,0 22,46 -22,46" />
          <polygon fill="#2f4a3f" points="0,22 28,66 -28,66" />
          <rect fill="#3a2f27" height="10" width="6" x="-3" y="66" />
        </g>
      ))}

      {/* tent */}
      <g>
        <polygon fill="#f6f3eb" points="150,222 215,128 280,222" />
        <polygon fill="#e4dfd0" points="215,128 280,222 232,222" />
        <polygon fill="#2f4a3f" points="203,222 215,170 227,222" />
        <line stroke="#5d7c6f" strokeWidth="3" x1="215" x2="215" y1="128" y2="118" />
        <polygon fill="#e8a33d" points="215,118 215,128 236,123" />
      </g>

      {/* campfire */}
      <g transform="translate(340 222)">
        <ellipse cx="0" cy="-26" fill="url(#nf-glow)" rx="64" ry="54" />
        <rect
          fill="#5a4636"
          height="7"
          rx="3.5"
          transform="rotate(-20)"
          width="38"
          x="-19"
          y="-4"
        />
        <rect
          fill="#6b543f"
          height="7"
          rx="3.5"
          transform="rotate(20)"
          width="38"
          x="-19"
          y="-4"
        />
        <g className="nf-flame">
          <path
            d="M0 -4 C-14 -10 -12 -28 -2 -40 C0 -30 10 -28 10 -16 C10 -8 6 -4 0 -4 Z"
            fill="#f08a24"
          />
          <path
            d="M0 -4 C-7 -8 -6 -18 0 -26 C3 -19 7 -17 6 -11 C6 -7 3 -4 0 -4 Z"
            fill="#ffd37a"
          />
        </g>
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#f6f3eb] flex items-center justify-center px-4 py-10">
      <style>{`
        @keyframes nf-twinkle { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        @keyframes nf-flicker {
          0%,100% { transform: scale(1) translateY(0) }
          30% { transform: scale(1.06, 0.94) translateY(0.5px) }
          60% { transform: scale(0.95, 1.07) translateY(-0.5px) }
        }
        @keyframes nf-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .nf-twinkle { animation: nf-twinkle 3s ease-in-out infinite }
        .nf-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: nf-flicker 1.2s ease-in-out infinite }
        .nf-rise { animation: nf-rise .6s ease-out both }
        @media (prefers-reduced-motion: reduce) {
          .nf-twinkle, .nf-flame, .nf-rise { animation: none }
        }
      `}</style>

      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[#5d7c6f]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#e8a33d]/10 blur-3xl" />

      <div className="nf-rise relative w-full max-w-[520px] rounded-3xl bg-white p-5 shadow-[0_4px_25px_rgba(0,0,0,0.04)] sm:p-7">
        <div className="relative">
          <CampScene />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-[8%] text-center text-[88px] font-bold leading-none tracking-tight text-white/95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)] sm:text-[104px]"
          >
            404
          </span>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5d7c6f]">
            Page not found
          </p>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-[#334155] sm:text-[28px]">
            ดูเหมือนว่าคุณจะหลงทางจากค่าย
          </h1>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-relaxed text-gray-500">
            ไม่พบหน้าที่คุณกำลังมองหา อาจถูกย้ายหรือลบไปแล้ว
            หรือพิมพ์ที่อยู่ลิงก์ไม่ถูกต้อง
          </p>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <BackButton className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f1f3f5] px-6 text-sm font-semibold text-slate-500 transition-colors hover:bg-[#e6e9ec] hover:text-slate-700">
            <ArrowLeft size={16} />
            ย้อนกลับ
          </BackButton>
          <Link
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#6b857a] px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#5a7168]"
            href="/"
          >
            <Home size={18} />
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
