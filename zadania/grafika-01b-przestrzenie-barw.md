# Grafika Komputerowa – Zadanie 1b: Przestrzenie barw

**Status:** ⏳ do zrobienia

## Treść zadania

- Dwie możliwości wyboru koloru przez użytkownika: **RGB oraz CMYK**
  (narzędzia do wyboru koloru mogą być wzorowane na popularnych programach graficznych).
- Wybór koloru może odbywać się zarówno za pomocą **myszy**, jak i poprzez
  wprowadzenie poszczególnych wartości w **pola tekstowe**.
- Wybrany kolor powinien zostać **zaprezentowany** oraz **przekonwertowany na
  drugi format**, tzn. na CMYK przy wyborze RGB oraz na RGB przy wyborze CMYK –
  przy użyciu wzorów podanych w treści zadania.
- Wartości wybrane przez użytkownika oraz po konwersji powinny zostać wyświetlone.

## Checklista wymagań

- [ ] Tryb wyboru RGB (mysz + pola tekstowe)
- [ ] Tryb wyboru CMYK (mysz + pola tekstowe)
- [ ] Podgląd wybranego koloru
- [ ] Konwersja RGB → CMYK (własna implementacja)
- [ ] Konwersja CMYK → RGB (własna implementacja)
- [ ] Wyświetlanie wartości wejściowych i po konwersji

## Wzory (do weryfikacji z treścią zadania!)

Treść zadania odwołuje się do „wzorów podanych w treści zadania” – nie zostały
tu wklejone. Poniżej standardowe wzory; **przed realizacją sprawdzić, czy
prowadzący nie podał innych** (np. wersji bez składowej K).

RGB → CMYK (R, G, B ∈ [0, 255], wynik ∈ [0, 1]):

```
r = R/255, g = G/255, b = B/255
K = 1 − max(r, g, b)
C = (1 − r − K) / (1 − K)
M = (1 − g − K) / (1 − K)
Y = (1 − b − K) / (1 − K)       // gdy K = 1 (czerń): C = M = Y = 0
```

CMYK → RGB:

```
R = 255 · (1 − C) · (1 − K)
G = 255 · (1 − M) · (1 − K)
B = 255 · (1 − Y) · (1 − K)
```

Wariant spotykany na wykładach z GK:
`R = 255 · (1 − min(1, C·(1−K) + K))` itd. – do ustalenia.

## Analiza / wstępne decyzje (do potwierdzenia przed realizacją)

- Wybór myszą:
  - RGB: suwaki R/G/B + ewentualnie pole wyboru 2D (np. jak w Photoshopie:
    kwadrat nasycenie/jasność + pasek odcienia) rysowane **ręcznie** na
    Canvas przez wypełnianie bufora pikseli,
  - CMYK: suwaki C/M/Y/K (0–100%) z gradientem podglądu na tle suwaka.
- Pola tekstowe zsynchronizowane dwukierunkowo z suwakami; walidacja zakresów
  (RGB 0–255, CMYK 0–100%).
- Konwersje jako czyste funkcje w osobnym module, np. `js/colorSpaces.js`
  (`rgbToCmyk`, `cmykToRgb`) – bez DOM, łatwe do testowania w Node.
  UI w osobnym pliku, np. `js/colorPicker.js`, nowy panel w sidebarze.
- Wybrany kolor może być potem użyty jako kolor rysowania prymitywów (zad. 1a).

## Pytania otwarte

- Dokładne wzory z treści zadania (patrz wyżej).
- Czy potrzebny dodatkowo zapis HEX (#RRGGBB)?

## Realizacja

_(uzupełnić po wykonaniu)_
