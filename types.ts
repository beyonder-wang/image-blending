export interface ImageSource {
  id: string;
  name: string;
  url: string;
  blob?: Blob;
}

export interface ProcessingConfig {
  levels: number; // Depth of pyramid
}

export interface PyramidLevel {
  level: number;
  canvas: HTMLCanvasElement;
  type: 'gaussian' | 'laplacian' | 'reconstructed';
}

export type ProcessingStatus = 'idle' | 'processing' | 'done' | 'error';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
