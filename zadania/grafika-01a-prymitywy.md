# Grafika Komputerowa – Zadanie 1a: Prymitywy graficzne oraz kanwa

**Status:** ⏳ do zrobienia

## Treść zadania

- Rysowanie trzech prymitywów: **linii, prostokąta, okręgu**
  (zaimplementować samemu algorytm do rysowania linii/okręgu na liczbach
  całkowitych albo zmiennoprzecinkowych).
- Podawanie parametrów rysowania za pomocą **pola tekstowego**
  (wpisanie parametrów w pola tekstowe i zatwierdzenie przyciskiem).
- Rysowanie przy użyciu **myszy** (definiowanie punktów charakterystycznych kliknięciami).
- **Przesuwanie** przy użyciu myszy (uchwycenie np. za krawędź i przeciągnięcie).
- **Zmiana kształtu / rozmiaru** przy użyciu myszy (uchwycenie za punkty
  charakterystyczne i przeciągnięcie).
- **Zmiana kształtu / rozmiaru** przy użyciu pola tekstowego (zaznaczenie
  obiektu i modyfikacja jego parametrów przy użyciu pola tekstowego).

## Checklista wymagań

- [ ] Linia – własny algorytm rasteryzacji
- [ ] Prostokąt
- [ ] Okrąg – własny algorytm rasteryzacji
- [ ] Tworzenie obiektu z pól tekstowych + przycisk
- [ ] Tworzenie obiektu kliknięciami myszy
- [ ] Zaznaczanie obiektu (kliknięcie)
- [ ] Przesuwanie obiektu myszą (przeciąganie)
- [ ] Zmiana kształtu/rozmiaru myszą (uchwyty w punktach charakterystycznych)
- [ ] Edycja parametrów zaznaczonego obiektu w polach tekstowych

## Analiza / wstępne decyzje (do potwierdzenia przed realizacją)

- **Rasteryzacja bez Canvas API do kształtów** – piksele wpisujemy do
  `Uint8ClampedArray`, potem jeden `putImageData`. Nie używamy `ctx.lineTo`,
  `ctx.arc`, `ctx.strokeRect`.
  - linia: algorytm **Bresenhama** (liczby całkowite, wszystkie oktanty),
  - okrąg: algorytm **midpoint (Bresenhama dla okręgu)** z symetrią 8-krotną,
  - prostokąt: 4 linie (lub poziome/pionowe odcinki wprost w buforze).
- **Model obiektowy (scena wektorowa)** – żeby obiekty dało się zaznaczać,
  przesuwać i edytować, trzymamy listę kształtów z parametrami
  (np. `{ type: 'line', x1, y1, x2, y2, color }`, `{ type: 'rect', x, y, w, h }`,
  `{ type: 'circle', cx, cy, r }`), a obraz rastrowy jest generowany z tej
  listy przy każdym przerysowaniu.
- **Punkty charakterystyczne / uchwyty**: linia – 2 końce; prostokąt – 4 rogi
  (lub 2 przeciwległe); okrąg – środek + punkt na obwodzie (promień).
- **Trafienie myszą (hit-testing)**: odległość punktu od odcinka / od krawędzi
  prostokąta / `|dist(środek) − r|` dla okręgu, z tolerancją kilku pikseli.
- **Współrzędne myszy**: przeliczenie `clientX/Y` na piksele kanwy przez
  `getBoundingClientRect()` i stosunek `canvas.width / rect.width`
  (kanwa może być skalowana przez CSS).
- Proponowane pliki: `js/shapes.js` (algorytmy rasteryzacji – czyste funkcje
  na buforze), `js/scene.js` (lista obiektów, hit-testing, uchwyty),
  `js/drawingTool.js` (obsługa myszy i paneli). Nowy panel w sidebarze.

## Pytania otwarte

- Czy kanwa do rysowania ma być wspólna z obrazem wczytywanym w zadaniach
  z biometrii (rysowanie po obrazie), czy osobna (pusta, np. 800×600)?
- Czy zapis do pliku ma uwzględniać narysowane kształty?
- Kolor obiektów – czy połączyć z selektorem kolorów z zadania 1b?
- Prostokąt: osiowo wyrównany (wystarczy) czy dowolnie obracany?

## Realizacja

_(uzupełnić po wykonaniu)_
