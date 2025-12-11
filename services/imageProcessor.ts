import { PyramidLevel } from '../types';

/**
 * Service to handle client-side image processing using Canvas API.
 * Implements Gaussian and Laplacian Pyramid generation and reconstruction.
 */

// Helper to create a canvas from an image URL
export const limitDimension = 512; // Max size for performance

export const loadImageToCanvas = (url: string): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Resize to keep performance high
      let width = img.width;
      let height = img.height;
      
      if (width > limitDimension || height > limitDimension) {
        const ratio = Math.min(limitDimension / width, limitDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Ensure dimensions are even for easy downsampling
      width = width % 2 === 1 ? width - 1 : width;
      height = height % 2 === 1 ? height - 1 : height;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export const createGradientMask = (width: number, height: number, type: 'horizontal' | 'vertical' | 'radial' = 'horizontal'): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  let gradient;
  if (type === 'horizontal') {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0.45, 'black');
    gradient.addColorStop(0.55, 'white');
  } else if (type === 'vertical') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0.45, 'black');
    gradient.addColorStop(0.55, 'white');
  } else {
    gradient = ctx.createRadialGradient(width/2, height/2, width/8, width/2, height/2, width/1.5);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'black');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
};

// Perform a Gaussian blur and downsample (Reduce)
const downsample = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const w = canvas.width;
  const h = canvas.height;
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = halfW;
  outCanvas.height = halfH;
  const ctx = outCanvas.getContext('2d')!;
  
  // High quality downscaling (browser implementation is usually bi-linear or bicubic)
  // For true Gaussian pyramid, we should blur first.
  ctx.filter = 'blur(2px)'; 
  ctx.drawImage(canvas, 0, 0, halfW, halfH);
  ctx.filter = 'none'; // reset
  
  return outCanvas;
};

