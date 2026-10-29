/**
 * imageIO.js – wczytywanie, wyświetlanie i zapisywanie obrazu.
 *
 * Używamy WYŁĄCZNIE mechanizmów przeglądarki dozwolonych w zadaniu:
 *   <input type="file">, Canvas, getImageData/putImageData, canvas.toBlob.
 *
 * Wzorzec modułu: IIFE + wspólna przestrzeń nazw window.BioEditor.
 * Dzięki temu działa z file:// i nie koliduje z kodem drugiej osoby w projekcie.
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /**
   * Wczytuje plik obrazu i zwraca jego piksele jako ImageData.
   *
   * Jak to działa:
   *  1. URL.createObjectURL(file) tworzy tymczasowy adres blob: do pliku z dysku.
   *  2. Ładujemy go do <img> (przeglądarka dekoduje PNG/JPG/... za nas).
   *  3. Rysujemy <img> na niewidocznym canvasie i odczytujemy bufor pikseli
   *     przez getImageData. To jedyny moment, w którym używamy Canvas API
   *     do odczytu – dalej pracujemy już na samej tablicy pikseli.
   *
   * @param {File} file
   * @returns {Promise<ImageData>}
   */
  function loadImageData(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        // willReadFrequently: podpowiedź dla przeglądarki, że będziemy czytać piksele
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url); // zwalniamy pamięć po tymczasowym adresie
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Nie udało się wczytać pliku jako obrazu.'));
      };

      img.src = url;
    });
  }

  /**
   * Wyświetla ImageData na canvasie (dopasowuje rozmiar canvasu do obrazu).
   * putImageData wpisuje bufor pikseli bezpośrednio, bez skalowania.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {ImageData} imageData
   */
  function drawImageData(canvas, imageData) {
    if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
      canvas.width = imageData.width;   // zmiana rozmiaru czyści canvas
      canvas.height = imageData.height;
    }
    canvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  /**
   * Zapisuje zawartość canvasu jako plik PNG (pobranie przez przeglądarkę).
   *
   * canvas.toBlob koduje obraz do PNG asynchronicznie i zwraca obiekt Blob.
   * Potem tworzymy niewidoczny link <a download> i "klikamy" go programowo.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} filename
   */
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

  /**
   * Zapisuje ImageData jako PNG. Obraz trafia na pomocniczy (niewidoczny)
   * canvas – dzięki temu zapisujemy dokładnie ten bufor, a nie to, co jest
   * akurat na ekranie (np. bez uchwytów zaznaczenia).
   *
   * @param {ImageData} imageData
   * @param {string} filename
   */
  function saveImageDataAsPng(imageData, filename) {
    const canvas = document.createElement('canvas');
    drawImageData(canvas, imageData);
    saveCanvasAsPng(canvas, filename);
  }

  /**
   * Tworzy pusty, biały obraz – do rysowania bez wczytywania pliku.
   * new ImageData(w, h) ma wszystkie bajty = 0 (przezroczysta czerń),
   * więc wypełniamy cały bufor wartością 255 (biały, nieprzezroczysty).
   *
   * @param {number} width
   * @param {number} height
   * @returns {ImageData}
   */
  function createBlankImage(width, height) {
    const imageData = new ImageData(width, height);
    imageData.data.fill(255);
    return imageData;
  }

  BioEditor.ImageIO = { loadImageData, drawImageData, saveCanvasAsPng, saveImageDataAsPng, createBlankImage };
})(window);
