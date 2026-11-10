/**
 * Dibujos de etapa del árbol tomados literalmente de v58 (app.js · stageGlyph).
 * Se usan en el mini árbol del panel derecho y en la pista de etapas.
 */
const DRAWINGS: string[] = [
  "<ellipse cx=\"21\" cy=\"24\" rx=\"8\" ry=\"5\" transform=\"rotate(-24 21 24)\" style=\"fill:#c9864b;stroke:#704426;stroke-width:2.3\"/><path d=\"M16 22c3-2 7-3 11-2\" style=\"fill:none;stroke:#efb472;stroke-width:1.8;stroke-linecap:round\"/>",
  "<path d=\"M21 34V19\" style=\"fill:none;stroke:#4b9f64;stroke-width:3;stroke-linecap:round\"/><path d=\"M21 25c-8 0-10-7-10-7 7-1 10 2 10 7Zm0 2c8 0 10-8 10-8-7-1-10 3-10 8Z\" style=\"fill:#75c978;stroke:#2d7548;stroke-width:2\"/>",
  "<path d=\"M20 35c0-9 6-14 3-25\" style=\"fill:none;stroke:#9a5b35;stroke-width:4;stroke-linecap:round\"/><path d=\"M22 18c-8 0-10-7-10-7 7-1 10 2 10 7Zm1 5c8 0 10-8 10-8-7-1-10 3-10 8Z\" style=\"fill:#6fc778;stroke:#2b7447;stroke-width:2\"/>",
  "<path d=\"M14 35h16l-2 5H16Z\" style=\"fill:#7552df;stroke:#3e287d;stroke-width:1.8\"/><path d=\"M20 34c3-8 1-15 4-23 6 7 1 15 5 23Z\" style=\"fill:#a8653e;stroke:#603921;stroke-width:2\"/><path d=\"M23 18c2-4 4-6 7-8\" style=\"fill:none;stroke:#a8653e;stroke-width:2.6;stroke-linecap:round\"/>",
  "<path d=\"M21 36V16m0 8-10-8m10 13 11-10m-11 4 4-12\" style=\"fill:none;stroke:#8b5535;stroke-width:3.8;stroke-linecap:round;stroke-linejoin:round\"/><circle cx=\"11\" cy=\"16\" r=\"3\" style=\"fill:#70c878;stroke:#2d7548;stroke-width:1.5\"/><circle cx=\"32\" cy=\"19\" r=\"3\" style=\"fill:#70c878;stroke:#2d7548;stroke-width:1.5\"/><circle cx=\"25\" cy=\"11\" r=\"3\" style=\"fill:#70c878;stroke:#2d7548;stroke-width:1.5\"/>",
  "<path d=\"M21 37V24m0 3-9-7m9 10 10-8\" style=\"fill:none;stroke:#895334;stroke-width:3;stroke-linecap:round\"/><g style=\"fill:#55b875;stroke:#287049;stroke-width:1.5\"><circle cx=\"11\" cy=\"17\" r=\"7\"/><circle cx=\"22\" cy=\"13\" r=\"8\"/><circle cx=\"32\" cy=\"19\" r=\"7\"/><circle cx=\"18\" cy=\"25\" r=\"8\"/><circle cx=\"29\" cy=\"27\" r=\"7\"/></g>",
  "<path d=\"M21 37V24m0 3-9-7m9 10 10-8\" style=\"fill:none;stroke:#895334;stroke-width:3;stroke-linecap:round\"/><g style=\"fill:#55b875;stroke:#287049;stroke-width:1.5\"><circle cx=\"11\" cy=\"17\" r=\"7\"/><circle cx=\"22\" cy=\"13\" r=\"8\"/><circle cx=\"32\" cy=\"19\" r=\"7\"/><circle cx=\"18\" cy=\"25\" r=\"8\"/><circle cx=\"29\" cy=\"27\" r=\"7\"/></g><g style=\"fill:#fff5d5;stroke:#c48a2c;stroke-width:1\"><circle cx=\"13\" cy=\"14\" r=\"3.2\"/><circle cx=\"27\" cy=\"12\" r=\"3.2\"/><circle cx=\"30\" cy=\"25\" r=\"3.2\"/></g><g style=\"fill:#eaa83b\"><circle cx=\"13\" cy=\"14\" r=\"1.1\"/><circle cx=\"27\" cy=\"12\" r=\"1.1\"/><circle cx=\"30\" cy=\"25\" r=\"1.1\"/></g>",
  "<path d=\"M21 37V24m0 3-9-7m9 10 10-8\" style=\"fill:none;stroke:#895334;stroke-width:3;stroke-linecap:round\"/><g style=\"fill:#55b875;stroke:#287049;stroke-width:1.5\"><circle cx=\"11\" cy=\"17\" r=\"7\"/><circle cx=\"22\" cy=\"13\" r=\"8\"/><circle cx=\"32\" cy=\"19\" r=\"7\"/><circle cx=\"18\" cy=\"25\" r=\"8\"/><circle cx=\"29\" cy=\"27\" r=\"7\"/></g><g style=\"fill:#f5a239;stroke:#914f21;stroke-width:1.3\"><circle cx=\"13\" cy=\"23\" r=\"4\"/><circle cx=\"30\" cy=\"27\" r=\"4\"/><circle cx=\"25\" cy=\"12\" r=\"3.7\"/></g>"
];

export default function StageGlyph({ stage, className = '' }: { stage: number; className?: string }) {
  const index = Math.max(0, Math.min(DRAWINGS.length - 1, Math.round(stage)));
  return (
    <svg
      className={className ? `stage-glyph ${className}` : 'stage-glyph'}
      viewBox="0 0 42 42"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: DRAWINGS[index] }}
    />
  );
}
