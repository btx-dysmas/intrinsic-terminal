"use client";
import { useEffect, useMemo, useRef } from "react";
import { DARK_MAP, type Fig } from "@/lib/charts";
import { useTheme } from "./Theme";

let plotlyP: Promise<any> | null = null;
export const loadPlotly = () => (plotlyP ??= import("plotly.js-dist-min").then((m: any) => m.default ?? m));

const CONFIG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "zoomIn2d", "zoomOut2d", "pan2d", "zoom2d"] };
const DARK_RE = new RegExp(Object.keys(DARK_MAP).join("|"), "gi");

/** Swap every light-palette color in a figure for its dark-mode equivalent (8-digit hex keeps its alpha suffix). */
export function themed(fig: Fig, dark: boolean): Fig {
  if (!dark) return fig;
  return JSON.parse(JSON.stringify(fig).replace(DARK_RE, (m) => DARK_MAP[m.toUpperCase()] ?? m));
}

/** Renders a Plotly figure in the current theme; re-renders in place when the figure or theme changes. */
export default function Plot({ fig, height = 280 }: { fig: Fig | null; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { dark } = useTheme();
  const f = useMemo(() => (fig ? themed(fig, dark) : null), [fig, dark]);
  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!f || !el) return;
    loadPlotly().then((P) => {
      if (alive) P.react(el, f.data, { ...f.layout, height, autosize: true }, CONFIG);
    });
    return () => {
      alive = false;
    };
  }, [f, height]);
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el && plotlyP) plotlyP.then((P) => P.purge(el));
    };
  }, []);
  return <div ref={ref} style={{ height, width: "100%" }} />;
}

/** Render a figure off screen to a JPEG data URL for the PDF (always in the light palette). */
export async function figImage(fig: Fig, width: number, height: number) {
  const P = await loadPlotly();
  return P.toImage({ data: fig.data, layout: { ...fig.layout, width, height, autosize: false } }, { format: "jpeg", width, height, scale: 2 });
}
