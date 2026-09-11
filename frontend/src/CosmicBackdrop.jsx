export default function CosmicBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(212,175,55,0.16),transparent_55%),radial-gradient(900px_600px_at_100%_20%,rgba(139,105,20,0.18),transparent_50%),radial-gradient(800px_500px_at_0%_80%,rgba(201,162,39,0.1),transparent_55%),linear-gradient(180deg,#050a14_0%,#07111c_48%,#05080f_100%)]" />

      <div className="absolute top-[-8%] left-1/2 -translate-x-1/2 w-[920px] h-[520px] rounded-full bg-[#d4af37]/20 blur-[150px]" />
      <div className="absolute top-28 left-[-8%] w-[460px] h-[460px] rounded-full bg-[#c9a227]/12 blur-[130px]" />
      <div className="absolute top-[58%] right-[-10%] w-[560px] h-[500px] rounded-full bg-[#8b6914]/22 blur-[140px]" />

      <svg
        className="absolute left-1/2 top-16 -translate-x-1/2 w-[760px] max-w-none h-[760px] opacity-[0.09]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M200 42c6 0 11 5 11 11v18h78c4 0 7 4 6 8l-18 72c-8 32-37 54-70 54h-14c-33 0-62-22-70-54L105 79c-1-4 2-8 6-8h78V53c0-6 5-11 11-11Z"
          stroke="#d4af37"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="M200 71v214" stroke="#d4af37" strokeWidth="8" strokeLinecap="round" />
        <path d="M154 285h92c8 0 14 6 14 14v12H140v-12c0-8 6-14 14-14Z" fill="#d4af37" />
        <path d="M118 285h164v18H118z" fill="#d4af37" />
        <circle cx="116" cy="168" r="38" stroke="#d4af37" strokeWidth="6" />
        <circle cx="284" cy="168" r="38" stroke="#d4af37" strokeWidth="6" />
        <path d="M168 210l28 28 56-64" stroke="#d4af37" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12%" cy="18%" fill="#f0d78c" opacity="0.55" r="1.4" />
        <circle cx="28%" cy="11%" fill="#d4af37" opacity="0.4" r="2" />
        <circle cx="46%" cy="22%" fill="#fff6d6" opacity="0.35" r="1" />
        <circle cx="71%" cy="14%" fill="#e8c547" opacity="0.5" r="2.2" />
        <circle cx="88%" cy="24%" fill="#c9a227" opacity="0.45" r="1.5" />
        <circle cx="93%" cy="48%" fill="#f0d78c" opacity="0.28" r="2" />
        <circle cx="7%" cy="64%" fill="#fff6d6" opacity="0.22" r="1.4" />
        <circle cx="21%" cy="78%" fill="#d4af37" opacity="0.4" r="2.2" />
        <circle cx="58%" cy="70%" fill="#e8c547" opacity="0.35" r="1" />
        <circle cx="81%" cy="86%" fill="#c9a227" opacity="0.4" r="1.8" />
        <circle cx="37%" cy="90%" fill="#f0d78c" opacity="0.3" r="1.4" />
      </svg>
    </div>
  );
}