// Upsample (Expand)
const upsample = (canvas: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement => {
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const ctx = outCanvas.getContext('2d')!;
  
  // Upscale
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  
  // Post-blur to smooth artifacts (essential for reconstruction)
  // In a rigorous mathematical implementation, we'd use a specific 5x5 kernel.
  // CSS filter blur is a good approximation for a visual demo.
  // We apply the blur to the data itself.
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = targetW;
  blurCanvas.height = targetH;
  const bCtx = blurCanvas.getContext('2d')!;
  bCtx.filter = 'blur(2px)';
  bCtx.drawImage(outCanvas, 0, 0);
  
  return blurCanvas;
};

// Subtract two images: A - B
const subtractImages = (canvA: HTMLCanvasElement, canvB: HTMLCanvasElement): HTMLCanvasElement => {
  const w = canvA.width;
  const h = canvA.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  
  const imgDataA = canvA.getContext('2d')!.getImageData(0,0,w,h);
  const imgDataB = canvB.getContext('2d')!.getImageData(0,0,w,h);
  const res = ctx.createImageData(w, h);
  
  for (let i = 0; i < imgDataA.data.length; i += 4) {
    // Shift values by +128 to visualize negative frequencies in standard RGB
    // Real math keeps them as floats, but for 8-bit display we offset.
    // However, for RECONSTRUCTION to work, we need to handle the math precisely.
    // We will just return the raw difference here, but for display we might need handling.
    // Wait, simple ImageData is clamped 0-255. We CANNOT store negatives in ImageData.
    // We need Float32Arrays for the algorithm to work correctly.
    // But for this React demo, we'll try to stick to "Visual" approximation or use a Float buffer if needed.
    
    // TRICK: We will not perform the subtraction on the pixel data for storage if we can't store negatives.
    // Instead, we will store the 'difference' relative to 128 (gray) for visualization?
    // No, reconstruction won't work.
    
    // Solution: We must do the full float processing.
  }
  return out; 
};

// --- Float32 Processing Class ---
// To do this correctly, we need to work with Float buffers, not just Canvas elements.

class FloatImage {
  width: number;
  height: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.r = new Float32Array(w * h);
    this.g = new Float32Array(w * h);
    this.b = new Float32Array(w * h);
  }

  static fromCanvas(canvas: HTMLCanvasElement): FloatImage {
    const ctx = canvas.getContext('2d')!;
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const img = new FloatImage(canvas.width, canvas.height);
    for (let i = 0; i < id.data.length / 4; i++) {
      img.r[i] = id.data[i * 4];
      img.g[i] = id.data[i * 4 + 1];
      img.b[i] = id.data[i * 4 + 2];
    }
    return img;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;
    const id = ctx.createImageData(this.width, this.height);
    for (let i = 0; i < this.width * this.height; i++) {
      id.data[i * 4] = Math.min(255, Math.max(0, this.r[i]));
      id.data[i * 4 + 1] = Math.min(255, Math.max(0, this.g[i]));
      id.data[i * 4 + 2] = Math.min(255, Math.max(0, this.b[i]));
      id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
  }
  
  // Visualizes Laplacian (gray = 0)
  toVisualCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;
    const id = ctx.createImageData(this.width, this.height);
    for (let i = 0; i < this.width * this.height; i++) {
      // Offset by 128
      id.data[i * 4] = Math.min(255, Math.max(0, this.r[i] + 128));
      id.data[i * 4 + 1] = Math.min(255, Math.max(0, this.g[i] + 128));
      id.data[i * 4 + 2] = Math.min(255, Math.max(0, this.b[i] + 128));
      id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
  }
}

// Convolution Helper
function convolve(img: FloatImage, kernel: number[]): FloatImage {
    // Simplified: separable or just box blur approx for demo speed?
    // Let's do a simple multipass box blur to approximate Gaussian.
    // Actually, let's just use the Canvas API for blur/resize logic but map to/from FloatImage.
    // It's much faster in JS to rely on browser's native C++ canvas rasterization for blur.
    
    // Map Float -> Canvas -> Blur -> Float
    const c = img.toCanvas();
    const ctx = c.getContext('2d')!;
    
    // Hack: We need to handle edges.
    const temp = document.createElement('canvas');
    temp.width = img.width;
    temp.height = img.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.filter = 'blur(2px)'; // Approximate Gaussian
    tCtx.drawImage(c, 0, 0);
    
    return FloatImage.fromCanvas(temp);
}

function downsampleFloat(img: FloatImage): FloatImage {
    const c = img.toCanvas();
    const w = Math.floor(c.width / 2);
    const h = Math.floor(c.height / 2);
    if(w === 0 || h === 0) return img; // safety

    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const ctx = small.getContext('2d')!;
    
    ctx.filter = 'blur(2px)'; // Blur before downsampling
    ctx.drawImage(c, 0, 0, w, h);
    
    return FloatImage.fromCanvas(small);
}

function upsampleFloat(img: FloatImage, targetW: number, targetH: number): FloatImage {
    const c = img.toCanvas();
    const large = document.createElement('canvas');
    large.width = targetW;
    large.height = targetH;
    const ctx = large.getContext('2d')!;
    
    ctx.drawImage(c, 0, 0, targetW, targetH);
    
    // Blur after upsampling (interpolation)
    const blurred = document.createElement('canvas');
    blurred.width = targetW;
    blurred.height = targetH;
    const bCtx = blurred.getContext('2d')!;
    bCtx.filter = 'blur(2px)'; 
    bCtx.drawImage(large, 0, 0);
    
    return FloatImage.fromCanvas(blurred);
}

// Core Math
export const processPyramidBlending = async (
  canvasA: HTMLCanvasElement, 
  canvasB: HTMLCanvasElement, 
  canvasMask: HTMLCanvasElement, 
  levels: number
) => {
  const GA: FloatImage[] = [];
  const GB: FloatImage[] = [];
  const GM: FloatImage[] = [];
  
  let currA = FloatImage.fromCanvas(canvasA);
  let currB = FloatImage.fromCanvas(canvasB);
  let currM = FloatImage.fromCanvas(canvasMask); // Mask should be 0-255 (black/white)
  
  // 1. Build Gaussian Pyramids
  GA.push(currA);
  GB.push(currB);
  GM.push(currM);
  
  for (let i = 0; i < levels; i++) {
    currA = downsampleFloat(currA);
    currB = downsampleFloat(currB);
    currM = downsampleFloat(currM);
    GA.push(currA);
    GB.push(currB);
    GM.push(currM);
  }
  
  // 2. Build Laplacian Pyramids
  const LA: FloatImage[] = [];
  const LB: FloatImage[] = [];
  
  for (let i = 0; i < levels; i++) {
    const nextA_up = upsampleFloat(GA[i+1], GA[i].width, GA[i].height);
    const nextB_up = upsampleFloat(GB[i+1], GB[i].width, GB[i].height);
    
    const lapA = new FloatImage(GA[i].width, GA[i].height);
    const lapB = new FloatImage(GB[i].width, GB[i].height);
    
    for (let p = 0; p < lapA.r.length; p++) {
      lapA.r[p] = GA[i].r[p] - nextA_up.r[p];
      lapA.g[p] = GA[i].g[p] - nextA_up.g[p];
      lapA.b[p] = GA[i].b[p] - nextA_up.b[p];
      
      lapB.r[p] = GB[i].r[p] - nextB_up.r[p];
      lapB.g[p] = GB[i].g[p] - nextB_up.g[p];
      lapB.b[p] = GB[i].b[p] - nextB_up.b[p];
    }
    LA.push(lapA);
    LB.push(lapB);
  }
  // The top of the pyramid is the same as Gaussian
  LA.push(GA[levels]);
  LB.push(GB[levels]);
  
  // 3. Blend Laplacians
  const L_Out: FloatImage[] = [];
  for (let i = 0; i <= levels; i++) {
    const out = new FloatImage(LA[i].width, LA[i].height);
    const mask = GM[i]; // Corresponding Gaussian Mask level
    
    for (let p = 0; p < out.r.length; p++) {
      const alpha = mask.r[p] / 255.0; // Normalize mask 0-1
      out.r[p] = LA[i].r[p] * alpha + LB[i].r[p] * (1 - alpha);
      out.g[p] = LA[i].g[p] * alpha + LB[i].g[p] * (1 - alpha);
      out.b[p] = LA[i].b[p] * alpha + LB[i].b[p] * (1 - alpha);
    }
    L_Out.push(out);
  }
  
  // 4. Reconstruct
  let currentImg = L_Out[levels];
  for (let i = levels - 1; i >= 0; i--) {
    const up = upsampleFloat(currentImg, L_Out[i].width, L_Out[i].height);
    const blended = new FloatImage(L_Out[i].width, L_Out[i].height);
    
    for (let p = 0; p < blended.r.length; p++) {
      blended.r[p] = L_Out[i].r[p] + up.r[p];
      blended.g[p] = L_Out[i].g[p] + up.g[p];
      blended.b[p] = L_Out[i].b[p] + up.b[p];
    }
    currentImg = blended;
  }
  
  return {
    result: currentImg.toCanvas(),
    laplacians: L_Out.map(l => l.toVisualCanvas()),
    gaussiansA: GA.map(g => g.toCanvas()),
    gaussiansB: GB.map(g => g.toCanvas()),
  };
};