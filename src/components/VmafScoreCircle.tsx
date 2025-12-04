interface VmafScoreCircleProps {
  score: number;
}

function VmafScoreCircle({ score }: VmafScoreCircleProps) {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 95) return '#4ade80'; // green-400
    if (score >= 70) return '#facc15'; // yellow-400
    if (score >= 55) return '#fb923c'; // orange-400
    return '#f87171'; // red-400
  };

  const color = getColor(score);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  // Calculate the length of each zone as a percentage of the circumference
  // Red: 0-54.9 (55%)
  // Orange: 55-69.9 (15%)
  // Yellow: 70-94.9 (25%)
  // Green: 95-100 (5%)
  const redZoneLength = (55 / 100) * circumference;
  const orangeZoneLength = (15 / 100) * circumference;
  const yellowZoneLength = (25 / 100) * circumference;
  const greenZoneLength = (5 / 100) * circumference;

  // Calculate how much of each zone should be lit up based on score
  const redFilled = Math.min(score, 55);
  const orangeFilled = Math.max(0, Math.min(score - 55, 15));
  const yellowFilled = Math.max(0, Math.min(score - 70, 25));
  const greenFilled = Math.max(0, Math.min(score - 95, 5));

  const redFilledLength = (redFilled / 100) * circumference;
  const orangeFilledLength = (orangeFilled / 100) * circumference;
  const yellowFilledLength = (yellowFilled / 100) * circumference;
  const greenFilledLength = (greenFilled / 100) * circumference;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute transform -rotate-90" width="120" height="120" viewBox="0 0 120 120">
        {/* Red zone (0-54.9) - dimmed */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(248, 113, 113, 0.25)"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${redZoneLength} ${circumference - redZoneLength}`}
          strokeDashoffset="0"
        />
        {/* Orange zone (55-69.9) - dimmed */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(251, 146, 60, 0.25)"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${orangeZoneLength} ${circumference - orangeZoneLength}`}
          strokeDashoffset={-redZoneLength}
        />
        {/* Yellow zone (70-94.9) - dimmed */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(250, 204, 21, 0.25)"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${yellowZoneLength} ${circumference - yellowZoneLength}`}
          strokeDashoffset={-(redZoneLength + orangeZoneLength)}
        />
        {/* Green zone (95-100) - dimmed */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="rgba(74, 222, 128, 0.25)"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${greenZoneLength} ${circumference - greenZoneLength}`}
          strokeDashoffset={-(redZoneLength + orangeZoneLength + yellowZoneLength)}
        />

        {/* Bright filled sections */}
        {/* Red zone filled - bright */}
        {redFilled > 0 && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#f87171"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${redFilledLength} ${circumference - redFilledLength}`}
            strokeDashoffset="0"
          />
        )}
        {/* Orange zone filled - bright */}
        {orangeFilled > 0 && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#fb923c"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${orangeFilledLength} ${circumference - orangeFilledLength}`}
            strokeDashoffset={-redZoneLength}
          />
        )}
        {/* Yellow zone filled - bright */}
        {yellowFilled > 0 && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#facc15"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${yellowFilledLength} ${circumference - yellowFilledLength}`}
            strokeDashoffset={-(redZoneLength + orangeZoneLength)}
          />
        )}
        {/* Green zone filled - bright */}
        {greenFilled > 0 && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#4ade80"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${greenFilledLength} ${circumference - greenFilledLength}`}
            strokeDashoffset={-(redZoneLength + orangeZoneLength + yellowZoneLength)}
          />
        )}
      </svg>
      {/* Score text */}
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-gray-400">VMAF</span>
      </div>
    </div>
  );
}

export default VmafScoreCircle;
