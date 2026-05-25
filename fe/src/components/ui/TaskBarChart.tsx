import React from 'react';
import { Svg, Rect, Path, Text as SvgText } from 'react-native-svg';

export interface ChartDataset {
  label: string;
  color: string;
  data: number[];
}

interface Props {
  labels: string[];
  datasets: ChartDataset[];
  width: number;   // passed by parent via onLayout
  height?: number;
}

export function TaskBarChart({ labels, datasets, width, height = 180 }: Props) {
  const PL = 28; // left — y-axis labels
  const PR = 8;  // right
  const PT = 16; // top — space for value labels above bars
  const PB = 22; // bottom — x-axis labels

  const drawW = width - PL - PR;
  const drawH = height - PT - PB;
  const n = labels.length;
  const S = datasets.length;

  const allVals = datasets.flatMap((d) => d.data);
  const rawMax = Math.max(...allVals, 1);
  // Round up to nearest readable tick
  const niceMax = rawMax <= 5 ? rawMax : Math.ceil(rawMax / 5) * 5;

  const groupW = drawW / n;
  const outerPad = groupW * 0.12;
  const gapBetweenBars = 0;
  const barW = Math.max(4, (groupW - outerPad * 2) / S);

  const toBarY = (v: number) => drawH * (1 - v / niceMax);
  const toBarH = (v: number) => Math.max(0, drawH * (v / niceMax));

  const yTicks = [niceMax, Math.round(niceMax / 2), 0];
  const isCompact = n >= 10; // year view — skip value labels

  return (
    <Svg width={width} height={height}>
      {/* Horizontal guide lines + Y-axis labels */}
      {yTicks.map((v, i) => {
        const y = PT + toBarY(v);
        return (
          <React.Fragment key={i}>
            <Path
              d={`M ${PL} ${y} L ${width - PR} ${y}`}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : '3,3'}
            />
            <SvgText x={PL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {v}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Bar groups */}
      {labels.map((label, gi) => {
        const groupX = PL + gi * groupW + outerPad;
        const centerX = PL + gi * groupW + groupW / 2;

        return (
          <React.Fragment key={gi}>
            {datasets.map((ds, si) => {
              const val = ds.data[gi] ?? 0;
              const bX = groupX + si * (barW + gapBetweenBars);
              const bH = toBarH(val);
              const bY = PT + toBarY(val);

              return (
                <React.Fragment key={si}>
                  <Rect
                    x={bX}
                    y={val > 0 ? bY : PT + drawH}
                    width={barW}
                    height={val > 0 ? Math.max(bH, 2) : 0}
                    fill={ds.color}
                    rx={2}
                    ry={2}
                    opacity={0.9}
                  />
                  {/* Value label — skip for compact (year) or zero values */}
                  {!isCompact && val > 0 && (
                    <SvgText
                      x={bX + barW / 2}
                      y={bY - 3}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="700"
                      fill={ds.color}
                    >
                      {val}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

            {/* X-axis label */}
            <SvgText
              x={centerX}
              y={height - 5}
              textAnchor="middle"
              fontSize={isCompact ? 8 : 9}
              fill="#6b7280"
            >
              {label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
