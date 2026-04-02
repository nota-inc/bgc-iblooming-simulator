"use client";

import { useEffect, useRef } from "react";
import type { ECharts } from "echarts";

type RadarDimension = {
  name: string;
  max: number;
};

type RadarSeries = {
  name: string;
  values: number[];
  color: string;
};

type CompareRadarChartProps = {
  dimensions: RadarDimension[];
  series: RadarSeries[];
};

const SERIES_COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#A855F7"];

export function CompareRadarChart({ dimensions, series }: CompareRadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    let disposed = false;

    async function init() {
      const echarts = await import("echarts");
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.dispose();
      }

      const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;

      chart.setOption({
        tooltip: {
          trigger: "item",
          backgroundColor: "#1E293B",
          borderColor: "#334155",
          textStyle: { color: "#F8FAFC", fontSize: 13 },
        },
        legend: {
          bottom: 10,
          textStyle: { color: "#94A3B8", fontSize: 12 },
          itemWidth: 14,
          itemHeight: 14,
          itemGap: 20,
        },
        radar: {
          indicator: dimensions.map((d) => ({ name: d.name, max: d.max })),
          shape: "polygon",
          splitNumber: 4,
          axisName: {
            color: "#94A3B8",
            fontSize: 12,
          },
          splitLine: {
            lineStyle: { color: "#334155" },
          },
          splitArea: {
            show: true,
            areaStyle: {
              color: ["rgba(30,41,59,0.3)", "rgba(30,41,59,0.5)"],
            },
          },
          axisLine: {
            lineStyle: { color: "#334155" },
          },
        },
        series: [
          {
            type: "radar",
            data: series.map((s, i) => ({
              name: s.name,
              value: s.values,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: {
                width: 2,
                color: s.color || SERIES_COLORS[i % SERIES_COLORS.length],
              },
              itemStyle: {
                color: s.color || SERIES_COLORS[i % SERIES_COLORS.length],
              },
              areaStyle: {
                color: (s.color || SERIES_COLORS[i % SERIES_COLORS.length]) + "20",
              },
            })),
          },
        ],
      });

      const resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }

    init();

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [dimensions, series]);

  return <div ref={containerRef} className="chart-container" style={{ minHeight: "360px" }} />;
}
