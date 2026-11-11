
window.ImageProcessor = (() => {
  async function prepareVariants(file) {
    const bitmap = await createImageBitmap(file);

    const maxSide = 4000;
    const scale = Math.min(
      1,
      maxSide / Math.max(bitmap.width, bitmap.height)
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    function createCanvas() {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    // 1. Original
    const original = createCanvas();
    const originalCtx = original.getContext("2d", {
      willReadFrequently: true
    });

    originalCtx.drawImage(bitmap, 0, 0, width, height);

    // 2. Enhanced
    const enhanced = createCanvas();
    const enhancedCtx = enhanced.getContext("2d", {
      willReadFrequently: true
    });

    enhancedCtx.drawImage(bitmap, 0, 0, width, height);

    const frame = enhancedCtx.getImageData(
      0, 0, width, height
    );

    const pixels = frame.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const gray =
        0.299 * pixels[i] +
        0.587 * pixels[i + 1] +
        0.114 * pixels[i + 2];

      const contrast = Math.max(
        0,
        Math.min(255, (gray - 128) * 1.18 + 128)
      );

      pixels[i] = contrast;
      pixels[i + 1] = contrast;
      pixels[i + 2] = contrast;
    }

    enhancedCtx.putImageData(frame, 0, 0);

    bitmap.close?.();

    return {
      original,
      enhanced,
      width,
      height
    };
  }

  return {
    prepareVariants
  };
})();
