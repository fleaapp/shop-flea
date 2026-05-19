import { useIsMobile } from "@/hooks/use-mobile";

const ScallopEdge = ({
  fillColor,
  bgColor,
  showTopLine = true,
}: {
  fillColor: string;
  bgColor: string;
  showTopLine?: boolean;
}) => {
  const isMobile = useIsMobile();
  const scallopCount = isMobile ? 9 : 13;
  const viewBoxWidth = scallopCount * 2;
  const seamOverscan = showTopLine ? 0 : 0.08;
  const svgBleedPx = showTopLine ? 0 : 2;

  return (
    <div
      aria-hidden="true"
      className="relative -mt-px w-full overflow-hidden leading-[0]"
      style={{ backgroundColor: bgColor, aspectRatio: `${viewBoxWidth} / 1` }}
    >
      <svg
        className="relative block w-full"
        style={{
          top: svgBleedPx ? `-${svgBleedPx}px` : undefined,
          height: svgBleedPx ? `calc(100% + ${svgBleedPx}px)` : "100%",
        }}
        viewBox={`0 0 ${viewBoxWidth} 1`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {showTopLine ? <rect x="0" y="0" width={viewBoxWidth} height="0.08" fill={fillColor} /> : null}
        {Array.from({ length: scallopCount }).map((_, index) => (
          <circle
            key={index}
            cx={index * 2 + 1}
            cy={-seamOverscan}
            r={1 + seamOverscan}
            fill={fillColor}
          />
        ))}
      </svg>
    </div>
  );
};

export default ScallopEdge;
