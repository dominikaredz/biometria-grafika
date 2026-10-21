/**
 * imageProcessing.js – algorytmy przetwarzania obrazu.
 *
 * Zasady:
 *  - zero zależności od DOM i Canvas: funkcje przyjmują i zwracają ImageData,
 *    więc łatwo je przenieść do innego projektu lub przetestować w Node,
 *  - funkcje są "czyste": NIE modyfikują obrazu wejściowego, zwracają nowy
 *    (dzięki temu działa Cofnij / Przywróć oryginał i łatwo łączyć operacje),
 *  - praca na Uint8ClampedArray, jedna pętla po buforze.
 *
 * Układ bufora ImageData.data: [R, G, B, A, R, G, B, A, ...]
 * czyli piksel nr p zaczyna się pod indeksem i = p * 4.
 * Uint8ClampedArray "przycina" wartości do 0–255 (nie zawija ich jak Uint8Array).
 */
(function (global) {
  'use strict';

  const BioEditor = (global.BioEditor = global.BioEditor || {});

  /** Przesunięcie kanału w obrębie piksela; -1 oznacza "średnia z kanałów". */
  const CHANNEL_OFFSET = { r: 0, g: 1, b: 2, avg: -1 };

  /**
   * Binaryzacja progowa.
   *
   * Algorytm: dla każdego piksela bierzemy jedną wartość v (0–255):
   *   - kanał R, G lub B  -> v = wartość tego kanału,
   *   - średnia           -> v = floor((R + G + B) / 3),
   * a następnie:
   *   wynik = 255 (biały)  gdy v >= próg,
   *   wynik = 0   (czarny) w przeciwnym razie.
   * Wynik zapisujemy we wszystkich trzech kanałach (obraz czarno-biały).
   * Kanał alfa przepisujemy bez zmian.
   *
   * Optymalizacja: zamiast porównywać z progiem w każdym pikselu, budujemy
   * tablicę LUT (look-up table) o 256 elementach: lut[v] -> 0 lub 255.
   * W pętli zostaje jedno odczytanie z tablicy.
   *
   * @param {ImageData} src
   * @param {{channel: 'r'|'g'|'b'|'avg', threshold: number}} options
   * @returns {ImageData} nowy obraz
   */
  function binarize(src, { channel, threshold }) {
    const offset = CHANNEL_OFFSET[channel];
    if (offset === undefined) throw new Error('Nieznany kanał: ' + channel);

    // LUT: dla każdej możliwej wartości 0..255 od razu znamy wynik
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = v >= threshold ? 255 : 0;

    const s = src.data;
    const out = new Uint8ClampedArray(s.length);

    for (let i = 0; i < s.length; i += 4) {
      // offset >= 0: pojedynczy kanał, inaczej średnia (|0 = zaokrąglenie w dół)
      const v = offset >= 0 ? s[i + offset] : ((s[i] + s[i + 1] + s[i + 2]) / 3) | 0;
      const bw = lut[v];
      out[i] = bw;
      out[i + 1] = bw;
      out[i + 2] = bw;
      out[i + 3] = s[i + 3]; // alfa bez zmian
    }

    return new ImageData(out, src.width, src.height);
  }

  BioEditor.ImageProcessing = { binarize };
})(window);
