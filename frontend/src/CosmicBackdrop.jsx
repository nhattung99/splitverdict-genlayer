export default function CosmicBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none -z-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-secondary-container/15 rounded-full blur-[140px]" />
      <div className="absolute top-32 left-1/4 w-[480px] h-[480px] bg-primary-container/10 rounded-full blur-[120px]" />
      <div className="absolute top-96 right-1/4 w-[600px] h-[500px] bg-secondary/10 rounded-full blur-[130px]" />
      <svg className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12%" cy="18%" fill="#00f0ff" opacity="0.8" r="1.5" />
        <circle cx="28%" cy="12%" fill="#e0b6ff" opacity="0.6" r="2" />
        <circle cx="45%" cy="24%" fill="#fff" opacity="0.9" r="1" />
        <circle cx="72%" cy="14%" fill="#00f0ff" opacity="0.7" r="2.5" />
        <circle cx="88%" cy="22%" fill="#34f885" opacity="0.75" r="1.5" />
        <circle cx="94%" cy="45%" fill="#e0b6ff" opacity="0.5" r="2" />
        <circle cx="6%" cy="62%" fill="#fff" opacity="0.4" r="1.5" />
        <circle cx="22%" cy="75%" fill="#00f0ff" opacity="0.8" r="2.5" />
        <circle cx="58%" cy="68%" fill="#34f885" opacity="0.9" r="1" />
        <circle cx="82%" cy="84%" fill="#e0b6ff" opacity="0.7" r="2" />
        <circle cx="36%" cy="88%" fill="#dbfcff" opacity="0.6" r="1.5" />
      </svg>
    </div>
  );
}
