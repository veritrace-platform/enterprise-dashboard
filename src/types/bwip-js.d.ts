declare module "bwip-js" {
  export interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: "left" | "center" | "right";
  }

  export function toCanvas(
    canvas: HTMLCanvasElement,
    options: RenderOptions,
  ): HTMLCanvasElement;

  const bwipjs: {
    toCanvas: typeof toCanvas;
  };

  export default bwipjs;
}

