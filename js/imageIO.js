(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  function loadImageData(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Nie udało się wczytać pliku jako obrazu.'));
      };

      img.src = url;
    });
  }

  function drawImageData(canvas, imageData) {
    if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
    }
    canvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  function saveCanvasAsPng(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  function saveImageDataAsPng(imageData, filename) {
    const canvas = document.createElement('canvas');
    drawImageData(canvas, imageData);
    saveCanvasAsPng(canvas, filename);
  }

  function createBlankImage(width, height) {
    const imageData = new ImageData(width, height);
    imageData.data.fill(255);
    return imageData;
  }

  BioEditor.ImageIO = { loadImageData, drawImageData, saveCanvasAsPng, saveImageDataAsPng, createBlankImage };
})(window);
